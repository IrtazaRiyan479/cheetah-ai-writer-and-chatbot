import { readFile } from 'fs/promises'
import path from 'path'

import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate, effectiveWebsiteLimit, getWebsiteLimitDefaults } from '@/libs/entitlement'
import { ensureAiMetaFunctions } from '@/libs/wpThemeFunctions'
import { serializeError } from '@/utils/serializeError'

import { escapeHtml, finalizeArticleHtml } from '../generate/utils/articleHtml'

export const maxDuration = 60

const prisma = global.prismaPublish || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prismaPublish = prisma

function normalizeWpSiteUrl(url) {
  let clean = String(url || '').trim()

  if (!clean) throw new Error('WordPress site URL is missing.')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`

  return clean.replace(/\/+$/, '').replace(/\/wp-json(?:\/wp\/v2)?$/i, '')
}

function wpMessage(data, status, fallback) {
  const code = data?.code || data?.data?.code || ''
  const raw = data?.message || data?.error || fallback || 'WordPress request failed'

  const message = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `WordPress HTTP ${status}${code ? ` ${code}` : ''}: ${message}`.slice(0, 500)
}

function extractWpJson(raw) {
  if (raw == null) return null

  const parse = value => {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  const text = String(raw)
    .replace(/^\uFEFF/, '')
    .trim()

  if (!text) return null

  let data = parse(text)

  if (typeof data === 'string') data = parse(data)
  if (data) return data

  const objStart = text.indexOf('{')
  const objEnd = text.lastIndexOf('}')

  if (objStart !== -1 && objEnd > objStart) {
    data = parse(text.slice(objStart, objEnd + 1))
    if (typeof data === 'string') data = parse(data)
    if (data) return data
  }

  const arrStart = text.indexOf('[')
  const arrEnd = text.lastIndexOf(']')

  if (arrStart !== -1 && arrEnd > arrStart) {
    data = parse(text.slice(arrStart, arrEnd + 1))
    if (data) return data
  }

  return null
}

function idFromHeaders(res) {
  if (!res) return null

  const blob = `${res.headers?.get('location') || ''} ${res.headers?.get('link') || ''} ${res.url || ''}`
  const match = blob.match(/\/wp\/v2\/(?:posts|pages|media)\/(\d+)/i)

  return match ? Number(match[1]) : null
}

function pickId(data, res) {
  const source = Array.isArray(data) ? data[0] : data
  const raw = source?.id ?? source?.ID ?? source?.data?.id ?? source?.post?.id ?? source?.post_id
  const id = Number(raw)

  if (Number.isFinite(id) && id > 0) return id

  return idFromHeaders(res)
}

async function readWp(res, fallback) {
  const raw = await res.text().catch(() => '')
  const data = extractWpJson(raw)

  if (!res.ok) {
    throw new Error(
      data ? wpMessage(data, res.status, fallback) : `WordPress HTTP ${res.status}: ${(raw || fallback).slice(0, 300)}`
    )
  }

  return data || {}
}

async function wpFetch(url, options, attempts = 2) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) })

      if (res.status >= 500 && attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, 700))
        continue
      }

      return res
    } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      await new Promise(resolve => setTimeout(resolve, 700))
    }
  }

  throw new Error(`WordPress network error: ${serializeError(lastError)}`)
}

const IMAGE_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif'
}

function extFromMime(mime) {
  const sub =
    String(mime || '')
      .split('/')[1]
      ?.split('+')[0]
      ?.toLowerCase() || 'jpg'

  return sub === 'jpeg' ? 'jpg' : sub.replace(/[^a-z0-9]/g, '') || 'jpg'
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(new RegExp('&' + 'amp;', 'g'), '&')
    .replace(new RegExp('&' + 'quot;', 'g'), '"')
    .replace(new RegExp('&' + '#39;', 'g'), "'")
    .replace(new RegExp('&' + 'lt;', 'g'), '<')
    .replace(new RegExp('&' + 'gt;', 'g'), '>')
}

function parseDataUrl(src) {
  const match = /^data:([^;,]+)?(;base64)?,/i.exec(String(src || '').trim())

  if (!match) return null

  const mimeType = (match[1] || 'image/png').toLowerCase()

  if (!mimeType.startsWith('image/') || mimeType.includes('svg')) return null

  const payload = String(src).slice(match[0].length).replace(/\s/g, '')
  const buffer = match[2] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')

  if (!buffer.length) return null

  return { buffer, mimeType }
}

async function loadLocalUpload(src) {
  let pathname = String(src || '')
    .split('?')[0]
    .split('#')[0]

  try {
    if (/^https?:\/\//i.test(pathname)) pathname = new URL(pathname).pathname
  } catch {
    return null
  }

  if (!pathname.startsWith('/uploads/')) return null

  const filename = path.basename(pathname)

  if (!filename || filename === '.' || filename === '..') return null

  const mimeType = IMAGE_EXT[path.extname(filename).slice(1).toLowerCase()]

  if (!mimeType) return null

  try {
    const buffer = await readFile(path.join(process.cwd(), 'public', 'uploads', filename))

    if (!buffer.length) return null

    return { buffer, mimeType, filename }
  } catch {
    return null
  }
}

function shouldSideload(src, siteUrl) {
  const value = String(src || '').trim()

  if (!value || value.startsWith('blob:') || value.startsWith('cid:')) return false
  if (value.startsWith('data:')) return value.startsWith('data:image/') && !/^data:image\/svg/i.test(value)
  if (value.startsWith('/uploads/')) return true
  if (!/^https?:\/\//i.test(value)) return false

  try {
    return new URL(value).host !== new URL(siteUrl).host
  } catch {
    return false
  }
}

async function loadImageBytes(src) {
  const value = String(src || '').trim()

  if (value.startsWith('data:')) {
    const parsed = parseDataUrl(value)

    if (!parsed) throw new Error('Image data URL is invalid.')

    return parsed
  }

  const local = await loadLocalUpload(value)

  if (local) return local

  const response = await fetch(value, {
    redirect: 'follow',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(45000)
  })

  if (!response.ok) throw new Error(`Could not download image. HTTP ${response.status}`)

  const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase()

  if (!mimeType.startsWith('image/') || mimeType.includes('svg')) throw new Error(`Unsupported image type ${mimeType}`)

  const buffer = Buffer.from(await response.arrayBuffer())

  if (!buffer.length) throw new Error('Image download was empty.')

  return { buffer, mimeType }
}

async function compressWithTiny(bytes) {
  const key = process.env.TINYPNG_API_KEY

  if (!bytes?.buffer?.length || bytes.buffer.length < 20 * 1024) return bytes

  if (!key) {
    console.error('TinyPNG skipped: TINYPNG_API_KEY is missing')

    return bytes
  }

  const mimeType = String(bytes.mimeType || 'image/png').toLowerCase()

  if (!/^image\/(png|jpe?g|webp)$/.test(mimeType)) return bytes

  try {
    const tinyKey = Buffer.from(`api:${key}`).toString('base64')

    const shrinkRes = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${tinyKey}`,
        'Content-Type': mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
      },
      body: bytes.buffer,
      signal: AbortSignal.timeout(20000)
    })

    const shrinkData = await shrinkRes.json().catch(() => null)

    if (!shrinkRes.ok || shrinkData?.error || !shrinkData?.output?.url) {
      console.error('TinyPNG skipped:', shrinkData?.error || shrinkData?.message || shrinkRes.status)

      return bytes
    }

    const compRes = await fetch(shrinkData.output.url, {
      headers: { Authorization: `Basic ${tinyKey}` },
      signal: AbortSignal.timeout(20000)
    })

    if (!compRes.ok) return bytes

    const buffer = Buffer.from(await compRes.arrayBuffer())

    if (!buffer.length || buffer.length >= bytes.buffer.length) return bytes

    const compressedType = (compRes.headers.get('content-type') || shrinkData.output.type || 'image/png')
      .split(';')[0]
      .trim()
      .toLowerCase()

    console.log(`TinyPNG ${bytes.buffer.length} -> ${buffer.length}`)

    return {
      buffer,
      mimeType: compressedType.startsWith('image/') ? compressedType : 'image/png'
    }
  } catch (error) {
    console.error('TinyPNG skipped:', serializeError(error))

    return bytes
  }
}

async function uploadBufferToWP(bytes, siteUrl, credentials) {
  const mimeType = bytes.mimeType || 'image/jpeg'
  const filename =
    bytes.filename || `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromMime(mimeType)}`

  const mediaRes = await wpFetch(
    `${siteUrl}/wp-json/wp/v2/media?_fields=id,source_url`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': mimeType
      },
      body: bytes.buffer
    },
    1
  )

  const mediaData = await readWp(mediaRes, 'Media upload failed. Check the application password can upload files.')
  const id = pickId(mediaData, mediaRes)

  if (!id) throw new Error(wpMessage(mediaData, mediaRes.status, 'Media upload did not return an id.'))

  let sourceUrl = mediaData.source_url || mediaData.guid?.rendered || ''

  if (!sourceUrl) {
    const readBack = await wpFetch(`${siteUrl}/wp-json/wp/v2/media/${id}?_fields=id,source_url`, {
      headers: { Authorization: `Basic ${credentials}` }
    })

    const confirmed = await readWp(readBack, 'Uploaded the image but could not read its URL.')

    sourceUrl = confirmed.source_url || ''
  }

  if (!sourceUrl) throw new Error('Media upload did not return a source URL.')

  return { id, sourceUrl }
}

async function mapPool(items, limit, worker) {
  if (!items.length) return

  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor

      cursor += 1
      await worker(items[index], index)
    }
  })

  await Promise.all(runners)
}

async function remoteImageIsLive(src) {
  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }

  const liveFrom = res => {
    if (!(res.ok || res.status === 206)) return false

    const type = (res.headers.get('content-type') || '').toLowerCase()

    if (type.includes('text/html') || type.startsWith('text/')) return false

    return true
  }

  try {
    const head = await fetch(src, {
      method: 'HEAD',
      redirect: 'follow',
      headers,
      signal: AbortSignal.timeout(8000)
    })

    if (liveFrom(head)) return true

    if (![400, 403, 405, 501].includes(head.status)) return false

    const ranged = await fetch(src, {
      method: 'GET',
      redirect: 'follow',
      headers: { ...headers, Range: 'bytes=0-2047' },
      signal: AbortSignal.timeout(8000)
    })

    return liveFrom(ranged)
  } catch {
    return false
  }
}

async function sideloadImages(html, heroSrc, siteUrl, credentials) {
  const rawSrcs = []
  const re = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  let match

  while ((match = re.exec(html))) {
    const src = match[1] || match[2] || match[3] || ''

    if (src) rawSrcs.push(src)
  }

  if (heroSrc) rawSrcs.push(heroSrc)

  const unique = [...new Set(rawSrcs.map(src => src.trim()).filter(Boolean))]
  const targets = unique.filter(src => shouldSideload(decodeHtmlAttr(src), siteUrl) || shouldSideload(src, siteUrl))
  const uploaded = new Map()

  await mapPool(targets, 6, async src => {
    const fetchSrc = decodeHtmlAttr(src)

    try {
      if (/^https?:\/\//i.test(fetchSrc) && (await remoteImageIsLive(fetchSrc))) return

      const bytes = await compressWithTiny(await loadImageBytes(fetchSrc))
      const media = await uploadBufferToWP(bytes, siteUrl, credentials)

      uploaded.set(src, media)
    } catch (error) {
      console.error('Image sideload skipped:', serializeError(error))
    }
  })

  console.log(`Publish images: ${targets.length} checked, ${uploaded.size} uploaded`)

  let nextHtml = html
  let featuredMediaId = null
  let resolvedHero = heroSrc || ''

  for (const [src, media] of uploaded) {
    nextHtml = nextHtml.split(`"${src}"`).join(`"${media.sourceUrl}"`).split(`'${src}'`).join(`'${media.sourceUrl}'`)

    if (heroSrc && src === String(heroSrc).trim()) {
      featuredMediaId = media.id
      resolvedHero = media.sourceUrl
    }
  }

  return { html: nextHtml, featuredMediaId, heroSrc: resolvedHero }
}

function slimSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const out = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number' || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'string' && !value.startsWith('data:') && value.length <= 2000) out[key] = value
  }

  return out
}

async function resolvePost(response, data, { siteUrl, authHeaders, title }) {
  let id = pickId(data, response)
  let link = data?.link || ''
  let featured = data?.featured_media
  let status = data?.status

  if (!id && (response.status === 201 || response.status === 200)) {
    const params = new URLSearchParams({
      search: String(title || '').slice(0, 100),
      per_page: '5',
      orderby: 'date',
      order: 'desc',
      _fields: 'id,link,status,featured_media,title'
    })

    const foundRes = await wpFetch(`${siteUrl}/wp-json/wp/v2/posts?${params}`, { headers: authHeaders })
    const found = await readWp(foundRes, 'WordPress created the post but did not return an id.')
    const rows = Array.isArray(found) ? found : []

    const wanted = String(title || '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .toLowerCase()

    const match = rows.find(row => {
      const rawTitle = row?.title?.rendered || row?.title?.raw || row?.title || ''

      return (
        String(rawTitle)
          .replace(/<[^>]+>/g, '')
          .trim()
          .toLowerCase() === wanted
      )
    })

    if (match) {
      id = pickId(match, null)
      link = match.link || link
      featured = match.featured_media
      status = match.status || status
    }
  }

  if (!id) throw new Error(wpMessage(data, response.status, 'WordPress did not return a post id.'))

  if (!link) {
    const readBack = await wpFetch(`${siteUrl}/wp-json/wp/v2/posts/${id}?_fields=id,link,status,featured_media`, {
      headers: authHeaders
    })

    const confirmed = await readWp(readBack, 'Could not read the published post back')

    link = confirmed.link || link
    if (confirmed.featured_media != null) featured = confirmed.featured_media
    status = confirmed.status || status
  }

  return { id, link, featured_media: featured, status }
}

function wpFutureDateGmt(scheduledAt) {
  const when = new Date(scheduledAt)

  if (!scheduledAt || Number.isNaN(when.getTime())) {
    throw new Error('Choose a date and time to schedule this post.')
  }

  if (when.getTime() <= Date.now() + 60 * 1000) {
    throw new Error('Schedule time must be at least one minute in the future.')
  }

  return when.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

async function mirrorPublishedArticle({ userId, body, created, editLink, siteKey, title, content }) {
  const wpStatus = String(created.status || '')
  const calendar = wpStatus === 'future' ? 'Scheduled' : wpStatus === 'publish' ? 'Published' : 'Draft'
  const localStatus = wpStatus === 'future' ? 'scheduled' : wpStatus === 'publish' ? 'published' : 'draft'
  const when = wpStatus === 'future' && body.scheduledAt ? new Date(body.scheduledAt) : new Date()
  const start = Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString()
  const data = {
    title: title || 'Untitled AI Article',
    content: content || '',
    status: localStatus,
    wpPostId: Number(created.id),
    targetSite: siteKey || null,
    scheduledAt: wpStatus === 'future' && !Number.isNaN(when.getTime()) ? when : null,
    publishMeta: JSON.stringify({
      calendar,
      start,
      end: start,
      allDay: wpStatus !== 'future',
      url: created.link || editLink || '',
      siteKey: siteKey || '',
      link: created.link || '',
      editLink: editLink || ''
    })
  }

  const articleId = body.articleId ? String(body.articleId) : ''
  let existing = null

  if (articleId) {
    existing = await prisma.article.findFirst({ where: { id: articleId, userId } })
  }

  if (!existing) {
    existing = await prisma.article.findFirst({ where: { userId, wpPostId: Number(created.id) } })
  }

  if (existing) {
    const updated = await prisma.article.update({
      where: { id: existing.id },
      data: {
        title: data.title,
        status: data.status,
        wpPostId: data.wpPostId,
        targetSite: data.targetSite,
        scheduledAt: data.scheduledAt,
        publishMeta: data.publishMeta
      }
    })

    return updated.id
  }

  const createdRow = await prisma.article.create({ data: { userId, ...data } })

  return createdRow.id
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    const gate = await assertCanGenerate({
      userId: session?.user?.id,
      email: session?.user?.email,
      featureKey: 'wp-publish',
      estimatedWords: 0
    })

    if (!gate.ok) return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })

    const body = await request.json()

    let {
      title,
      content,
      status,
      siteType,
      siteId,
      customSite,
      featuredImageUrl,
      metaTitle,
      metaDescription,
      language,
      articleType,
      settings,
      trimTitleAndHero,
      scheduledAt
    } = body

    const owner = session?.user?.email
      ? await prisma.user.findUnique({ where: { email: session.user.email } })
      : null

    if (!siteType && body.siteKey) {
      const siteKey = String(body.siteKey)

      if (siteKey.startsWith('db_')) {
        if (!owner) throw new Error('Sign in to publish.')

        const row = await prisma.customWPSite.findFirst({
          where: { id: siteKey.slice(3), userId: owner.id }
        })

        if (!row) throw new Error('Choose a connected WordPress site.')

        siteType = 'custom'
        customSite = { id: row.id, url: row.url, username: row.username, password: row.password }
      } else {
        siteType = 'predefined'
        siteId = siteKey
      }
    }

    if (owner && body.articleId && !String(body.articleId).startsWith('wp_')) {
      const article = await prisma.article.findFirst({
        where: { id: String(body.articleId), userId: owner.id }
      })

      if (article) {
        if (!title) title = article.title
        if (!content) content = article.content
      }
    }

    if (body.siteKey && !String(content || '').trim()) {
      throw new Error('This article has no content to publish.')
    }

    let siteUrl, wpUsername, wpPassword

    if (siteType === 'predefined') {
      const requester = String(session?.user?.email || '')
        .trim()
        .toLowerCase()

      if (requester !== 'abrarshovon@admin.com') {
        return NextResponse.json(
          { success: false, error: 'Those WordPress sites are only available on the admin account.' },
          { status: 403 }
        )
      }

      const predefinedSites = JSON.parse(process.env.PREDEFINED_WP_SITES || '[]')
      const selectedSite = predefinedSites.find(site => site.id === siteId)

      if (!selectedSite) throw new Error('Predefined site not found in configuration.')

      siteUrl = selectedSite.url
      wpUsername = selectedSite.username
      wpPassword = selectedSite.password
    } else if (siteType === 'custom') {
      if (!customSite?.url || !customSite?.username || !customSite?.password) {
        throw new Error('Custom site URL, username, and password are required.')
      }

      siteUrl = customSite.url
      wpUsername = customSite.username
      wpPassword = customSite.password

      if (owner && !customSite.id) {
        const websiteLimit = effectiveWebsiteLimit(owner, await getWebsiteLimitDefaults())

        if (websiteLimit != null) {
          const rows = await prisma.customWPSite.findMany({ where: { userId: owner.id }, select: { url: true } })
          let target = ''

          try {
            target = normalizeWpSiteUrl(customSite.url)
          } catch {
            target = String(customSite.url || '').trim()
          }

          const alreadySaved = rows.some(row => {
            try {
              return normalizeWpSiteUrl(row.url) === target
            } catch {
              return false
            }
          })

          if (!alreadySaved && rows.length >= websiteLimit) {
            return NextResponse.json(
              {
                success: false,
                error: `This plan can add ${websiteLimit} website${websiteLimit === 1 ? '' : 's'}. Only the Max plan can add unlimited websites.`
              },
              { status: 403 }
            )
          }
        }
      }
    }

    if (!siteUrl || !wpUsername || !wpPassword) {
      throw new Error('WordPress site URL, username, and application password are required.')
    }

    const cleanSiteUrl = normalizeWpSiteUrl(siteUrl)
    const appPassword = String(wpPassword).replace(/\s+/g, '')
    const credentials = Buffer.from(`${wpUsername}:${appPassword}`).toString('base64')
    const authHeaders = { Authorization: `Basic ${credentials}` }

    let functionsPhp = null

    if (siteType === 'custom') {
      functionsPhp = await ensureAiMetaFunctions({
        siteUrl: cleanSiteUrl,
        username: wpUsername,
        password: appPassword
      })
    }

    const sideloaded = await sideloadImages(content || '', featuredImageUrl || '', cleanSiteUrl, credentials)
    let featuredMediaId = sideloaded.featuredMediaId
    let heroSrc = sideloaded.heroSrc || ''

    const masterStyles = `<style id="cheetah-master-styles">#cheetah-article-wrapper{line-height:1.7;font-family:system-ui,-apple-system,sans-serif}#cheetah-article-wrapper table{width:100%!important;table-layout:auto!important;border-collapse:separate!important;border-spacing:0!important;margin:32px 0!important;border-radius:10px!important;border:1px solid #1e40af!important;background-color:#ffffff!important;box-shadow:0 4px 12px -2px rgba(0,0,0,0.03)!important}#cheetah-article-wrapper th,#cheetah-article-wrapper td{padding:18px 24px!important;vertical-align:top!important;border-bottom:1px solid #e5e7eb!important;border-right:1px solid #e5e7eb!important;text-align:left!important;word-wrap:break-word!important}#cheetah-article-wrapper th:last-child,#cheetah-article-wrapper td:last-child{border-right:none!important}#cheetah-article-wrapper tr:last-child td{border-bottom:none!important}#cheetah-article-wrapper th:first-child{border-top-left-radius:9px!important}#cheetah-article-wrapper th:last-child{border-top-right-radius:9px!important}#cheetah-article-wrapper tr:last-child td:first-child{border-bottom-left-radius:9px!important}#cheetah-article-wrapper tr:last-child td:last-child{border-bottom-right-radius:9px!important}#cheetah-article-wrapper th{background:#ffffff!important;color:#1e40af!important;font-weight:700!important;font-size:15px!important;text-transform:uppercase!important;letter-spacing:0.05em!important}#cheetah-article-wrapper td{font-size:16px!important;color:#374151!important;line-height:1.6!important}#cheetah-article-wrapper a.cta-button{text-decoration:none!important;background-color:#6366f1!important;color:#ffffff!important;font-weight:700!important;padding:12px 26px!important;border-radius:9999px!important;display:inline-block!important;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)!important;border:1px solid #4f46e5!important}#cheetah-article-wrapper img{border-radius:12px!important;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)!important;max-width:100%!important;height:auto!important}@media (max-width:640px){#cheetah-article-wrapper .product-name-desktop{display:none!important}#cheetah-article-wrapper .product-name-mobile{display:inline!important;font-size:13px!important;line-height:1.3!important}#cheetah-article-wrapper table.affigenie-table td:first-child{width:auto!important;min-width:0!important;max-width:none!important}#cheetah-article-wrapper table td:first-child img{width:80px!important;height:80px!important;max-width:80px!important;object-fit:contain!important}#cheetah-article-wrapper a.cta-button{padding:8px 12px!important;font-size:12px!important}}#cheetah-article-wrapper table img{width:80px!important;height:auto!important;max-width:90px!important;margin:0!important;box-shadow:none!important;aspect-ratio:auto!important}.check-price-btn{display:inline-block!important;background-color:#6366f1!important;color:#fff!important;font-weight:700!important;padding:10px 24px!important;border-radius:9999px!important;text-decoration:none!important;transition:background-color .2s,transform .2s!important}.check-price-btn:hover{background-color:#4f46e5!important;transform:translateY(-1px)!important}table{width:100%!important;max-width:100%!important;border-collapse:collapse!important;margin:24px 0!important;display:table!important;overflow:visible!important}td,th{word-break:normal;white-space:normal}</style>`

    const articleHtml = finalizeArticleHtml(sideloaded.html || '', {
      language,
      partnerTag: process.env.AMAZON_PARTNER_TAG || '',
      domain: 'www.amazon.com',
      articleType,
      settings: slimSettings(settings)
    })

    const contentHead = String(articleHtml)
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .slice(0, 3000)

    const bodyAlreadyHasLeadingImg = /<img\b/i.test(contentHead)

    const heroHtml =
      !trimTitleAndHero && heroSrc && !bodyAlreadyHasLeadingImg && !String(articleHtml).includes(heroSrc)
        ? `<p class="affigenie-hero"><img class="affigenie-hero-img" src="${escapeHtml(heroSrc)}" alt="${escapeHtml(title || 'Featured image')}" style="width:100%;max-width:100%;height:auto;display:block;" /></p>`
        : ''

    const finalContent = `
  <div id="cheetah-article-wrapper">
    ${masterStyles}
    ${heroHtml}
    ${articleHtml}
  </div>
`

    const postPayload = {
      title: title || 'Untitled AI Article',
      content: finalContent,
      status: status === 'publish' ? 'publish' : 'draft',
      meta: {
        meta_title: metaTitle || '',
        meta_description: metaDescription || '',

        rank_math_title: metaTitle || '',
        rank_math_description: metaDescription || '',

        _yoast_wpseo_title: metaTitle || '',
        _yoast_wpseo_metadesc: metaDescription || ''
      }
    }

    if (status === 'future') {
      postPayload.status = 'future'
      postPayload.date_gmt = wpFutureDateGmt(scheduledAt)
    }

    if (featuredMediaId) {
      postPayload.featured_media = featuredMediaId
    }

    const response = await wpFetch(`${cleanSiteUrl}/wp-json/wp/v2/posts?_fields=id,link,status,featured_media`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    })

    const data = await readWp(response, 'Failed to publish to WordPress')

    const created = await resolvePost(response, data, {
      siteUrl: cleanSiteUrl,
      authHeaders,
      title: postPayload.title
    })

    if (featuredMediaId && Number(created.featured_media) !== Number(featuredMediaId)) {
      const retry = await wpFetch(
        `${cleanSiteUrl}/wp-json/wp/v2/posts/${created.id}?_fields=id,link,status,featured_media`,
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ featured_media: featuredMediaId })
        }
      )

      const retried = await readWp(retry, 'Could not attach the featured image')
      let featured = Number(retried.featured_media)

      if (featured !== Number(featuredMediaId)) {
        const readBack = await wpFetch(
          `${cleanSiteUrl}/wp-json/wp/v2/posts/${created.id}?_fields=id,featured_media,link`,
          { headers: authHeaders }
        )

        const confirmed = await readWp(readBack, 'Could not read the published post back')

        featured = Number(confirmed.featured_media)
      }

      if (featured !== Number(featuredMediaId)) {
        throw new Error(
          `WordPress post ${created.id} was created, but featured_media is still missing after one retry.`
        )
      }
    }

    const editLink = `${cleanSiteUrl}/wp-admin/post.php?post=${created.id}&action=edit`

    let articleId = body.articleId || null

    try {
      const user = session?.user?.email
        ? await prisma.user.findUnique({ where: { email: session.user.email } })
        : null

      if (user) {
        let siteKey = null

        if (siteType === 'predefined') siteKey = siteId || null
        else if (customSite?.id) siteKey = `db_${customSite.id}`

        articleId = await mirrorPublishedArticle({
          userId: user.id,
          body,
          created: { ...created, status: created.status || postPayload.status },
          editLink,
          siteKey,
          title: postPayload.title,
          content: finalContent
        })
      }
    } catch (mirrorError) {
      console.error('Publish mirror skipped:', serializeError(mirrorError))
    }

    return NextResponse.json({
      success: true,
      wpPostId: created.id,
      link: created.link,
      editLink,
      status: created.status || postPayload.status,
      featuredMediaId,
      functionsPhp,
      articleId
    })
  } catch (error) {
    console.error('WordPress API Error:', serializeError(error))

    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

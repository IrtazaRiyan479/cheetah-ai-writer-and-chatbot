import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate } from '@/libs/entitlement'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const prisma = global.prismaCalendar || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prismaCalendar = prisma

const ADMIN_EMAIL = 'abrarshovon@admin.com'
const ACTION_TYPES = ['Draft', 'Published', 'Scheduled']
const ARTICLE_TYPE_LABELS = {
  blog: 'Blog Post',
  listicle: 'Listicle',
  'local-roundup': 'Local Places Roundup',
  'amazon-roundup': 'Amazon Product Roundup',
  'amazon-review': 'Amazon Single Product Review',
  'product-comparison': 'Product Comparison',
  'youtube-blog': 'YouTube Video to Blog Post',
  rewrite: 'Rewrite Blog Post',
  'amazon-roundup-rewrite': 'Rewrite Amazon Roundup',
  'amazon-review-rewrite': 'Rewrite Amazon Review'
}

function normalizeWpSiteUrl(url) {
  let clean = String(url || '').trim()

  if (!clean) throw new Error('WordPress site URL is missing.')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`

  return clean.replace(/\/+$/, '').replace(/\/wp-json(?:\/wp\/v2)?$/i, '')
}

function toWpGmt(value) {
  const when = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(when.getTime())) throw new Error('Choose a valid date.')

  return when.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function wpMessage(data, status) {
  const raw = data?.message || data?.error || 'WordPress request failed.'
  const message = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `WordPress HTTP ${status}: ${message}`.slice(0, 400)
}

function readableError(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'WordPress request timed out.'

  return error?.message || 'WordPress request failed.'
}

async function requireUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) return { session: null, user: null }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })

  return { session, user }
}

function predefinedSites() {
  try {
    const parsed = JSON.parse(process.env.PREDEFINED_WP_SITES || '[]')

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function connectedSites(user, session) {
  const sites = []
  const saved = await prisma.customWPSite.findMany({ where: { userId: user.id } })

  saved.forEach(site => {
    sites.push({
      siteKey: `db_${site.id}`,
      label: site.name || site.url,
      url: site.url,
      username: site.username,
      password: site.password
    })
  })

  const email = String(session?.user?.email || '').trim().toLowerCase()

  if (email === ADMIN_EMAIL) {
    predefinedSites().forEach(site => {
      if (!site?.id || !site?.url) return

      sites.push({
        siteKey: site.id,
        label: site.name || site.id,
        url: site.url,
        username: site.username,
        password: site.password
      })
    })
  }

  return sites
}

const SITE_PALETTE = [
  '#2563EB',
  '#DC2626',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#DB2777',
  '#0891B2',
  '#EA580C',
  '#4F46E5',
  '#0F766E',
  '#BE123C',
  '#65A30D',
  '#0369A1',
  '#A21CAF',
  '#B45309',
  '#4338CA'
]

function assignSiteColors(sites) {
  const colors = new Map()
  const ranked = [...sites].sort((a, b) => String(a.siteKey).localeCompare(String(b.siteKey)))

  ranked.forEach((site, index) => {
    if (index < SITE_PALETTE.length) {
      colors.set(site.siteKey, SITE_PALETTE[index])

      return
    }

    const hue = Math.round((index * 137.508 + 17) % 360)

    colors.set(site.siteKey, `hsl(${hue} 74% 36%)`)
  })

  return colors
}

function publicSites(sites, colors) {
  return sites.map(site => ({
    value: site.siteKey,
    label: site.label || site.siteKey,
    color: colors?.get(site.siteKey) || SITE_PALETTE[0]
  }))
}

function siteAuth(site) {
  const base = normalizeWpSiteUrl(site.url)
  const password = String(site.password || '').replace(/\s+/g, '')
  const authorization = `Basic ${Buffer.from(`${site.username}:${password}`).toString('base64')}`

  return { ...site, base, authorization }
}

async function wpRequest(site, path, { method = 'GET', payload, timeoutMs = 20000 } = {}) {
  const headers = {}

  if (site.authorization) headers.Authorization = site.authorization
  if (payload) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${site.base}${path}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store'
  })
  const raw = await response.text()
  let data = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = new Error(data ? wpMessage(data, response.status) : `WordPress HTTP ${response.status}`)

    error.status = response.status
    error.code = data?.code || ''
    throw error
  }

  return { data, response }
}

function readMeta(article) {
  try {
    const value = JSON.parse(article?.publishMeta || '')

    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function isOutlineLike(article) {
  const status = String(article?.status || '').toLowerCase()

  if (status === 'outline') return true

  const content = String(article?.content || '').trim()
  const outline = String(article?.outline || '').trim()

  return !content && Boolean(outline)
}

function isHidden(article) {
  return readMeta(article).hidden === true
}

function articleTypeFromContent(content) {
  const html = String(content || '')
  const attr = html.match(/data-affigenie-type=["']([a-z0-9-]+)["']/i)

  if (attr?.[1]) return attr[1].toLowerCase()

  const marker = html.match(/affigenie-article-type:([a-z0-9-]+)/i)

  if (marker?.[1]) return marker[1].toLowerCase()

  return ''
}

function articleTypeLabel(type) {
  if (!type) return 'Article'

  return ARTICLE_TYPE_LABELS[type] || 'Article'
}

function laneForStatus(status) {
  const value = String(status || '').toLowerCase()

  if (value === 'scheduled') return 'Scheduled'
  if (value === 'published' || value === 'promotion') return 'Published'
  if (value === 'draft' || value === 'revision') return 'Draft'

  return 'Draft'
}

function asDate(value) {
  if (!value) return null

  const when = value instanceof Date ? value : new Date(value)

  return Number.isNaN(when.getTime()) ? null : when
}

function eventStart(article, meta, lane) {
  if (lane === 'Scheduled') {
    const scheduled = asDate(article.scheduledAt)

    if (scheduled) return scheduled
  }

  const fromMeta = asDate(meta.start)

  if (fromMeta) return fromMeta
  if (lane === 'Published') return asDate(article.updatedAt) || asDate(article.createdAt) || new Date()

  return asDate(article.createdAt) || new Date()
}

function toArticleEvent(article) {
  const meta = readMeta(article)
  const lane = laneForStatus(article.status)
  const start = eventStart(article, meta, lane)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const articleType = articleTypeFromContent(article.content)

  return {
    id: article.id,
    display: 'block',
    title: article.title || 'Untitled article',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    url: '',
    extendedProps: {
      calendar: lane,
      guests: [],
      description: typeof meta.description === 'string' ? meta.description : '',
      articleId: article.id,
      articleType,
      articleTypeLabel: articleTypeLabel(articleType),
      siteKey: article.targetSite || (typeof meta.siteKey === 'string' ? meta.siteKey : '') || '',
      createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : null,
      wpPostId: article.wpPostId || null
    }
  }
}

function toDraftOption(article) {
  const articleType = articleTypeFromContent(article.content)

  return {
    id: article.id,
    title: article.title || 'Untitled article',
    createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : null,
    articleType,
    articleTypeLabel: articleTypeLabel(articleType)
  }
}

function writeMeta(article, patch) {
  return JSON.stringify({
    ...readMeta(article),
    ...patch,
    allDay: false,
    hidden: patch.hidden === true
  })
}

async function loadOwnedArticle(userId, articleId) {
  if (!articleId) return null

  return prisma.article.findFirst({ where: { id: String(articleId), userId } })
}

function wpPlainTitle(post) {
  const raw = post?.title?.rendered ?? post?.title ?? ''

  return (
    String(raw)
      .replace(/<[^>]+>/g, '')
      .replace(/&/g, '&')
      .replace(/"/g, '"')
      .replace(/&#0*39;|'/g, "'")
      .replace(/&#8217;|&#8216;/g, "'")
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled article'
  )
}

function wpPostStart(post) {
  const raw = String(post?.date || post?.date_gmt || '')
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)

  if (!match) return new Date()

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0)
}

function laneForWpStatus(status) {
  const value = String(status || '').toLowerCase()

  if (value === 'future') return 'Scheduled'
  if (value === 'publish' || value === 'private') return 'Published'

  return 'Draft'
}

function wpPostToEvent(site, post, color) {
  const start = wpPostStart(post)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const lane = laneForWpStatus(post?.status)
  const title = wpPlainTitle(post)
  const siteLabel = site.label && site.label !== title ? site.label : ''

  return {
    id: `wp_${site.siteKey}_${post.id}`,
    display: 'block',
    title: siteLabel ? `${title} · ${siteLabel}` : title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    url: typeof post?.link === 'string' ? post.link : '',
    extendedProps: {
      calendar: lane,
      guests: [],
      description: '',
      articleId: `wp_${site.siteKey}_${post.id}`,
      articleType: '',
      articleTypeLabel: 'Article',
      siteKey: site.siteKey,
      siteLabel: site.label || site.siteKey,
      siteColor: color || SITE_PALETTE[0],
      wpPostId: Number(post.id) || null,
      wpStatus: post?.status || ''
    }
  }
}

function postsPath(page, status) {
  const params = new URLSearchParams()

  params.set('per_page', '100')
  params.set('page', String(page))
  params.set('orderby', 'date')
  params.set('order', 'desc')
  params.set('_fields', 'id,title,status,date,date_gmt,link')
  if (status) params.set('status', status)

  return `/wp-json/wp/v2/posts?${params.toString()}`
}

async function fetchWpPosts(authed, status) {
  const events = []
  let page = 1
  const maxPages = 5

  while (page <= maxPages) {
    const { data, response } = await wpRequest(authed, postsPath(page, status), { timeoutMs: 20000 })
    const posts = Array.isArray(data) ? data : []

    posts.forEach(post => {
      if (post?.id) events.push(post)
    })

    const totalPages = Number(response.headers.get('x-wp-totalpages') || response.headers.get('X-WP-TotalPages') || 1)

    if (!posts.length || page >= totalPages) break

    page += 1
  }

  return events
}

function rememberPosts(byId, posts) {
  posts.forEach(post => {
    if (post?.id) byId.set(post.id, post)
  })
}

async function loadSitePosts(authed) {
  const byId = new Map()

  try {
    rememberPosts(byId, await fetchWpPosts(authed, 'publish,future,draft,pending'))

    return { byId, failures: [] }
  } catch (error) {
    const status = Number(error?.status || 0)

    if (status === 401 || status === 403) {
      return { byId, failures: [{ statusName: 'combined', error }], authStatus: status }
    }

    if (status !== 400) return { byId, failures: [{ statusName: 'combined', error }], fatal: true }
  }

  const failures = []

  await Promise.all(
    ['publish', 'future', 'draft', 'pending'].map(async statusName => {
      try {
        rememberPosts(byId, await fetchWpPosts(authed, statusName))
      } catch (error) {
        failures.push({ statusName, error })
      }
    })
  )

  if (!byId.size) {
    try {
      rememberPosts(byId, await fetchWpPosts(authed, ''))
    } catch (error) {
      failures.push({ statusName: '', error })
    }
  }

  return { byId, failures }
}

function authHint(label, status) {
  if (status === 401) {
    return `${label}: WordPress returned 401 for this login. Published posts are still shown. Connect the site with the WordPress username and an Application Password (Users → Profile → Application Passwords). The normal account password and a display name such as Administrator do not authenticate.`
  }

  return `${label}: this login cannot read drafts or scheduled posts (HTTP ${status}). Published posts are still shown.`
}

async function eventsFromWordPress(sites, colors) {
  const events = []
  const warnings = []

  await Promise.all(
    sites.map(async site => {
      const authed = siteAuth(site)
      const label = site.label || site.siteKey
      const color = colors?.get(site.siteKey)
      const loaded = await loadSitePosts(authed)
      const byId = loaded.byId

      if (loaded.fatal) {
        warnings.push(`${label}: ${readableError(loaded.failures[0]?.error)}`)

        return
      }

      if (!byId.size && loaded.authStatus) {
        try {
          rememberPosts(byId, await fetchWpPosts({ ...authed, authorization: '' }, 'publish'))
          warnings.push(authHint(label, loaded.authStatus))
        } catch {
          try {
            rememberPosts(byId, await fetchWpPosts({ ...authed, authorization: '' }, ''))
            warnings.push(authHint(label, loaded.authStatus))
          } catch {
            warnings.push(`${label}: ${readableError(loaded.failures[0]?.error)}`)

            return
          }
        }
      } else if (!byId.size && loaded.failures.length) {
        warnings.push(`${label}: ${readableError(loaded.failures[0].error)}`)

        return
      } else if (byId.size) {
        const denied = loaded.failures.find(item => {
          const code = Number(item.error?.status || 0)

          return item.statusName && item.statusName !== 'publish' && (code === 401 || code === 403)
        })

        if (denied) warnings.push(authHint(label, Number(denied.error.status)))
        else if (loaded.authStatus) warnings.push(authHint(label, loaded.authStatus))
      }

      byId.forEach(post => events.push(wpPostToEvent(site, post, color)))
    })
  )

  return { events, warnings }
}

function parseWpRef(id) {
  const raw = String(id || '')

  if (!raw.startsWith('wp_')) return null

  const split = raw.lastIndexOf('_')
  const postId = raw.slice(split + 1)
  const siteKey = raw.slice(3, split)

  if (!siteKey || !/^\d+$/.test(postId)) return null

  return { siteKey, postId }
}

function wpHtml(post) {
  if (typeof post?.content === 'string') return post.content

  return String(post?.content?.raw || post?.content?.rendered || '')
}

async function readWpPost(authed, postId) {
  const editPath = `/wp-json/wp/v2/posts/${postId}?context=edit&_fields=id,title,status,date,content,link`
  const viewPath = `/wp-json/wp/v2/posts/${postId}?_fields=id,title,status,date,content,link`

  try {
    const loaded = await wpRequest(authed, editPath, { timeoutMs: 30000 })

    return loaded.data
  } catch (error) {
    if (Number(error?.status) !== 401 && Number(error?.status) !== 403) throw error
  }

  try {
    const loaded = await wpRequest(authed, viewPath, { timeoutMs: 30000 })

    return loaded.data
  } catch (error) {
    if (Number(error?.status) !== 401 && Number(error?.status) !== 403) throw error
  }

  const loaded = await wpRequest({ ...authed, authorization: '' }, viewPath, { timeoutMs: 30000 })

  return loaded.data
}

export async function GET(request) {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sites = await connectedSites(user, session)
    const colors = assignSiteColors(sites)
    const articleRef = new URL(request.url).searchParams.get('article')

    if (articleRef) {
      const ref = parseWpRef(articleRef)

      if (ref) {
        const site = sites.find(item => item.siteKey === ref.siteKey)

        if (!site) return NextResponse.json({ error: 'Article not found on a connected site.' }, { status: 404 })

        const data = await readWpPost(siteAuth(site), ref.postId)

        return NextResponse.json({
          article: {
            id: articleRef,
            title: wpPlainTitle(data),
            content: wpHtml(data),
            status: data?.status || '',
            siteKey: site.siteKey,
            wpPostId: Number(data?.id) || Number(ref.postId)
          }
        })
      }

      const article = await loadOwnedArticle(user.id, articleRef)

      if (!article || isOutlineLike(article)) {
        return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
      }

      return NextResponse.json({
        article: {
          id: article.id,
          title: article.title || 'Untitled article',
          content: article.content || '',
          status: article.status || '',
          siteKey: article.targetSite || '',
          wpPostId: article.wpPostId || null
        }
      })
    }

    const { events, warnings } = await eventsFromWordPress(sites, colors)
    const articles = await prisma.article.findMany({
      where: {
        userId: user.id,
        status: 'draft'
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, status: true, outline: true, publishMeta: true }
    })
    const drafts = articles.filter(article => !isOutlineLike(article) && !isHidden(article)).map(toDraftOption)

    return NextResponse.json({
      events,
      drafts,
      sites: publicSites(sites, colors),
      warnings
    })
  } catch (error) {
    console.error(error?.message || 'Calendar load failed')

    return NextResponse.json({ error: readableError(error) || 'Failed to load the calendar.' }, { status: 500 })
  }
}

async function saveWpPost(user, session, body) {
  const ref = parseWpRef(body.articleId || body.id)

  if (!ref) return null

  const calendar = body.calendar

  if (!ACTION_TYPES.includes(calendar)) {
    return NextResponse.json({ error: 'Choose Draft, Published, or Scheduled.' }, { status: 400 })
  }

  const sites = await connectedSites(user, session)
  const colors = assignSiteColors(sites)
  const site = sites.find(item => item.siteKey === String(body.siteKey || ref.siteKey))

  if (!site) return NextResponse.json({ error: 'Choose a connected WordPress site.' }, { status: 400 })

  let start = new Date()

  if (calendar === 'Scheduled') {
    start = asDate(body.start)

    if (!start || start.getTime() <= Date.now() + 60 * 1000) {
      return NextResponse.json({ error: 'Choose a time at least one minute in the future.' }, { status: 400 })
    }
  }

  const authed = siteAuth(site)
  const existing = await readWpPost(authed, ref.postId)
  const wpStatus = calendar === 'Scheduled' ? 'future' : calendar === 'Draft' ? 'draft' : 'publish'
  const html = String(body.content || '').trim() || wpHtml(existing)
  const payload = {
    title: wpPlainTitle(existing) || 'Untitled article',
    status: wpStatus
  }

  if (html) payload.content = html
  if (wpStatus === 'future') payload.date_gmt = toWpGmt(start)
  if (wpStatus === 'publish') payload.date_gmt = toWpGmt(new Date())

  const { data } = await wpRequest(authed, `/wp-json/wp/v2/posts/${ref.postId}`, {
    method: 'POST',
    payload,
    timeoutMs: 60000
  })

  return NextResponse.json({
    event: wpPostToEvent(site, { ...existing, ...data, content: html ? { rendered: html } : existing?.content, status: data?.status || wpStatus }, colors.get(site.siteKey))
  })
}

async function saveAction(user, session, body) {
  const wpSaved = await saveWpPost(user, session, body)

  if (wpSaved) return wpSaved

  const calendar = body.calendar
  const article = await loadOwnedArticle(user.id, body.articleId || body.id)

  if (!article || isOutlineLike(article)) {
    return NextResponse.json(
      { error: article ? 'Outlines cannot be placed on the calendar. Generate the article first.' : 'Article not found.' },
      { status: 400 }
    )
  }

  if (!ACTION_TYPES.includes(calendar)) {
    return NextResponse.json({ error: 'Choose Draft, Published, or Scheduled.' }, { status: 400 })
  }

  const sites = await connectedSites(user, session)
  const site = sites.find(item => item.siteKey === String(body.siteKey || ''))

  if (!site) {
    return NextResponse.json({ error: 'Add a WordPress site in the writer before scheduling.' }, { status: 400 })
  }

  const description = String(body.description || '').slice(0, 8000)

  if (calendar === 'Draft') {
    const start = asDate(article.createdAt) || new Date()
    const updated = await prisma.article.update({
      where: { id: article.id },
      data: {
        status: 'draft',
        targetSite: site.siteKey,
        scheduledAt: null,
        publishMeta: writeMeta(article, {
          calendar: 'Draft',
          start: start.toISOString(),
          end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
          description,
          siteKey: site.siteKey,
          hidden: false
        })
      }
    })

    return NextResponse.json({ event: toArticleEvent(updated) })
  }

  const gate = await assertCanGenerate({
    userId: user.id,
    email: session?.user?.email,
    featureKey: 'wp-publish',
    estimatedWords: 0
  })

  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status || 403 })

  let start = new Date()

  if (calendar === 'Scheduled') {
    start = asDate(body.start)

    if (!start) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
    if (start.getTime() <= Date.now() + 60 * 1000) {
      return NextResponse.json({ error: 'Scheduled posts must be at least one minute in the future.' }, { status: 400 })
    }
  }

  const wpStatus = calendar === 'Scheduled' ? 'future' : 'publish'
  const authed = siteAuth(site)
  const html = String(body.content || article.content || '').trim()
  const payload = {
    title: article.title || 'Untitled article',
    status: wpStatus
  }

  if (html) payload.content = html
  if (wpStatus === 'future') payload.date_gmt = toWpGmt(start)
  if (wpStatus === 'publish') payload.date_gmt = toWpGmt(new Date())

  const path = article.wpPostId ? `/wp-json/wp/v2/posts/${article.wpPostId}` : '/wp-json/wp/v2/posts'
  let wpPostId = article.wpPostId || null

  try {
    const { data } = await wpRequest(authed, path, { method: 'POST', payload, timeoutMs: 60000 })

    wpPostId = Number(data?.id) || wpPostId
    if (!wpPostId) throw new Error('WordPress did not return a post id.')
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      status: calendar === 'Scheduled' ? 'scheduled' : 'published',
      wpPostId: Number(wpPostId),
      targetSite: site.siteKey,
      scheduledAt: calendar === 'Scheduled' ? start : null,
      publishMeta: writeMeta(article, {
        calendar,
        start: start.toISOString(),
        end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
        description,
        siteKey: site.siteKey,
        hidden: false
      })
    }
  })

  return NextResponse.json({ event: toArticleEvent(updated) })
}

async function moveEvent(user, session, body) {
  const ref = parseWpRef(body.articleId || body.id)

  if (ref) {
    const start = asDate(body.start)

    if (!start || start.getTime() <= Date.now() + 60 * 1000) {
      return NextResponse.json({ error: 'Choose a time at least one minute in the future.' }, { status: 400 })
    }

    const sites = await connectedSites(user, session)
    const colors = assignSiteColors(sites)
    const site = sites.find(item => item.siteKey === String(body.siteKey || ref.siteKey))

    if (!site) return NextResponse.json({ error: 'Choose a connected WordPress site.' }, { status: 400 })

    const authed = siteAuth(site)
    const existing = await readWpPost(authed, ref.postId)

    if (laneForWpStatus(existing?.status) !== 'Scheduled') {
      return NextResponse.json(
        { error: 'Open the article and choose Published, Draft, or Scheduled. Dragging does not republish it.' },
        { status: 400 }
      )
    }

    const { data } = await wpRequest(authed, `/wp-json/wp/v2/posts/${ref.postId}`, {
      method: 'POST',
      payload: { date_gmt: toWpGmt(start) },
      timeoutMs: 60000
    })

    return NextResponse.json({
      event: wpPostToEvent(site, { ...existing, ...data, status: data?.status || 'future' }, colors.get(site.siteKey))
    })
  }

  const article = await loadOwnedArticle(user.id, body.articleId || body.id)

  if (!article || isOutlineLike(article)) {
    return NextResponse.json({ error: article ? 'Outlines cannot be moved on the calendar.' : 'Article not found.' }, { status: 400 })
  }

  const start = asDate(body.start)

  if (!start) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
  if (start.getTime() <= Date.now() + 60 * 1000) {
    return NextResponse.json({ error: 'Choose a time at least one minute in the future.' }, { status: 400 })
  }

  const scheduled = String(article.status || '').toLowerCase() === 'scheduled'

  if (scheduled && article.wpPostId) {
    const sites = await connectedSites(user, session)
    const site = sites.find(item => item.siteKey === (article.targetSite || body.siteKey || ''))

    if (!site) {
      return NextResponse.json({ error: 'Add a WordPress site in the writer before scheduling.' }, { status: 400 })
    }

    try {
      await wpRequest(siteAuth(site), `/wp-json/wp/v2/posts/${article.wpPostId}`, {
        method: 'POST',
        payload: { date_gmt: toWpGmt(start) }
      })
    } catch (error) {
      return NextResponse.json({ error: readableError(error) }, { status: 400 })
    }
  }

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      scheduledAt: scheduled ? start : article.scheduledAt,
      publishMeta: writeMeta(article, {
        start: start.toISOString(),
        end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
        hidden: false
      })
    }
  })

  return NextResponse.json({ event: toArticleEvent(updated) })
}

async function writeEvent(request) {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const intent = body.intent === 'move' ? 'move' : 'action'

    if (intent === 'move') return moveEvent(user, session, body)

    return saveAction(user, session, body)
  } catch (error) {
    console.error(error?.message || 'Calendar save failed')

    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }
}

export async function POST(request) {
  return writeEvent(request)
}

export async function PUT(request) {
  return writeEvent(request)
}

export async function DELETE(request) {
  try {
    const { user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const article = await loadOwnedArticle(user.id, new URL(request.url).searchParams.get('id'))

    if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 400 })

    await prisma.article.update({
      where: { id: article.id },
      data: { publishMeta: writeMeta(article, { hidden: true }) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error?.message || 'Calendar hide failed')

    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }
}

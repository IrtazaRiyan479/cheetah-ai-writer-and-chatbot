import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

import { escapeHtml, finalizeArticleHtml } from '../generate/utils/articleHtml'

export const maxDuration = 60

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

async function readWp(res, fallback) {
  const raw = await res.text().catch(() => '')
  let data = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data ? wpMessage(data, res.status, fallback) : `WordPress HTTP ${res.status}: ${(raw || fallback).slice(0, 300)}`)
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

async function uploadImageToWP(imageUrl, siteUrl, credentials, articleTitle) {
  const imageResponse = await wpFetch(imageUrl, {})

  if (!imageResponse.ok) {
    throw new Error(`Could not download hero image. HTTP ${imageResponse.status}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  if (!imageBuffer.length) throw new Error('Hero image download was empty.')

  const mimeType = (imageResponse.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const filename = `hero-${Date.now()}.${extension}`
  const mediaRes = await wpFetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': mimeType
    },
    body: imageBuffer
  })
  const mediaData = await readWp(mediaRes, 'Media upload failed. Check the application password can upload files.')

  if (!mediaData.id) throw new Error(wpMessage(mediaData, mediaRes.status, 'Media upload did not return an id.'))

  const alt = articleTitle || 'Featured Image'
  const altRes = await wpFetch(`${siteUrl}/wp-json/wp/v2/media/${mediaData.id}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: alt, alt_text: alt, caption: '' })
  })

  await readWp(altRes, 'Uploaded the image but could not set alt text.')

  return { id: mediaData.id, sourceUrl: mediaData.source_url || imageUrl }
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
    const { title, content, status, siteType, siteId, customSite, featuredImageUrl, metaTitle, metaDescription, language } =
      body

    let siteUrl, wpUsername, wpPassword

    if (siteType === 'predefined') {
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
    }

    if (!siteUrl || !wpUsername || !wpPassword) {
      throw new Error('WordPress site URL, username, and application password are required.')
    }

    const cleanSiteUrl = normalizeWpSiteUrl(siteUrl)
    const appPassword = String(wpPassword).replace(/\s+/g, '')
    const credentials = Buffer.from(`${wpUsername}:${appPassword}`).toString('base64')
    const authHeaders = { Authorization: `Basic ${credentials}` }

    let featuredMediaId = null
    let heroSrc = featuredImageUrl || ''

    if (featuredImageUrl) {
      const uploaded = await uploadImageToWP(featuredImageUrl, cleanSiteUrl, credentials, title)

      featuredMediaId = uploaded.id
      heroSrc = uploaded.sourceUrl || featuredImageUrl
    }

    const masterStyles = `<style id="cheetah-master-styles">#cheetah-article-wrapper{line-height:1.7;font-family:system-ui,-apple-system,sans-serif}#cheetah-article-wrapper table{width:100%!important;table-layout:auto!important;border-collapse:separate!important;border-spacing:0!important;margin:32px 0!important;border-radius:10px!important;border:1px solid #1e40af!important;background-color:#ffffff!important;box-shadow:0 4px 12px -2px rgba(0,0,0,0.03)!important}#cheetah-article-wrapper th,#cheetah-article-wrapper td{padding:18px 24px!important;vertical-align:top!important;border-bottom:1px solid #e5e7eb!important;border-right:1px solid #e5e7eb!important;text-align:left!important;word-wrap:break-word!important}#cheetah-article-wrapper th:last-child,#cheetah-article-wrapper td:last-child{border-right:none!important}#cheetah-article-wrapper tr:last-child td{border-bottom:none!important}#cheetah-article-wrapper th:first-child{border-top-left-radius:9px!important}#cheetah-article-wrapper th:last-child{border-top-right-radius:9px!important}#cheetah-article-wrapper tr:last-child td:first-child{border-bottom-left-radius:9px!important}#cheetah-article-wrapper tr:last-child td:last-child{border-bottom-right-radius:9px!important}#cheetah-article-wrapper th{background:#ffffff!important;color:#1e40af!important;font-weight:700!important;font-size:15px!important;text-transform:uppercase!important;letter-spacing:0.05em!important}#cheetah-article-wrapper td{font-size:16px!important;color:#374151!important;line-height:1.6!important}#cheetah-article-wrapper a.cta-button{text-decoration:none!important;background-color:#6366f1!important;color:#ffffff!important;font-weight:700!important;padding:12px 26px!important;border-radius:9999px!important;display:inline-block!important;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1)!important;border:1px solid #4f46e5!important}#cheetah-article-wrapper img{border-radius:12px!important;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)!important;max-width:100%!important;height:auto!important}@media (max-width:640px){#cheetah-article-wrapper .product-name-desktop{display:none!important}#cheetah-article-wrapper .product-name-mobile{display:inline!important;font-size:13px!important;line-height:1.3!important}#cheetah-article-wrapper table.affigenie-table td:first-child{width:auto!important;min-width:0!important;max-width:none!important}#cheetah-article-wrapper table td:first-child img{width:80px!important;height:80px!important;max-width:80px!important;object-fit:contain!important}#cheetah-article-wrapper a.cta-button{padding:8px 12px!important;font-size:12px!important}}#cheetah-article-wrapper table img{width:80px!important;height:auto!important;max-width:90px!important;margin:0!important;box-shadow:none!important;aspect-ratio:auto!important}.check-price-btn{display:inline-block!important;background-color:#6366f1!important;color:#fff!important;font-weight:700!important;padding:10px 24px!important;border-radius:9999px!important;text-decoration:none!important;transition:background-color .2s,transform .2s!important}.check-price-btn:hover{background-color:#4f46e5!important;transform:translateY(-1px)!important}table{width:100%!important;max-width:100%!important;border-collapse:collapse!important;margin:24px 0!important;display:table!important;overflow:visible!important}td,th{word-break:normal;white-space:normal}</style>`

    const articleHtml = finalizeArticleHtml(content || '', {
      language,
      partnerTag: process.env.AMAZON_PARTNER_TAG || '',
      domain: 'www.amazon.com'
    })

    const heroHtml =
      heroSrc && !String(articleHtml).includes(heroSrc)
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
      status: status || 'draft',
      meta: {
        meta_title: metaTitle || '',
        meta_description: metaDescription || '',

        rank_math_title: metaTitle || '',
        rank_math_description: metaDescription || '',

        _yoast_wpseo_title: metaTitle || '',
        _yoast_wpseo_metadesc: metaDescription || ''
      }
    }

    if (featuredMediaId) {
      postPayload.featured_media = featuredMediaId
    }

    const response = await wpFetch(`${cleanSiteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    })
    const data = await readWp(response, 'Failed to publish to WordPress')

    if (!data.id) throw new Error(wpMessage(data, response.status, 'WordPress did not return a post id.'))

    if (featuredMediaId && Number(data.featured_media) !== Number(featuredMediaId)) {
      const retry = await wpFetch(`${cleanSiteUrl}/wp-json/wp/v2/posts/${data.id}`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured_media: featuredMediaId })
      })
      const retried = await readWp(retry, 'Could not attach the featured image')
      let featured = Number(retried.featured_media)

      if (featured !== Number(featuredMediaId)) {
        const readBack = await wpFetch(
          `${cleanSiteUrl}/wp-json/wp/v2/posts/${data.id}?_fields=id,featured_media,link`,
          { headers: authHeaders }
        )
        const confirmed = await readWp(readBack, 'Could not read the published post back')

        featured = Number(confirmed.featured_media)
      }

      if (featured !== Number(featuredMediaId)) {
        throw new Error(
          `WordPress post ${data.id} was created, but featured_media is still missing after one retry.`
        )
      }
    }

    const editLink = `${cleanSiteUrl}/wp-admin/post.php?post=${data.id}&action=edit`

    return NextResponse.json({
      success: true,
      wpPostId: data.id,
      link: data.link,
      editLink,
      status: postPayload.status,
      featuredMediaId
    })
  } catch (error) {
    console.error('WordPress API Error:', serializeError(error))

    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

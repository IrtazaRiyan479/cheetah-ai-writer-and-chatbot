import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request) {
  try {
    const body = await request.json()
    let { siteUrl, sourceUrl, targetUrl, anchorText, customUsername, customPassword } = body

    let wpUsername = customUsername
    let wpPassword = customPassword

    if (!wpUsername || !wpPassword) {
      const predefinedSites = JSON.parse(process.env.PREDEFINED_WP_SITES || '[]')

      // DEFENSIVE CAST
      const normalizeStr = (str) => {
        if (!str) return '';
        return String(str).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
      }

      const normalizedInput = normalizeStr(siteUrl)

      const matchedSite = predefinedSites.find(site => {
        const normalizedSiteUrl = normalizeStr(site.url)
        const siteName = site.name ? String(site.name).toLowerCase() : ''

        return normalizedSiteUrl.includes(normalizedInput) ||
               normalizedInput.includes(normalizedSiteUrl) ||
               (siteName && normalizedInput.includes(siteName.replace(/\s+/g, '')))
      })

      if (matchedSite) {
        wpUsername = matchedSite.username
        wpPassword = matchedSite.password
        siteUrl = matchedSite.url
      } else {
        return NextResponse.json({ success: false, requiresAuth: true, message: 'Custom credentials required.' }, { status: 401 })
      }
    }

    // DEFENSIVE CAST
    const cleanSiteUrl = String(siteUrl || '').replace(/\/$/, '')
    const credentials = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')

    const urlObj = new URL(sourceUrl)
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)
    let slug = pathSegments.length > 0 ? pathSegments.pop() : null

    if (slug) {
      slug = String(slug).replace(/\.[^/.]+$/, "")
    }

    if (!slug) {
      return NextResponse.json({ success: false, message: `Skipped: Cannot inject links directly into the homepage via the REST API.` })
    }

    let findResponse = await fetch(`${cleanSiteUrl}/wp-json/wp/v2/posts?slug=${slug}`, {
      headers: { 'Authorization': `Basic ${credentials}` }
    })

    if (!findResponse.ok) throw new Error('Failed to connect to WordPress API.')

    let foundItems = await findResponse.json()
    let endpointType = 'posts'

    if (!foundItems || foundItems.length === 0) {
      findResponse = await fetch(`${cleanSiteUrl}/wp-json/wp/v2/pages?slug=${slug}`, {
        headers: { 'Authorization': `Basic ${credentials}` }
      })
      foundItems = await findResponse.json()
      endpointType = 'pages'
    }

    if (!foundItems || foundItems.length === 0) {
      throw new Error(`WordPress item with slug "${slug}" not found. Ensure it is a published Post or Page.`)
    }

    const sourceItemId = foundItems[0].id
    const htmlContent = foundItems[0].content.rendered

    const $ = cheerio.load(htmlContent, null, false)
    let linkInjected = false
    let usedFallback = false

    // DEFENSIVE CAST: Prevents weird text crashes
    const safeAnchor = String(anchorText || '').trim();
    const escapedAnchor = safeAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b(${escapedAnchor.replace(/\\s+/g, '\\s+')})\\b`, 'i')

    $('p, li, h2, h3, h4, h5, h6, span').each((i, elem) => {
      if (linkInjected) return false

      const elementText = $(elem).html()

      if (regex.test(elementText) && !elementText.includes(`>${safeAnchor}<`)) {
        const updatedHtml = elementText.replace(regex, `<a href="${targetUrl}">$1</a>`)
        $(elem).html(updatedHtml)
        linkInjected = true
      }
    })

    if (!linkInjected) {
      const titleCaseAnchor = safeAnchor.replace(/\b\w/g, char => char.toUpperCase());
      const fallbackHtml = `\n<p><strong>Related:</strong> <a href="${targetUrl}">${titleCaseAnchor}</a></p>\n`
      const lastParagraph = $('p').last()

      if (lastParagraph.length > 0) {
        lastParagraph.after(fallbackHtml)
      } else {
        $.root().append(fallbackHtml)
      }
      linkInjected = true
      usedFallback = true
    }

    const finalContent = $.html()

    const updateResponse = await fetch(`${cleanSiteUrl}/wp-json/wp/v2/${endpointType}/${sourceItemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({ content: finalContent })
    })

    const updatedData = await updateResponse.json()

    if (updatedData.id) {
      if (usedFallback) {
        return NextResponse.json({ success: true, message: 'Text missing. Injected as a "Related" link at the bottom.' })
      }
      return NextResponse.json({ success: true, message: 'Link successfully injected in-text.' })
    } else {
      throw new Error('Failed to save the updated post in WordPress.')
    }

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

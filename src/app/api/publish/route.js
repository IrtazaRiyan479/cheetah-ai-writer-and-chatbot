import { NextResponse } from 'next/server'

async function uploadImageToWP(imageUrl, siteUrl, credentials) {
  try {

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error('Could not fetch the image URL')

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())


    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const extension = mimeType.split('/')[1] || 'jpg'
    const filename = `hero-image-${Date.now()}.${extension}`


    const wpMediaResponse = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': mimeType
      },
      body: imageBuffer
    })

    const mediaData = await wpMediaResponse.json()
    return mediaData.id ? mediaData.id : null

  } catch (error) {
    console.error("WP Media Upload Error:", error)
    return null
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { title, content, status, siteType, siteId, customSite, featuredImageUrl, metaTitle, metaDescription } = body

    let siteUrl, wpUsername, wpPassword;

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

    const cleanSiteUrl = siteUrl.replace(/\/$/, '')
    const credentials = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')


    let featuredMediaId = null;
    if (featuredImageUrl) {
      featuredMediaId = await uploadImageToWP(featuredImageUrl, cleanSiteUrl, credentials)
    }

    const masterStyles = `
<style id="cheetah-master-styles">
  #cheetah-article-wrapper { line-height: 1.6; font-family: 'Inter', sans-serif; }

  /* Force Table Styles */
  #cheetah-article-wrapper tbody {border: none !important;}
  #cheetah-article-wrapper table { width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 32px 0 !important; border-radius: 12px !important; border: 1px solid rgba(38, 43, 67, 0.12) !important; overflow: hidden !important; }
  #cheetah-article-wrapper th, #cheetah-article-wrapper td { padding: 16px !important; vertical-align: middle !important; border-bottom: 1px solid rgba(38, 43, 67, 0.12) !important; color: rgba(38, 43, 67, 0.7) !important; border:none !important; }
  #cheetah-article-wrapper th { background-color: rgba(38, 43, 67, 0.04) !important; font-weight: 700 !important; color: rgba(38, 43, 67, 0.9) !important; text-align: left !important; border: none !important; }

  /* Force Button Styles */
  #cheetah-article-wrapper a.cta-button { text-decoration: none !important; background-color: #6366f1 !important; color: #ffffff !important; font-weight: 700 !important; padding: 12px 28px !important; border-radius: 9999px !important; display: inline-block !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important; border: 1px solid #4f46e5 !important; text-align: center !important; }
  #cheetah-article-wrapper .button-container { text-align: center !important; margin: 25px 0 !important; width: 100% !important; }

  /* Force Image/Media Styles */
  #cheetah-article-wrapper img { border-radius: 12px !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1) !important; }
</style>
`;

const finalContent = `
  <div id="cheetah-article-wrapper">
    ${masterStyles}
    ${content}
  </div>
`;

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


    const response = await fetch(`${cleanSiteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(postPayload)
    })

    const data = await response.json()

    if (data.id) {
        return NextResponse.json({ success: true, wpPostId: data.id, link: data.link })
    } else {
        throw new Error(data.message || 'Failed to publish to WordPress')
    }

  } catch (error) {
    console.error('WordPress API Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

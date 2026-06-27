import { NextResponse } from 'next/server'

// Helper function to upload an image URL to WordPress Media Library
async function uploadImageToWP(imageUrl, siteUrl, credentials) {
  try {
    // 1. Fetch the image from the provided URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error('Could not fetch the image URL')

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // 2. Extract mime type and create a filename
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'
    const extension = mimeType.split('/')[1] || 'jpg'
    const filename = `hero-image-${Date.now()}.${extension}`

    // 3. Upload to WP Media Library
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
    return null // Return null so the post still publishes even if the image fails
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { title, content, status, siteType, siteId, customSite, featuredImageUrl } = body

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

    // 1. Handle Featured Image Upload (If provided)
    let featuredMediaId = null;
    if (featuredImageUrl) {
      featuredMediaId = await uploadImageToWP(featuredImageUrl, cleanSiteUrl, credentials)
    }

    // 2. Prepare Post Payload
    const postPayload = {
      title: title || 'Untitled AI Article', // Fallback to prevent "(no title)"
      content: content,
      status: status || 'draft'
    }

    // 3. Attach image if successful
    if (featuredMediaId) {
      postPayload.featured_media = featuredMediaId
    }

    // 4. Push to WordPress
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

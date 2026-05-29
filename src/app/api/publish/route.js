import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { title, content, status } = await request.json()

    // WordPress Basic Auth format: "username:application_password"
    // IMPORTANT: Change 'admin' below to your actual WordPress username
    const credentials = Buffer.from(`admin:${process.env.WP_APP_PASSWORD}`).toString('base64')

    const response = await fetch(`${process.env.WP_SITE_URL}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify({
        title: title,
        content: content,
        status: status || 'draft' // Default to draft for safety!
      })
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

import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 })
    }

    // TinyPNG requires Basic Auth with "api:" as the username
    const credentials = Buffer.from(`api:${process.env.TINYPNG_API_KEY}`).toString('base64')

    const response = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ source: { url: imageUrl } })
    })

    const data = await response.json()

    // TinyPNG returns the compressed image URL in the "output.url" field
    return NextResponse.json({ success: true, compressedUrl: data.output.url })

  } catch (error) {
    console.error('TinyPNG Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compress image' }, { status: 500 })
  }
}

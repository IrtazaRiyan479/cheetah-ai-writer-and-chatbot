import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { keyword } = await request.json()

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
    }

    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`, {
      method: 'GET',
      headers: {
        'Authorization': `Client-ID ${process.env.UNSPLASH_API_KEY}`
      }
    })

    const data = await response.json()
    const imageUrl = data.results[0]?.urls?.regular || null
    const attribution = data.results[0]?.user?.name || ''

    return NextResponse.json({ success: true, imageUrl, attribution })

  } catch (error) {
    console.error('Unsplash API Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch image' }, { status: 500 })
  }
}

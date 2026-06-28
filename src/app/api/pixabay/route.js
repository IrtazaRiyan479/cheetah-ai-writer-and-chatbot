import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { keyword } = await request.json()
    if (!keyword) return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })

    const response = await fetch(`https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(keyword)}&image_type=photo&per_page=3`)
    const data = await response.json()
    const imageUrl = data.hits?.[0]?.largeImageURL || null
    const attribution = data.hits?.[0]?.user || ''

    return NextResponse.json({ success: true, imageUrl, attribution })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch Pixabay image' }, { status: 500 })
  }
}

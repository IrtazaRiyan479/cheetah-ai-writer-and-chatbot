import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { keyword } = await request.json()
    if (!keyword) return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })

    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`, {
      method: 'GET',
      headers: { 'Authorization': process.env.PEXELS_API_KEY }
    })

    const data = await response.json()
    const imageUrl = data.photos?.[0]?.src?.large || null
    const attribution = data.photos?.[0]?.photographer || ''

    return NextResponse.json({ success: true, imageUrl, attribution })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch Pexels image' }, { status: 500 })
  }
}

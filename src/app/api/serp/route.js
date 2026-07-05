import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en' })
    })

    const data = await response.json()

    return NextResponse.json({
      success: true,
      organic: data.organic || [],
      peopleAlsoAsk: data.peopleAlsoAsk || []
    })

  } catch (error) {
    console.error('Serper API Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch SERP data' }, { status: 500 })
  }
}

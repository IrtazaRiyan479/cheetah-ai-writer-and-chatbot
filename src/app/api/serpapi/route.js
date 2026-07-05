import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()

    const query = body.query || 'Coffee'

    const url = new URL('https://serpapi.com/search.json')
    url.searchParams.append('engine', 'bing')
    url.searchParams.append('q', query)
    url.searchParams.append('cc', 'US')
    url.searchParams.append('api_key', process.env.SERP_API_KEY)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const rawData = await response.json()

    return NextResponse.json(rawData)

  } catch (error) {
    console.error('SerpApi Error:', error)
    return NextResponse.json({ error: 'Failed to fetch SerpApi data' }, { status: 500 })
  }
}

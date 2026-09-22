import { NextResponse } from 'next/server'

import { callGroq } from '../generate/utils/lightLLM'

export async function POST(request) {
  try {
    const { prompt, system, json = false, model } = await request.json()

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ success: false, error: 'GROQ_API_KEY not set' }, { status: 503 })
    }

    const text = await callGroq({ prompt, system, json, model })

    if (!text) {
      return NextResponse.json({ success: false, error: 'Groq request failed' }, { status: 502 })
    }

    return NextResponse.json({ success: true, provider: 'groq', text })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Groq error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

import { callMistral } from '../generate/utils/lightLLM'

export async function POST(request) {
  try {
    const { prompt, system, json = false, model } = await request.json()

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 })
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json({ success: false, error: 'MISTRAL_API_KEY not set' }, { status: 503 })
    }

    const text = await callMistral({ prompt, system, json, model })

    if (!text) {
      return NextResponse.json({ success: false, error: 'Mistral request failed' }, { status: 502 })
    }

    return NextResponse.json({ success: true, provider: 'mistral', text })
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Mistral error' }, { status: 500 })
  }
}

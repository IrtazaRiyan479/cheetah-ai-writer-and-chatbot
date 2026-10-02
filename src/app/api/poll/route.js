import { NextResponse } from 'next/server'

import { withGeminiKey } from '@/app/api/generate/utils/geminiKeys'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    const interaction = await withGeminiKey(async apiKey => {
      const ai = new GoogleGenAI({ apiKey })
      return ai.interactions.get(id)
    })

    if (interaction.status === 'completed') {
      return NextResponse.json({ status: 'completed', text: interaction.output_text })
    } else if (interaction.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'Deep search failed.' })
    }

    return NextResponse.json({ status: 'processing' })
  } catch (error) {
    console.error('Polling Error:', error)

    return NextResponse.json({ status: 'failed', error: error.message })
  }
}

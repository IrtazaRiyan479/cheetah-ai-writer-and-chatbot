import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

import { interactionUsesPaidKeys, withGeminiKey } from '@/app/api/generate/utils/geminiKeys'
import { runWithPaidKeys } from '@/app/api/generate/utils/providerKeys'
import { paidKeysEnabledFor } from '@/libs/entitlement'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  try {
    const usePaidKeys = interactionUsesPaidKeys(id) || (await paidKeysEnabledFor(['deep-search']))
    return await runWithPaidKeys(usePaidKeys, async () => {
    const interaction = await withGeminiKey(async apiKey => {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 0 } }
      })
      return ai.interactions.get(id)
    })

    if (interaction.status === 'completed') {
      return NextResponse.json({ status: 'completed', text: interaction.output_text })
    } else if (interaction.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'Deep search failed.' })
    }

    return NextResponse.json({ status: 'processing' })
    })
  } catch (error) {
    console.error('Polling Error:', error)

    return NextResponse.json({ status: 'failed', error: error.message })
  }
}

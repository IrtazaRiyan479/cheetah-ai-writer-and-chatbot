import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

import { interactionUsesPaidKeys, withGeminiKey } from '@/app/api/generate/utils/geminiKeys'
import { pollDeepSearch } from '@/app/api/generate/utils/deepSearch'
import { finalizeSectionLinks, takeSectionLinkPool, enforceInternalLink, stripModelMediaEmbeds } from '@/app/api/generate/utils/helpers'
import { runWithPaidKeys } from '@/app/api/generate/utils/providerKeys'
import { paidKeysEnabledFor } from '@/libs/entitlement'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

  const finish = text => {
    const saved = takeSectionLinkPool(id)
    let output = stripModelMediaEmbeds(text || '')

    if (saved.internalLink) output = enforceInternalLink(output, saved.internalLink)
    output = finalizeSectionLinks(output, saved)

    return NextResponse.json({ status: 'completed', text: output })
  }

  try {
    const usePaidKeys = interactionUsesPaidKeys(id) || (await paidKeysEnabledFor(['deep-search']))

    if (id.startsWith('oa:') || id.startsWith('xai:')) {
      const polled = await pollDeepSearch(id, { paid: usePaidKeys })

      if (polled?.status === 'completed') return finish(polled.text)
      if (polled?.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: polled.error || 'Deep search failed.' })
      }

      return NextResponse.json({ status: 'processing' })
    }

    return await runWithPaidKeys(usePaidKeys, async () => {
    const interaction = await withGeminiKey(async apiKey => {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 0 } }
      })
      return ai.interactions.get(id)
    })

    if (interaction.status === 'completed') return finish(interaction.output_text || '')
    if (interaction.status === 'failed') return NextResponse.json({ status: 'failed', error: 'Deep search failed.' })

    return NextResponse.json({ status: 'processing' })
    })
  } catch (error) {
    console.error('Polling Error:', error)

    return NextResponse.json({ status: 'failed', error: error.message })
  }
}

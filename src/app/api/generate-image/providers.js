import { serializeError } from '@/utils/serializeError'
import { listGeminiApiKeys, withGeminiKey } from '@/app/api/generate/utils/geminiKeys'
import { listProviderKeys, resolvePaidTier, withProviderKey } from '@/app/api/generate/utils/providerKeys'
import { geminiImageSize, openAiSize } from '@/configs/imageModels'

const TIMEOUT_MS = 120000

function providerEnvName(provider) {
  if (provider === 'xai') return 'XAI'
  if (provider === 'openai') return 'OPENAI'

  return ''
}

function keysFor(provider) {
  const name = providerEnvName(provider)
  const paid = resolvePaidTier()

  const freeKeys = listProviderKeys(`${name}_API_KEYS`, {
    numberedPrefix: `${name}_API_KEY_`,
    legacySingles: [`${name}_API_KEY`]
  })
  const paidKeys = listProviderKeys(`${name}_PAID_API_KEYS`, {
    numberedPrefix: `${name}_PAID_API_KEY_`,
    legacySingles: [`${name}_PAID_API_KEY`]
  })

  if (paid && paidKeys.length) return paidKeys
  if (freeKeys.length) return freeKeys

  return paid ? paidKeys : freeKeys
}

function httpError(status, data) {
  const error = new Error(`HTTP ${status}: ${serializeError(data?.error || data)}`)

  error.status = status

  return error
}

async function postJson(url, apiKey, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) throw httpError(response.status, data)

  return data
}

function cleanBase64(value) {
  const text = String(value || '').trim()
  const comma = text.indexOf(',')

  if (text.startsWith('data:') && comma > 0) return text.slice(comma + 1).replace(/\s/g, '')

  return text.replace(/\s/g, '')
}

async function imageFromPayload(data) {
  const item = Array.isArray(data?.data) ? data.data.find(entry => entry?.b64_json || entry?.url) : null

  if (item?.b64_json) {
    return { base64: cleanBase64(item.b64_json), mime: item.mime_type || 'image/png' }
  }

  if (item?.url) {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(60000) })

    if (!response.ok) throw new Error(`Image download failed (HTTP ${response.status}).`)

    const mime = (response.headers.get('content-type') || item.mime_type || 'image/png').split(';')[0].trim()
    const base64 = Buffer.from(await response.arrayBuffer()).toString('base64')

    return { base64, mime: mime || 'image/png' }
  }

  throw new Error('The model returned no image.')
}

function isParameterError(error) {
  return error?.status === 400 && /quality|resolution|size|output_format|aspect_ratio|response_format|unknown|unexpected|not supported|invalid_request|extra/i.test(serializeError(error))
}

function xaiBody(selected, prompt, aspect, reference, lossless, { quality, resolution }) {
  const body = {
    model: selected.id,
    prompt,
    n: 1,
    response_format: 'b64_json',
    aspect_ratio: aspect
  }

  if (resolution) body.resolution = lossless ? '2k' : '1k'
  if (quality && selected.quality) body.quality = lossless ? 'medium' : 'low'
  if (reference) body.image = { url: reference.dataUri, type: 'image_url' }

  return body
}

async function generateXai(selected, prompt, aspect, reference, lossless) {
  const keys = keysFor('xai')

  if (!keys.length) throw new Error('xAI API key is not configured.')

  return withProviderKey(
    keys,
    async apiKey => {
      const endpoint = reference ? 'https://api.x.ai/v1/images/edits' : 'https://api.x.ai/v1/images/generations'
      const attempts = [
        { quality: true, resolution: true },
        { quality: false, resolution: true },
        { quality: false, resolution: false }
      ]
      let lastError

      for (const attempt of attempts) {
        try {
          const data = await postJson(endpoint, apiKey, xaiBody(selected, prompt, aspect, reference, lossless, attempt))

          return imageFromPayload(data)
        } catch (error) {
          lastError = error
          if (!isParameterError(error)) throw error
        }
      }

      throw lastError
    },
    'xai-image'
  )
}

async function openAiOnce(apiKey, selected, prompt, size, quality, reference) {
  if (!reference) {
    const data = await postJson('https://api.openai.com/v1/images/generations', apiKey, {
      model: selected.id,
      prompt,
      size,
      quality,
      output_format: 'png',
      n: 1
    })

    return imageFromPayload(data)
  }

  const form = new FormData()

  form.set('model', selected.id)
  form.set('prompt', prompt)
  form.set('size', size)
  form.set('quality', quality)
  form.set('output_format', 'png')
  form.set('n', '1')

  const ext = reference.mime === 'image/webp' ? 'webp' : reference.mime === 'image/jpeg' ? 'jpg' : 'png'
  const bytes = Buffer.from(reference.base64, 'base64')

  form.set('image', new Blob([bytes], { type: reference.mime }), `reference.${ext}`)

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) throw httpError(response.status, data)

  return imageFromPayload(data)
}

async function generateOpenAI(selected, prompt, aspect, reference, lossless) {
  const keys = keysFor('openai')

  if (!keys.length) throw new Error('OpenAI API key is not configured.')

  const size = openAiSize(aspect)
  const qualities = lossless ? ['high', 'medium', 'auto'] : ['medium', 'low', 'auto']

  return withProviderKey(
    keys,
    async apiKey => {
      let lastError

      for (const quality of qualities) {
        try {
          return await openAiOnce(apiKey, selected, prompt, size, quality, reference)
        } catch (error) {
          lastError = error
          if (!isParameterError(error)) throw error
        }
      }

      throw lastError
    },
    'openai-image'
  )
}

function extractGeminiImage(data) {
  const blocks = []

  if (data?.output_image) blocks.push(data.output_image)
  if (Array.isArray(data?.output_image)) blocks.push(...data.output_image)

  const steps = []
    .concat(data?.steps || [])
    .concat(data?.outputs || [])

  for (const step of steps) {
    const content = step?.content || step?.parts || []

    if (Array.isArray(content)) blocks.push(...content)
    if (step?.type === 'image') blocks.push(step)
  }

  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) blocks.push(part)
  }

  for (const block of blocks) {
    const inline = block?.inlineData || block?.inline_data
    const raw = block?.data || inline?.data

    if (!raw) continue
    if (block?.type && block.type !== 'image' && !inline) continue

    const mime = block?.mime_type || block?.mimeType || inline?.mimeType || inline?.mime_type || 'image/png'

    return { base64: cleanBase64(raw), mime }
  }

  return null
}

async function readJsonResponse(response) {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) throw httpError(response.status, data)

  return data
}

async function geminiInteractions(apiKey, selected, prompt, aspect, reference, lossless) {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/interactions')

  url.searchParams.set('key', apiKey)

  const input = reference
    ? [
        { type: 'text', text: prompt },
        { type: 'image', data: reference.base64, mime_type: reference.mime }
      ]
    : prompt

  let current = await readJsonResponse(
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model: selected.id,
        input,
        response_format: {
          type: 'image',
          mime_type: 'image/png',
          aspect_ratio: aspect,
          image_size: geminiImageSize(selected, lossless)
        }
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
  )

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const image = extractGeminiImage(current)

    if (image?.base64) return image

    const status = String(current?.status || '').toLowerCase()

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(serializeError(current?.error || 'Gemini image generation failed.'))
    }

    if (!current?.id || !['pending', 'processing', 'in_progress', 'running', 'queued'].includes(status)) break

    await new Promise(resolve => setTimeout(resolve, 1500))

    const pollUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(current.id)}`)

    pollUrl.searchParams.set('key', apiKey)
    current = await readJsonResponse(
      await fetch(pollUrl, {
        headers: { 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(30000)
      })
    )
  }

  const image = extractGeminiImage(current)

  if (!image?.base64) throw new Error('Gemini returned no image.')

  return image
}

async function geminiGenerateContent(apiKey, selected, prompt, aspect, reference) {
  const parts = [{ text: prompt }]

  if (reference) parts.push({ inlineData: { mimeType: reference.mime, data: reference.base64 } })

  const send = async generationConfig => {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected.id)}:generateContent`)

    url.searchParams.set('key', apiKey)

    const data = await readJsonResponse(
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    )
    const image = extractGeminiImage(data)

    if (!image?.base64) throw new Error('Gemini returned no image.')

    return image
  }

  try {
    return await send({ imageConfig: { aspectRatio: aspect } })
  } catch (error) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 429 || !error?.status) throw error

    return send({ responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } })
  }
}

async function generateGemini(selected, prompt, aspect, reference, lossless) {
  const paidRequested = resolvePaidTier()
  const paidKeys = listGeminiApiKeys({ paid: true })
  const freeKeys = listGeminiApiKeys({ paid: false })
  const usePaid = Boolean(paidRequested && paidKeys.length)
  const keys = usePaid ? paidKeys : freeKeys

  if (!keys.length) {
    throw new Error(paidRequested ? 'Gemini API key is not configured for paid models.' : 'Gemini API key is not configured.')
  }

  return withGeminiKey(
    async apiKey => {
      try {
        return await geminiInteractions(apiKey, selected, prompt, aspect, reference, lossless)
      } catch (error) {
        if (error?.status === 401 || error?.status === 403 || error?.status === 429 || !error?.status) throw error

        try {
          return await geminiGenerateContent(apiKey, selected, prompt, aspect, reference)
        } catch (fallbackError) {
          if (fallbackError?.status === 401 || fallbackError?.status === 403 || fallbackError?.status === 429) throw fallbackError
          throw error
        }
      }
    },
    { paid: usePaid, model: selected.id }
  )
}

export async function generateProviderImage({ selected, prompt, aspect, reference, lossless }) {
  try {
    if (selected.provider === 'xai') return await generateXai(selected, prompt, aspect, reference, lossless)
    if (selected.provider === 'openai') return await generateOpenAI(selected, prompt, aspect, reference, lossless)
    if (selected.provider === 'gemini') return await generateGemini(selected, prompt, aspect, reference, lossless)

    throw new Error(`Unsupported image provider: ${selected.provider}`)
  } catch (error) {
    if (/API key is not configured/i.test(serializeError(error))) throw error

    const wrapped = new Error(`${selected.label} failed: ${serializeError(error)}`)

    wrapped.status = error?.status
    throw wrapped
  }
}

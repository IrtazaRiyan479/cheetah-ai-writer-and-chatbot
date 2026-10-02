import { serializeError } from '@/utils/serializeError'

const LEGACY_KEYS = ['GEMINI_API_KEY', 'GEMINI_FREE_API_KEY', 'GEMINI_PAID_API_KEY']

export function listGeminiApiKeys() {
  const candidates = []
  const pooled = process.env.GEMINI_API_KEYS || ''

  candidates.push(...pooled.split(/[,\n;]+/))

  for (let index = 1; index <= 10; index++) candidates.push(process.env[`GEMINI_API_KEY_${index}`] || '')
  for (const name of LEGACY_KEYS) candidates.push(process.env[name] || '')

  const unique = new Set()

  return candidates.map(key => String(key || '').trim()).filter(key => {
    if (!key || unique.has(key)) return false
    unique.add(key)
    return true
  })
}

function statusFor(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status)

  if (status) return String(status)

  const message = serializeError(error)
  const match = message.match(/(?:HTTP\s*)?(429|503)\b/i)

  return match?.[1] || 'quota'
}

function isQuotaFailure(error) {
  const message = serializeError(error)

  return /429|quota|resource.?exhausted|rate.?limit|too many requests|503/i.test(message)
}

export async function withGeminiKey(fn) {
  const keys = listGeminiApiKeys()

  if (!keys.length) throw new Error('Gemini API key is not configured.')

  let lastError

  for (let index = 0; index < keys.length; index++) {
    try {
      return await fn(keys[index], { index, total: keys.length })
    } catch (error) {
      lastError = error
      if (!isQuotaFailure(error) || index === keys.length - 1) break
      console.warn(`gemini key ${index + 1}/${keys.length} failed (${statusFor(error)})`)
    }
  }

  throw new Error(serializeError(lastError))
}

export async function geminiGenerateContent({ model, body, timeoutMs = 90000 }) {
  return withGeminiKey(async apiKey => {
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${serializeError(data?.error || data)}`)
      error.status = response.status
      throw error
    }

    return data
  })
}

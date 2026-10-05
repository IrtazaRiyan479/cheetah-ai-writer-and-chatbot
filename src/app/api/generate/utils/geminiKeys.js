import { serializeError } from '@/utils/serializeError'
import { listProviderKeys } from './providerKeys'

export function listGeminiApiKeys({ paid = false } = {}) {
  const freeKeys = listProviderKeys('GEMINI_API_KEYS', {
    numberedPrefix: 'GEMINI_API_KEY_',
    legacySingles: ['GEMINI_FREE_API_KEY', 'GEMINI_API_KEY']
  })
  if (!paid) return freeKeys

  const paidKeys = listProviderKeys('GEMINI_PAID_API_KEYS', {
    numberedPrefix: 'GEMINI_PAID_API_KEY_',
    legacySingles: ['GEMINI_PAID_API_KEY']
  })
  return paidKeys.length ? paidKeys : freeKeys
}

function statusFor(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status)
  if (status) return String(status)
  return serializeError(error).match(/(?:HTTP\s*)?(401|403|429|503)\b/i)?.[1] || 'error'
}

export function withGeminiKey(fn, { paid = false } = {}) {
  const keys = listGeminiApiKeys({ paid })
  if (!keys.length) throw new Error(paid ? 'Gemini API key is not configured for paid models.' : 'Gemini API key is not configured.')

  return rotateGeminiKeys(keys, fn)
}

async function rotateGeminiKeys(keys, fn) {
  let lastError
  for (let index = 0; index < keys.length; index++) {
    try {
      return await fn(keys[index], { index, total: keys.length })
    } catch (error) {
      lastError = error
      if (index < keys.length - 1) console.warn(`gemini key ${index + 1}/${keys.length} failed (${statusFor(error)})`)
    }
  }
  throw new Error(serializeError(lastError))
}

export async function geminiGenerateContent({ model, body, timeoutMs = 90000, paid } = {}) {
  const usePaid = paid ?? /(?:-pro(?:-|$)|-image(?:-|$)|-pro-image)/i.test(String(model || ''))

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
  }, { paid: usePaid })
}

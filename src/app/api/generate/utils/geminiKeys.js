import { serializeError } from '@/utils/serializeError'
import { listProviderKeys, resolvePaidTier } from './providerKeys'

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
  return paidKeys
}

function statusFor(error) {
  const status = Number(error?.status || error?.statusCode || error?.response?.status)
  if (status) return status
  const match = serializeError(error).match(/(?:HTTP\s*)?(401|403|429|500|503)\b/i)
  return match ? Number(match[1]) : null
}

function classifyGeminiError(error) {
  const status = statusFor(error)
  const message = serializeError(error)
  const lower = message.toLowerCase()

  if (status === 429 || /rate.?limit|quota|resource.?exhausted|too many requests/i.test(lower)) {
    return { kind: 'rate_limit', status: status || 429, message }
  }
  if (status === 401 || status === 403 || /api key|invalid|permission|unauthorized|forbidden/i.test(lower)) {
    return { kind: 'auth', status: status || 403, message }
  }
  if (status === 503 || /unavailable|overloaded|high demand|try again later/i.test(lower)) {
    return { kind: 'unavailable', status: status || 503, message }
  }
  if (/timeout|abort|network|fetch failed|econnreset|enotfound/i.test(lower)) {
    return { kind: 'network', status: status || 0, message }
  }
  return { kind: 'other', status: status || 0, message }
}

const paidInteractions = globalThis.__affigeniePaidInteractions || (globalThis.__affigeniePaidInteractions = new Set())

export function rememberPaidInteraction(id) {
  if (id) paidInteractions.add(String(id))
}

export function interactionUsesPaidKeys(id) {
  return paidInteractions.has(String(id || ''))
}

export function withGeminiKey(fn, { paid, model } = {}) {
  const usePaid = resolvePaidTier(paid, model)
  const keys = listGeminiApiKeys({ paid: usePaid })
  if (!keys.length) throw new Error(usePaid ? 'Gemini API key is not configured for paid models.' : 'Gemini API key is not configured.')

  return rotateGeminiKeys(keys, fn, usePaid, model)
}

async function rotateGeminiKeys(keys, fn, paid, model) {
  let lastError
  const failures = []
  console.info(`[gemini] pool=${keys.length} tier=${paid ? 'paid' : 'free'} model=${model || 'unknown'}`)

  for (let index = 0; index < keys.length; index++) {
    try {
      const result = await fn(keys[index], { index, total: keys.length })
      if (failures.length) {
        console.info(
          `[gemini] recovered on key ${index + 1}/${keys.length} after ${failures.length} failure(s): ${failures
            .map(item => `${item.index}:${item.kind}`)
            .join(', ')}`
        )
      }
      return result
    } catch (error) {
      lastError = error
      const info = classifyGeminiError(error)
      failures.push({ index: index + 1, ...info })
      const snippet = String(info.message || '').replace(/\s+/g, ' ').slice(0, 180)
      console.warn(
        `[gemini] key ${index + 1}/${keys.length} failed kind=${info.kind} status=${info.status || 'n/a'} tier=${paid ? 'paid' : 'free'} msg="${snippet}"`
      )
    }
  }

  const summary = failures.map(item => `#${item.index}:${item.kind}${item.status ? `(${item.status})` : ''}`).join(' | ')
  console.error(`[gemini] all ${keys.length} ${paid ? 'paid' : 'free'} keys exhausted: ${summary}`)
  const wrapped = new Error(serializeError(lastError))
  wrapped.code = failures.every(item => item.kind === 'rate_limit') ? 'GEMINI_RATE_LIMIT' : 'GEMINI_POOL_EXHAUSTED'
  wrapped.failures = failures
  throw wrapped
}

export async function geminiGenerateContent({ model, body, timeoutMs = 90000, paid } = {}) {
  const usePaid = resolvePaidTier(paid, model)

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
  }, { paid: usePaid, model })
}

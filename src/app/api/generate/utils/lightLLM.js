import { listProviderKeys, withProviderKey } from './providerKeys'

const GROQ_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']

export function parseJsonSafe(text) {
  if (!text) return null
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

export async function callGroq({ prompt, system, json = false, model, max_tokens = 512, waitOn429 = true }) {
  const keys = listProviderKeys('GROQ_API_KEYS', { numberedPrefix: 'GROQ_API_KEY_', legacySingles: ['GROQ_API_KEY'] })
  if (!keys.length) return null

  const models = model ? [model, ...GROQ_MODELS.filter(item => item !== model)] : GROQ_MODELS
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON. No markdown fences.` : prompt })

  for (const modelName of models) {
    try {
      return await withProviderKey(keys, async apiKey => {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, messages, temperature: 0.2, max_tokens }),
          signal: AbortSignal.timeout(45000)
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${data?.error?.message || 'Groq request failed.'}`)
          error.status = response.status
          throw error
        }
        return data.choices?.[0]?.message?.content?.trim() || null
      })
    } catch (error) {
      if (/404|model_not_found/i.test(String(error?.message || error))) continue
      if (waitOn429 && /429/.test(String(error?.message || error))) await new Promise(resolve => setTimeout(resolve, 20000))
    }
  }
  return null
}

export async function callMistral({ prompt, system, json = false, model = 'mistral-small-latest', max_tokens = 512 }) {
  const keys = listProviderKeys('MISTRAL_API_KEYS', { numberedPrefix: 'MISTRAL_API_KEY_', legacySingles: ['MISTRAL_API_KEY'] })
  if (!keys.length) return null
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: json ? `${prompt}\n\nReturn ONLY valid JSON. No markdown fences.` : prompt })

  try {
    return await withProviderKey(keys, async apiKey => {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens }),
        signal: AbortSignal.timeout(15000)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${data?.error?.message || 'Mistral request failed.'}`)
        error.status = response.status
        throw error
      }
      return data.choices?.[0]?.message?.content?.trim() || null
    })
  } catch {
    return null
  }
}

export async function callLightLLM(opts) {
  const groq = await callGroq(opts)
  if (groq) return { text: groq, provider: 'groq' }
  const mistral = await callMistral(opts)
  if (mistral) return { text: mistral, provider: 'mistral' }
  return null
}

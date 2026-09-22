const GROQ_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']

export function parseJsonSafe(text) {
  if (!text) return null

  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)

    if (!m) return null

    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export async function callGroq({ prompt, system, json = false, model, max_tokens = 512, waitOn429 = true }) {
  if (!process.env.GROQ_API_KEY) return null

  const modelsToTry = model ? [model, ...GROQ_MODELS.filter(m => m !== model)] : GROQ_MODELS
  const messages = []

  if (system) messages.push({ role: 'system', content: system })

  if (json) {
    messages.push({
      role: 'user',
      content: `${prompt}\n\nReturn ONLY valid JSON. No markdown fences.`
    })
  } else {
    messages.push({ role: 'user', content: prompt })
  }

  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = { model: m, messages, temperature: 0.2, max_tokens }

      // Do NOT set response_format json_object — gpt-oss rejects it

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000)
      })

      if (res.ok) {
        const data = await res.json()

        return data.choices?.[0]?.message?.content?.trim() || null
      }

      const errText = await res.text().catch(() => '')

      if (res.status === 429 && attempt === 0 && waitOn429) {
        console.warn('[Groq] TPM 429 — waiting 20s then retry', m)
        await new Promise(r => setTimeout(r, 20000))
        continue
      }

      if (res.status === 404 || /model_not_found/i.test(errText)) {
        console.warn('[Groq] model unavailable, next:', m)
        break
      }

      console.error('[Groq]', res.status, errText.slice(0, 220))
      break
    }
  }

  return null
}

let mistralCooldownUntil = 0

export async function callMistral({ prompt, system, json = false, model = 'mistral-small-latest', max_tokens = 512 }) {
  if (Date.now() < mistralCooldownUntil) return null
  if (!process.env.MISTRAL_API_KEY) return null

  const messages = []

  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const body = { model, messages, temperature: 0.2, max_tokens }

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  })

  if (!res.ok) {
    if (res.status === 429) mistralCooldownUntil = Date.now() + 60_000

    return null
  }

  const data = await res.json()

  return data.choices?.[0]?.message?.content?.trim() || null
}

export async function callLightLLM(opts) {
  const g = await callGroq(opts)

  if (g) return { text: g, provider: 'groq' }
  const m = await callMistral(opts)

  if (m) return { text: m, provider: 'mistral' }

  return null
}

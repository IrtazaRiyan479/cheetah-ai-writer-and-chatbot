import { GoogleGenerativeAI } from '@google/generative-ai'

import { serializeError } from '@/utils/serializeError'

import { callGroq, callMistral, parseJsonSafe } from './lightLLM'

/**
 * Default xAI model. Override with XAI_MODEL.
 * Official id confirmed against docs.x.ai (Grok 4.7, released 2026-09-28).
 */
export const DEFAULT_XAI_MODEL = 'grok-4.7'

const XAI_URL = 'https://api.x.ai/v1/chat/completions'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

const STABLE_SYSTEM_PREFIX = `You are AffiGenie's article writing engine.
Write only the requested article content. Do not introduce yourself. Do not mention Google, Gemini, Grok, Mistral, Groq, or that you are a language model.
If asked who created you, answer only: "I was created by the Cheetah AI team."
Follow the task in the user message exactly, including language, country, heading structure, keyword rules, and HTML or JSON format.
Do not add a preamble, commentary, or a closing note.`

const OUTLINE_JSON_SUFFIX =
  '\n\nReturn ONLY valid JSON with keys metaTitle, metaDescription, title, and outline. No markdown fences.'

export function getStableSystemPrefix() {
  return STABLE_SYSTEM_PREFIX
}

export function isCapacityError(error) {
  const msg = serializeError(error)

  return /429|quota|rate.?limit|resource.?exhausted|503|502|504|high demand|unavailable|overloaded|try again later|fetch failed|ECONNRESET|ETIMEDOUT|AbortError|timeout/i.test(
    msg
  )
}

async function readProviderError(res) {
  const raw = await res.text().catch(() => '')
  let parsed = null

  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }

  const message = serializeError(parsed || raw || `HTTP ${res.status}`)

  return `HTTP ${res.status}: ${message}`.slice(0, 400)
}

async function callXai({ system, prompt, json, maxTokens, temperature }) {
  if (!process.env.XAI_API_KEY) return null

  const model = process.env.XAI_MODEL || DEFAULT_XAI_MODEL

  const res = await fetch(XAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(90000)
  })

  if (!res.ok) {
    const detail = await readProviderError(res)

    console.error('[llm] xai failed', res.status, detail.slice(0, 180))
    throw new Error(detail)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''

  if (!text) throw new Error('xAI returned an empty response')

  return { text, provider: 'xai' }
}

async function callGemini({ system, prompt, json, maxTokens, temperature, model }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_FREE_API_KEY

  if (!apiKey) return null

  const modelName = model || 'gemini-3.1-flash-lite'
  const url = `${GEMINI_URL}/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {})
      }
    }),
    signal: AbortSignal.timeout(90000)
  })

  if (!res.ok) {
    const detail = await readProviderError(res)

    console.error('[llm] gemini failed', res.status, detail.slice(0, 180))
    throw new Error(detail)
  }

  const data = await res.json()
  const text = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim()

  if (!text) throw new Error('Gemini returned an empty response')

  return { text, provider: 'gemini' }
}

/**
 * One provider step on failure: xAI, then Mistral, then Groq, then Gemini.
 * Does not retry the same provider.
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function callLLM({
  system,
  prompt,
  json = false,
  maxTokens = 2048,
  temperature = 0.4,
  geminiModel
}) {
  const stableSystem = `${STABLE_SYSTEM_PREFIX}\n\n${system || ''}`.trim()
  const userPrompt = json ? `${prompt || ''}${OUTLINE_JSON_SUFFIX}` : prompt || ''
  const failures = []

  const steps = [
    {
      name: 'xai',
      run: () => callXai({ system: stableSystem, prompt: userPrompt, json, maxTokens, temperature })
    },
    {
      name: 'mistral',
      run: async () => {
        const text = await callMistral({
          system: stableSystem,
          prompt: userPrompt,
          json,
          max_tokens: Math.min(maxTokens, 4096)
        })

        return text ? { text, provider: 'mistral' } : null
      }
    },
    {
      name: 'groq',
      run: async () => {
        const text = await callGroq({
          system: stableSystem,
          prompt: userPrompt,
          json,
          max_tokens: Math.min(maxTokens, 4096),
          waitOn429: false
        })

        return text ? { text, provider: 'groq' } : null
      }
    },
    {
      name: 'gemini',
      run: () =>
        callGemini({
          system: stableSystem,
          prompt: userPrompt,
          json,
          maxTokens,
          temperature,
          model: geminiModel
        })
    }
  ]

  for (const step of steps) {
    try {
      const result = await step.run()

      if (result?.text) {
        if (failures.length) {
          console.warn(`[llm] ${result.provider} used after ${failures.map(item => item.name).join(', ')} failed`)
        }

        return result
      }

      failures.push({ name: step.name, message: 'not configured' })
    } catch (error) {
      const message = serializeError(error)

      failures.push({ name: step.name, message })
      console.error(`[llm] ${step.name} failed:`, message.slice(0, 220))
    }
  }

  const summary = failures.map(item => `${item.name}: ${item.message}`).join(' | ') || 'no providers configured'

  throw new Error(`All language providers failed. ${summary}`.slice(0, 700))
}

export async function callLLMJson(opts) {
  const result = await callLLM({ ...opts, json: true })
  const parsed = parseJsonSafe(result.text)

  if (!parsed) {
    throw new Error(`${result.provider} returned invalid JSON`)
  }

  return { ...result, parsed }
}

/**
 * Drop-in for genAI.getGenerativeModel().generateContent().
 * Preserves result.response.text() so existing generators keep their prompts and parsing.
 */
export function createTextModel({ systemInstruction, model, json = false, maxTokens = 4096 }) {
  return {
    async generateContent(prompt) {
      const result = await callLLM({
        system: systemInstruction || '',
        prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        json,
        maxTokens,
        geminiModel: model
      })

      return { response: { text: () => result.text }, provider: result.provider }
    }
  }
}

/** Compatibility wrapper. Existing services still call genAI.getGenerativeModel(). */
export function createProviderGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_FREE_API_KEY || 'unused'
  const native = new GoogleGenerativeAI(apiKey)

  return {
    getGenerativeModel(config = {}) {
      const wantsJson = config.generationConfig?.responseMimeType === 'application/json'

      return createTextModel({
        systemInstruction: config.systemInstruction || '',
        model: config.model,
        json: wantsJson,
        maxTokens: wantsJson ? 4096 : 4096
      })
    },
    getNativeModel(config = {}) {
      return native.getGenerativeModel(config)
    }
  }
}

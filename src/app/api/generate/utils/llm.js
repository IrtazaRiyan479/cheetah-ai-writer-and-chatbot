import { GoogleGenerativeAI } from '@google/generative-ai'

import { serializeError } from '@/utils/serializeError'

import { callGroq, callMistral, parseJsonSafe } from './lightLLM'
import { geminiGenerateContent, listGeminiApiKeys } from './geminiKeys'
import { listProviderKeys, withProviderKey } from './providerKeys'

export const DEFAULT_XAI_MODEL = 'grok-4.7'

const XAI_URL = 'https://api.x.ai/v1/chat/completions'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const STABLE_SYSTEM_PREFIX = `You are AffiGenie's article writing engine.
Write only the requested article content. Do not introduce yourself. Do not mention Google, Gemini, Grok, Mistral, Groq, or that you are a language model.
If asked who created you, answer only: "I was created by the Cheetah AI team."
Follow the task in the user message exactly, including language, country, heading structure, keyword rules, and HTML or JSON format.
Do not add a preamble, commentary, or a closing note.`

const OUTLINE_JSON_SUFFIX = '\n\nReturn ONLY valid JSON with keys metaTitle, metaDescription, title, and outline. No markdown fences.'

const MODEL_CATALOG = {
  'gemini-3.5-flash': { provider: 'gemini', model: 'gemini-3.5-flash', paid: false },
  'gemini-3.1-flash-lite': { provider: 'gemini', model: 'gemini-3.1-flash-lite', paid: false },
  'gemini-3.1-pro-preview-customtools': { provider: 'gemini', model: 'gemini-3.1-pro-preview-customtools', paid: true },
  'gemini-2.5-pro': { provider: 'gemini', model: 'gemini-2.5-pro', paid: true },
  'gemini-2.5-flash': { provider: 'gemini', model: 'gemini-2.5-flash', paid: false },
  'gemini-3.1-pro-preview': { provider: 'gemini', model: 'gemini-3.1-pro-preview', paid: true },
  'gpt-5.2': { provider: 'openai', model: 'gpt-5.2' },
  'gpt-5-mini': { provider: 'openai', model: 'gpt-5-mini' },
  'claude-4.5-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'grok-4.7': { provider: 'xai', model: 'grok-4.7' }
}

export function getStableSystemPrefix() { return STABLE_SYSTEM_PREFIX }

export function isCapacityError(error) {
  return /429|quota|rate.?limit|resource.?exhausted|503|502|504|high demand|unavailable|overloaded|try again later|fetch failed|ECONNRESET|ETIMEDOUT|AbortError|timeout/i.test(serializeError(error))
}

async function parseProviderResponse(response) {
  const raw = await response.text().catch(() => '')
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = { message: raw } }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${serializeError(data?.error || data)}`)
    error.status = response.status
    throw error
  }
  return data
}

function keysFor(provider, paid = false) {
  if (provider === 'gemini') return listGeminiApiKeys({ paid })
  if (provider === 'xai') return listProviderKeys('XAI_API_KEYS', { numberedPrefix: 'XAI_API_KEY_', legacySingles: ['XAI_API_KEY'] })
  if (provider === 'groq') return listProviderKeys('GROQ_API_KEYS', { numberedPrefix: 'GROQ_API_KEY_', legacySingles: ['GROQ_API_KEY'] })
  if (provider === 'mistral') return listProviderKeys('MISTRAL_API_KEYS', { numberedPrefix: 'MISTRAL_API_KEY_', legacySingles: ['MISTRAL_API_KEY'] })
  if (provider === 'openai') return listProviderKeys('OPENAI_API_KEYS', { numberedPrefix: 'OPENAI_API_KEY_' })
  if (provider === 'anthropic') return listProviderKeys('ANTHROPIC_API_KEYS', { numberedPrefix: 'ANTHROPIC_API_KEY_' })
  return []
}

function resolveModel(model) {
  const requested = String(model || 'gemini-3.1-flash-lite')
  const known = MODEL_CATALOG[requested]
  if (known) return { ...known, requested }
  if (requested.startsWith('gemini-')) return { provider: 'gemini', model: requested, paid: /-pro(?:-|$)/i.test(requested), requested }
  throw new Error(`Unsupported selected model: ${requested}`)
}

async function callXai({ apiKey, model, system, prompt, maxTokens, temperature }) {
  const response = await fetch(XAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.XAI_MODEL || model || DEFAULT_XAI_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(90000)
  })
  const data = await parseProviderResponse(response)
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  if (!text) throw new Error('xAI returned an empty response')
  return { text, provider: 'xai' }
}

async function callOpenAI({ apiKey, model, system, prompt, json, maxTokens, temperature }) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature, max_tokens: maxTokens, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
    signal: AbortSignal.timeout(90000)
  })
  const data = await parseProviderResponse(response)
  const text = data.choices?.[0]?.message?.content?.trim() || ''
  if (!text) throw new Error('OpenAI returned an empty response')
  return { text, provider: 'openai' }
}

async function callAnthropic({ apiKey, model, system, prompt, maxTokens, temperature }) {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || model, system, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(90000)
  })
  const data = await parseProviderResponse(response)
  const text = (data.content || []).filter(item => item.type === 'text').map(item => item.text || '').join('').trim()
  if (!text) throw new Error('Anthropic returned an empty response')
  return { text, provider: 'anthropic' }
}

async function callGemini({ apiKey, model, system, prompt, json, maxTokens, temperature, paid }) {
  // geminiGenerateContent owns key rotation. apiKey is accepted for uniform provider dispatch.
  void apiKey
  const data = await geminiGenerateContent({
    model,
    paid,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) }
    },
    timeoutMs: 90000
  })
  const text = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim()
  if (!text) throw new Error('Gemini returned an empty response')
  return { text, provider: 'gemini' }
}

async function runProvider(config, request) {
  const keys = keysFor(config.provider, config.paid)
  if (!keys.length) return null
  if (config.provider === 'gemini') return callGemini({ ...request, model: config.model, paid: config.paid })
  if (config.provider === 'groq') {
    const text = await callGroq({ ...request, model: config.model, max_tokens: Math.min(request.maxTokens, 4096), waitOn429: false })
    return text ? { text, provider: 'groq' } : null
  }
  if (config.provider === 'mistral') {
    const text = await callMistral({ ...request, model: config.model, max_tokens: Math.min(request.maxTokens, 4096) })
    return text ? { text, provider: 'mistral' } : null
  }

  return withProviderKey(keys, apiKey => {
    if (config.provider === 'xai') return callXai({ ...request, apiKey, model: config.model })
    if (config.provider === 'openai') return callOpenAI({ ...request, apiKey, model: config.model })
    if (config.provider === 'anthropic') return callAnthropic({ ...request, apiKey, model: config.model })
    return null
  })
}

const FALLBACK_ORDER = ['xai', 'mistral', 'groq', 'gemini']

/** The selected Writer model runs first; exhausted configured providers use legacy fallbacks. */
export async function callLLM({ system, prompt, json = false, maxTokens = 2048, temperature = 0.4, model, geminiModel }) {
  const requested = resolveModel(model || geminiModel || 'gemini-3.1-flash-lite')
  const stableSystem = `${STABLE_SYSTEM_PREFIX}\n\n${system || ''}`.trim()
  const userPrompt = json ? `${prompt || ''}${OUTLINE_JSON_SUFFIX}` : prompt || ''
  const request = { system: stableSystem, prompt: userPrompt, json, maxTokens, temperature }
  const selectedKeys = keysFor(requested.provider, requested.paid)
  if (!selectedKeys.length) throw new Error(`Selected provider ${requested.provider} is not configured for model ${requested.requested}.`)

  const failures = []
  try {
    const selected = await runProvider(requested, request)
    if (selected?.text) return selected
    throw new Error(`Selected provider ${requested.provider} returned no response.`)
  } catch (error) {
    const message = serializeError(error)
    failures.push({ name: requested.provider, message })
    console.error(`[llm] selected ${requested.provider} failed:`, message.slice(0, 220))
    console.warn(`[llm] fallback after selected provider exhausted: ${requested.provider}`)
  }

  const fallbacks = FALLBACK_ORDER.filter(provider => provider !== requested.provider)
  for (const provider of fallbacks) {
    const fallback = { provider, model: provider === 'xai' ? DEFAULT_XAI_MODEL : provider === 'gemini' ? 'gemini-3.1-flash-lite' : provider === 'groq' ? undefined : provider === 'mistral' ? 'mistral-small-latest' : undefined, paid: false }
    if (!keysFor(provider, false).length) continue
    try {
      const result = await runProvider(fallback, request)
      if (result?.text) return result
      failures.push({ name: provider, message: 'empty response' })
    } catch (error) {
      const message = serializeError(error)
      failures.push({ name: provider, message })
      console.error(`[llm] ${provider} failed:`, message.slice(0, 220))
    }
  }

  const summary = failures.map(item => `${item.name}: ${item.message}`).join(' | ') || 'no fallback providers configured'
  throw new Error(`All language providers failed. ${summary}`.slice(0, 700))
}

export async function callLLMJson(options) {
  const result = await callLLM({ ...options, json: true })
  const parsed = parseJsonSafe(result.text)
  if (!parsed) throw new Error(`${result.provider} returned invalid JSON`)
  return { ...result, parsed }
}

export function createTextModel({ systemInstruction, model, json = false, maxTokens = 4096 }) {
  return {
    async generateContent(prompt) {
      const result = await callLLM({ system: systemInstruction || '', prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt), json, maxTokens, model })
      return { response: { text: () => result.text }, provider: result.provider }
    }
  }
}

/** Compatibility wrapper for service code expecting Google's model interface. */
export function createProviderGenAI() {
  const apiKey = listGeminiApiKeys()[0] || 'unused'
  const native = new GoogleGenerativeAI(apiKey)

  return {
    getGenerativeModel(config = {}) {
      const wantsJson = config.generationConfig?.responseMimeType === 'application/json'
      return createTextModel({ systemInstruction: config.systemInstruction || '', model: config.model || 'gemini-3.1-flash-lite', json: wantsJson, maxTokens: 4096 })
    },
    getNativeModel(config = {}) { return native.getGenerativeModel(config) }
  }
}

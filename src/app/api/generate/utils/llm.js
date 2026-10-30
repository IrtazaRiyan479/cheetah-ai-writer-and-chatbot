import { GoogleGenerativeAI } from '@google/generative-ai'

import { serializeError } from '@/utils/serializeError'

import { callGroq, callMistral, parseJsonSafe } from './lightLLM'
import { geminiGenerateContent, listGeminiApiKeys } from './geminiKeys'
import { listProviderKeys, resolvePaidTier, withProviderKey } from './providerKeys'

export const DEFAULT_XAI_MODEL = 'grok-4.7'

const XAI_URL = 'https://api.x.ai/v1/chat/completions'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const STABLE_SYSTEM_PREFIX = `You are AffiGenie's article writing engine.
Write only the requested article content. Do not introduce yourself. Do not mention Google, Gemini, Grok, Mistral, Groq, or that you are a language model.
If asked who created you, answer only: "I was created by the Cheetah AI team."
Follow the task in the user message exactly, including language, country, heading structure, keyword rules, and HTML or JSON format.
Do not add a preamble, commentary, or a closing note.`

const OUTLINE_JSON_SUFFIX =
  '\n\nReturn ONLY valid JSON with keys metaTitle, metaDescription, title, and outline. No markdown fences.'

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
  'claude-haiku-4-5': { provider: 'anthropic', model: 'claude-haiku-4-5' },
  'claude-haiku-5-5': { provider: 'anthropic', model: 'claude-haiku-5-5' },
  'claude-sonnet-4-5': { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'claude-sonnet-4-6': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'claude-sonnet-5': { provider: 'anthropic', model: 'claude-sonnet-5' },
  'claude-sonnet-5-5': { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  'claude-opus-4-6': { provider: 'anthropic', model: 'claude-opus-4-6' },
  'claude-opus-5-5': { provider: 'anthropic', model: 'claude-opus-5-5' },
  'grok-4.7': { provider: 'xai', model: 'grok-4.7' }
}

export function getStableSystemPrefix() {
  return STABLE_SYSTEM_PREFIX
}

export function isLimitError(error) {
  return /429|quota|rate.?limit|resource.?exhausted|too many requests/i.test(serializeError(error))
}

export function isCapacityError(error) {
  return /429|quota|rate.?limit|resource.?exhausted|503|502|504|high demand|unavailable|overloaded|try again later|fetch failed|ECONNRESET|ETIMEDOUT|AbortError|timeout/i.test(
    serializeError(error)
  )
}

async function parseProviderResponse(response) {
  const raw = await response.text().catch(() => '')
  let data = {}

  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { message: raw }
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${serializeError(data?.error || data)}`)

    error.status = response.status
    throw error
  }

  return data
}

function keysFor(provider, paid = false) {
  if (provider === 'gemini') return listGeminiApiKeys({ paid })

  const names = {
    xai: 'XAI',
    groq: 'GROQ',
    mistral: 'MISTRAL',
    openai: 'OPENAI',
    anthropic: 'ANTHROPIC'
  }

  const name = names[provider]

  if (!name) return []

  if (paid) {
    return listProviderKeys(`${name}_PAID_API_KEYS`, {
      numberedPrefix: `${name}_PAID_API_KEY_`,
      legacySingles: [`${name}_PAID_API_KEY`]
    })
  }

  return listProviderKeys(`${name}_API_KEYS`, {
    numberedPrefix: `${name}_API_KEY_`,
    legacySingles: [`${name}_API_KEY`]
  })
}

export function resolveModel(model) {
  const requested = String(model || 'gemini-3.1-flash-lite')
  const known = MODEL_CATALOG[requested]

  if (known) return { ...known, requested }

  const lower = requested.toLowerCase()

  if (lower.startsWith('claude')) return { provider: 'anthropic', model: requested, requested }
  if (lower.startsWith('gpt-')) return { provider: 'openai', model: requested, requested }
  if (lower.startsWith('grok')) return { provider: 'xai', model: requested, requested }
  if (lower.startsWith('gemini-'))
    return { provider: 'gemini', model: requested, paid: /-pro(?:-|$)/i.test(requested), requested }

  throw new Error(`Unsupported selected model: ${requested}`)
}

function extractChatContent(message) {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content.trim()
  if (Array.isArray(message.content)) {
    return message.content
      .map(part => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('')
      .trim()
  }

  return ''
}

function extractAnthropicText(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []

  return blocks
    .filter(item => item && (item.type === 'text' || item.type === 'output_text'))
    .map(item => item.text || '')
    .join('')
    .trim()
}

function normalizeJsonText(text, provider) {
  const parsed = parseJsonSafe(text)

  if (!parsed || typeof parsed !== 'object') throw new Error(`${provider} returned invalid JSON`)

  return JSON.stringify(parsed)
}

function isParameterError(error) {
  return /output_config|effort|thinking|temperature|max_completion_tokens|max_tokens|response_format|reasoning_effort|unknown parameter|unexpected|not supported|extra (?:field|input)/i.test(
    serializeError(error)
  )
}

async function callXai({ apiKey, model, system, prompt, maxTokens, temperature }) {
  const apiModel = model || DEFAULT_XAI_MODEL
  const tokens = Math.max(Number(maxTokens) || 2048, 8192)
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]

  const send = async payload => {
    const response = await fetch(XAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000)
    })
    const data = await parseProviderResponse(response)
    const text = extractChatContent(data.choices?.[0]?.message)

    if (!text) throw new Error(`xAI model ${apiModel} returned an empty article.`)

    return { text, provider: 'xai', model: apiModel }
  }

  try {
    return await send({ model: apiModel, messages, temperature, max_tokens: tokens })
  } catch (error) {
    const message = serializeError(error)

    if (/max_completion_tokens/i.test(message)) {
      return send({ model: apiModel, messages, max_completion_tokens: tokens })
    }

    if (/temperature/i.test(message)) return send({ model: apiModel, messages, max_tokens: tokens })
    throw error
  }
}

async function callOpenAI({ apiKey, model, system, prompt, json, maxTokens }) {
  const apiModel = model || process.env.OPENAI_MODEL

  if (!apiModel) throw new Error('OpenAI model is required.')

  const tokens = Math.max(Number(maxTokens) || 2048, 8192)
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ]

  const send = async payload => {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000)
    })
    const data = await parseProviderResponse(response)
    const message = data.choices?.[0]?.message
    const text = extractChatContent(message)

    if (!text && message?.refusal) throw new Error(`OpenAI model ${apiModel} refused the article: ${message.refusal}`)
    if (!text) throw new Error(`OpenAI model ${apiModel} returned an empty article.`)

    return { text, provider: 'openai', model: apiModel }
  }

  const jsonFormat = json ? { response_format: { type: 'json_object' } } : {}

  try {
    return await send({
      model: apiModel,
      messages,
      max_completion_tokens: tokens,
      reasoning_effort: 'low',
      ...jsonFormat
    })
  } catch (error) {
    if (!isParameterError(error)) throw error

    try {
      return await send({ model: apiModel, messages, max_completion_tokens: tokens, ...jsonFormat })
    } catch (retryError) {
      if (!isParameterError(retryError)) throw retryError

      return send({ model: apiModel, messages, max_tokens: tokens, ...jsonFormat })
    }
  }
}

function anthropicBody(model, system, prompt, maxTokens, variant) {
  const body = {
    model,
    system,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: Math.max(8192, Number(maxTokens) || 0)
  }

  if (variant === 'effort') body.output_config = { effort: 'low' }
  if (variant === 'disabled') body.thinking = { type: 'disabled' }

  return body
}

async function callAnthropic({ apiKey, model, system, prompt, maxTokens }) {
  const apiModel = model || 'claude-sonnet-5-5'

  const send = async variant => {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify(anthropicBody(apiModel, system, prompt, maxTokens, variant)),
      signal: AbortSignal.timeout(90000)
    })
    const data = await parseProviderResponse(response)
    const text = extractAnthropicText(data)

    if (!text) {
      throw new Error(
        `Anthropic model ${apiModel} returned an empty article (stop_reason=${data.stop_reason || 'unknown'}).`
      )
    }

    return { text, provider: 'anthropic', model: apiModel }
  }

  try {
    return await send('effort')
  } catch (error) {
    if (!isParameterError(error) && !/empty article/i.test(serializeError(error))) throw error

    try {
      return await send('disabled')
    } catch (retryError) {
      if (!isParameterError(retryError) && !/empty article/i.test(serializeError(retryError))) throw retryError

      return send('plain')
    }
  }
}

async function callGemini({ apiKey, model, system, prompt, json, maxTokens, temperature, paid }) {
  void apiKey

  const data = await geminiGenerateContent({
    model,
    paid,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: 'application/json' } : {})
      }
    },
    timeoutMs: 90000
  })

  const text = (data.candidates?.[0]?.content?.parts || [])
    .map(part => part.text || '')
    .join('')
    .trim()

  if (!text) throw new Error('Gemini returned an empty response')

  return { text, provider: 'gemini' }
}

async function runProvider(config, request) {
  const keys = keysFor(config.provider, config.paid)

  if (!keys.length) return null
  if (config.provider === 'gemini') return callGemini({ ...request, model: config.model, paid: config.paid })

  if (config.provider === 'groq') {
    const text = await callGroq({
      ...request,
      model: config.model,
      max_tokens: Math.min(request.maxTokens, 4096),
      waitOn429: false
    })

    return text ? { text, provider: 'groq' } : null
  }

  if (config.provider === 'mistral') {
    const text = await callMistral({ ...request, model: config.model, max_tokens: Math.min(request.maxTokens, 4096) })

    return text ? { text, provider: 'mistral' } : null
  }

  return withProviderKey(
    keys,
    apiKey => {
      if (config.provider === 'xai') return callXai({ ...request, apiKey, model: config.model })
      if (config.provider === 'openai') return callOpenAI({ ...request, apiKey, model: config.model })
      if (config.provider === 'anthropic') return callAnthropic({ ...request, apiKey, model: config.model })

      return null
    },
    config.provider
  )
}

async function limitFallback(skipProvider, request, json) {
  const order = ['groq', 'mistral'].filter(provider => provider !== skipProvider)

  for (const provider of order) {
    const text =
      provider === 'groq'
        ? await callGroq({
            ...request,
            max_tokens: Math.min(request.maxTokens || 2048, 8192),
            waitOn429: false
          })
        : await callMistral({
            ...request,
            max_tokens: Math.min(request.maxTokens || 2048, 8192),
            timeoutMs: 25000
          })

    if (!text) continue

    try {
      const normalized = json ? normalizeJsonText(text, provider) : text

      return { text: normalized, provider, model: provider === 'groq' ? 'groq-fallback' : 'mistral-small-latest' }
    } catch (error) {
      console.warn(`[llm] ${provider} fallback was not usable:`, serializeError(error).slice(0, 180))
    }
  }

  return null
}

/** Selected model is called on its own API. Groq, then Mistral, run only after a rate limit. */
export async function callLLM({
  system,
  prompt,
  json = false,
  maxTokens = 2048,
  temperature = 0.4,
  model,
  geminiModel,
  paid
}) {
  const requested = resolveModel(model || geminiModel || 'gemini-3.1-flash-lite')
  const wantPaid = resolvePaidTier(paid, requested.model)
  const paidKeys = wantPaid ? keysFor(requested.provider, true) : []
  const standardKeys = keysFor(requested.provider, false)

  requested.paid = paidKeys.length > 0
  const stableSystem = `${STABLE_SYSTEM_PREFIX}\n\n${system || ''}`.trim()
  const userPrompt = json ? `${prompt || ''}${OUTLINE_JSON_SUFFIX}` : prompt || ''
  const request = { system: stableSystem, prompt: userPrompt, json, maxTokens, temperature }
  const selectedKeys = requested.paid ? paidKeys : standardKeys

  if (!selectedKeys.length) {
    throw new Error(`Selected provider ${requested.provider} is not configured for model ${requested.requested}.`)
  }

  console.info(`[llm] provider=${requested.provider} model=${requested.model} paid=${requested.paid}`)

  try {
    const selected = await runProvider(requested, request)

    if (!selected?.text) throw new Error(`Selected provider ${requested.provider} returned no response.`)

    const text = json ? normalizeJsonText(selected.text, requested.provider) : selected.text

    return { ...selected, text, model: requested.model, usedPaidKeys: requested.paid }
  } catch (error) {
    const message = serializeError(error)

    console.error(`[llm] ${requested.provider} model=${requested.model} failed:`, message.slice(0, 300))

    if (requested.paid && /low credits|insufficient|billing|credit balance|payment required|\b402\b/i.test(message)) {
      const paidError = new Error('Low credits.')

      paidError.code = 'PAID_KEYS_FAILED'
      throw paidError
    }

    if (isLimitError(error)) {
      const fallback = await limitFallback(requested.provider, request, json)

      if (fallback?.text) {
        console.info(`[llm] rate limit on ${requested.provider}; using ${fallback.provider}`)

        return { ...fallback, usedPaidKeys: requested.paid }
      }
    }

    throw new Error(`${requested.provider} model ${requested.model} failed: ${message}`)
  }
}

export async function callLLMJson(options) {
  const result = await callLLM({ ...options, json: true })
  const parsed = parseJsonSafe(result.text)

  if (!parsed) throw new Error(`${result.provider} returned invalid JSON`)

  return { ...result, parsed }
}

export function createTextModel({ systemInstruction, model, json = false, maxTokens = 4096, paid = false }) {
  return {
    async generateContent(prompt) {
      const result = await callLLM({
        system: systemInstruction || '',
        prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        json,
        maxTokens,
        model,
        paid
      })

      return { response: { text: () => result.text }, provider: result.provider, usedPaidKeys: result.usedPaidKeys }
    }
  }
}

/** Compatibility wrapper for service code expecting Google's model interface. */
export function createProviderGenAI({ paid = false } = {}) {
  const apiKey = listGeminiApiKeys({ paid })[0] || 'unused'
  const native = new GoogleGenerativeAI(apiKey)

  return {
    paid,
    getGenerativeModel(config = {}) {
      const wantsJson = config.generationConfig?.responseMimeType === 'application/json'

      return createTextModel({
        systemInstruction: config.systemInstruction || '',
        model: config.model || 'gemini-3.1-flash-lite',
        json: wantsJson,
        maxTokens: config.generationConfig?.maxOutputTokens || (wantsJson ? 8192 : 4096),
        paid
      })
    },
    getNativeModel(config = {}) {
      return native.getGenerativeModel(config)
    }
  }
}

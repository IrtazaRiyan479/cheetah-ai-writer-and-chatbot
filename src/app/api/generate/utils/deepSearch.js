import { GoogleGenAI } from '@google/genai'

import { serializeError } from '@/utils/serializeError'

import { rememberPaidInteraction, withGeminiKey } from './geminiKeys'
import { callGroq, callMistral } from './lightLLM'
import { isLimitError, resolveModel } from './llm'
import { listProviderKeys, withProviderKey } from './providerKeys'

const GEMINI_DEEP_RESEARCH_AGENT = 'deep-research-preview-04-2026'

function keyList(provider, paid) {
  const names = { xai: 'XAI', openai: 'OPENAI', anthropic: 'ANTHROPIC' }
  const name = names[provider]

  if (!name) return []

  const listName = paid ? `${name}_PAID_API_KEYS` : `${name}_API_KEYS`
  const prefix = paid ? `${name}_PAID_API_KEY_` : `${name}_API_KEY_`
  const single = paid ? `${name}_PAID_API_KEY` : `${name}_API_KEY`

  return listProviderKeys(listName, { numberedPrefix: prefix, legacySingles: [single] })
}

function keysFor(provider, paid) {
  const paidKeys = keyList(provider, true)
  const standard = keyList(provider, false)

  if (paid && paidKeys.length) return paidKeys

  return standard
}

function keysForPoll(provider, paid) {
  const paidKeys = keyList(provider, true)
  const standard = keyList(provider, false)
  const ordered = paid ? [...paidKeys, ...standard] : [...standard, ...paidKeys]

  return [...new Set(ordered)]
}

function isParameterError(error) {
  return /background|reasoning|max_output_tokens|web_search|unknown parameter|unexpected|not supported|extra (?:field|input)|invalid_request/i.test(
    serializeError(error)
  )
}

async function readJson(response) {
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

function responseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()
  if (typeof data?.content === 'string' && data.content.trim()) return data.content.trim()

  const choice = data?.choices?.[0]?.message?.content

  if (typeof choice === 'string' && choice.trim()) return choice.trim()

  const chunks = []
  const output = Array.isArray(data?.output) ? data.output : []

  for (const item of output) {
    if (typeof item?.text === 'string') chunks.push(item.text)
    if (typeof item?.content === 'string') chunks.push(item.content)

    if (Array.isArray(item?.content)) {
      for (const part of item.content) {
        if (typeof part === 'string') chunks.push(part)
        else if (typeof part?.text === 'string') chunks.push(part.text)
      }
    }
  }

  return chunks.join('\n').trim()
}

function hostedResult(data) {
  const status = String(data?.status || '').toLowerCase()
  const text = responseText(data)
  const running = ['queued', 'in_progress', 'processing', 'running', 'pending'].includes(status)
  const failed = ['failed', 'cancelled', 'canceled', 'expired'].includes(status)

  if (text && !running && !failed) return { status: 'completed', text }
  if (failed) return { status: 'failed', error: serializeError(data?.error || data?.last_error || 'Deep search failed.') }
  if (text && status === 'incomplete') return { status: 'completed', text }

  return { status: 'processing' }
}

function normalizeStart(data, prefix, { allowPending = true } = {}) {
  const provider = prefix === 'oa:' ? 'openai' : 'xai'
  const status = String(data?.status || '').toLowerCase()
  const text = responseText(data)
  const id = data?.id || data?.response_id
  const running = ['queued', 'in_progress', 'processing', 'running', 'pending'].includes(status)

  if (['failed', 'cancelled', 'canceled', 'expired'].includes(status)) {
    throw new Error(serializeError(data?.error || data) || `${provider} deep search failed to start.`)
  }

  if (text && !running) return { text, provider }
  if (!allowPending && running) throw new Error(`${provider} deep search has no pollable job.`)
  if (!id) throw new Error(`${provider} deep search did not return a job id.`)

  return { isDeepSearch: true, interactionId: `${prefix}${id}`, provider }
}

async function postHosted(url, apiKey, body, timeoutMs) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  })

  return readJson(response)
}

async function startHosted({ provider, paid, prefix, bodies, allowPending = true }) {
  const keys = keysFor(provider, paid)

  if (!keys.length) throw new Error(`${provider} API key is not configured.`)

  const url = provider === 'openai' ? 'https://api.openai.com/v1/responses' : 'https://api.x.ai/v1/responses'

  const data = await withProviderKey(
    keys,
    async apiKey => {
      let lastError

      for (const body of bodies) {
        try {
          return await postHosted(url, apiKey, body, 20000)
        } catch (error) {
          lastError = error
          if (isLimitError(error) || !isParameterError(error)) throw error
        }
      }

      throw lastError
    },
    `${provider}-deep-search`
  )

  return normalizeStart(data, prefix, { allowPending })
}

async function startOpenAI({ model, prompt, paid }) {
  const effort = /mini/i.test(model) ? 'low' : 'high'
  const input = prompt
  const tools = [{ type: 'web_search' }]

  return startHosted({
    provider: 'openai',
    paid,
    prefix: 'oa:',
    bodies: [
      { model, input, tools, background: true, reasoning: { effort }, max_output_tokens: 16000 },
      { model, input, tools, background: true, max_output_tokens: 16000 },
      { model, input, tools, background: true }
    ]
  })
}

async function startXai({ model, prompt, paid }) {
  const tools = [{ type: 'web_search' }]
  const input = [{ role: 'user', content: prompt }]

  return startHosted({
    provider: 'xai',
    paid,
    prefix: 'xai:',
    allowPending: false,
    bodies: [
      { model, input, tools, background: true },
      { model, input: prompt, tools, background: true }
    ]
  })
}

async function startGeminiDeepSearch({ prompt, paid }) {
  const interaction = await withGeminiKey(
    async apiKey => {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { retryOptions: { attempts: 0 } }
      })

      return ai.interactions.create({
        agent: GEMINI_DEEP_RESEARCH_AGENT,
        input: prompt,
        background: true
      })
    },
    { paid: Boolean(paid) }
  )

  if (!interaction?.id) throw new Error('Gemini deep search did not return an interaction id.')
  if (paid && interaction.id) rememberPaidInteraction(interaction.id)

  return { isDeepSearch: true, interactionId: interaction.id, provider: 'gemini' }
}

async function plainFallback({ system, prompt }) {
  const groq = await callGroq({ system, prompt, max_tokens: 8192, waitOn429: false })

  if (groq) return { text: groq, provider: 'groq' }

  const mistral = await callMistral({ system, prompt, max_tokens: 8192, timeoutMs: 20000 })

  if (mistral) return { text: mistral, provider: 'mistral' }

  return null
}

/**
 * OpenAI Responses background web_search is polled. xAI web_search is used when that
 * call returns the article in the same response. Claude, Groq, and Mistral have no
 * hosted deep-research job, so they use Gemini. A rate limit falls through to Groq, then Mistral.
 */
export async function startDeepSearch({ model, system, prompt, paid }) {
  const resolved = resolveModel(model || 'gemini-3.1-flash-lite')
  const researchPrompt = `${system || ''}\n\n${prompt || ''}`.trim()
  const usePaid = Boolean(paid)

  if (resolved.provider === 'openai' || resolved.provider === 'xai') {
    try {
      const started =
        resolved.provider === 'openai'
          ? await startOpenAI({ model: resolved.model, prompt: researchPrompt, paid: usePaid })
          : await startXai({ model: resolved.model, prompt: researchPrompt, paid: usePaid })

      if (usePaid && started.interactionId) rememberPaidInteraction(started.interactionId)

      return started
    } catch (error) {
      if (isLimitError(error)) {
        console.warn(`[deep-search] ${resolved.provider} rate limit; trying Groq then Mistral`)
        const fallback = await plainFallback({ system, prompt })

        if (fallback?.text) return fallback
        throw error
      }

      console.warn(
        `[deep-search] ${resolved.provider} model=${resolved.model} has no usable deep-search call; using Gemini: ${serializeError(error).slice(0, 240)}`
      )
    }
  } else if (resolved.provider !== 'gemini') {
    console.info(`[deep-search] ${resolved.provider} has no hosted deep-research job; using Gemini`)
  }

  try {
    return await startGeminiDeepSearch({ prompt: researchPrompt, paid: usePaid })
  } catch (error) {
    if (!isLimitError(error)) throw error

    console.warn('[deep-search] Gemini rate limit; trying Groq then Mistral')
    const fallback = await plainFallback({ system, prompt })

    if (fallback?.text) return fallback
    throw error
  }
}

async function pollHosted(baseUrl, responseId, keys, provider) {
  if (!keys.length) return { status: 'failed', error: `${provider} API key is not configured.` }

  let sawLimit = false
  let lastError = 'Deep search failed.'

  for (const apiKey of keys) {
    try {
      const response = await fetch(`${baseUrl}${encodeURIComponent(responseId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20000)
      })
      const data = await readJson(response)
      const mapped = hostedResult(data)

      if (mapped.status === 'completed' && !mapped.text) {
        return { status: 'failed', error: `${provider} deep search completed without text.` }
      }

      return mapped
    } catch (error) {
      lastError = serializeError(error)
      if (isLimitError(error)) sawLimit = true
      console.warn(`[deep-search] poll ${provider} failed: ${lastError.slice(0, 180)}`)
    }
  }

  if (sawLimit) return { status: 'processing' }

  return { status: 'failed', error: lastError }
}

export async function pollDeepSearch(id, { paid = false } = {}) {
  const raw = String(id || '')

  if (raw.startsWith('oa:')) {
    return pollHosted('https://api.openai.com/v1/responses/', raw.slice(3), keysForPoll('openai', paid), 'openai')
  }

  if (raw.startsWith('xai:')) {
    return pollHosted('https://api.x.ai/v1/responses/', raw.slice(3), keysForPoll('xai', paid), 'xai')
  }

  return null
}

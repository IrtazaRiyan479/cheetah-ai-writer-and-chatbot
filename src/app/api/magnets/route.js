import { NextResponse } from 'next/server'

import { serializeError } from '@/utils/serializeError'
import {
  inferKind,
  isGenericCalculator,
  literalDescription,
  literalTitle,
  stepsFor,
  validateFormula
} from '@/utils/magnetTool'

export const maxDuration = 300

// Do not import llm.js here. It loads @google/generative-ai and the article provider
// stack before this handler can log or respond, which held the first Gemini call.
console.info('[magnets] route module ready')

const INPUT_TYPES = new Set(['text', 'number', 'textarea'])
let runtimePromise = null

function loadRuntime() {
  if (!runtimePromise) {
    console.info('[magnets] importing model runtime')
    runtimePromise = Promise.all([
      import('@/libs/entitlement'),
      import('@/app/api/generate/utils/geminiKeys'),
      import('@/app/api/generate/utils/lightLLM'),
      import('@/app/api/generate/utils/providerKeys')
    ])
      .then(([entitlement, geminiKeys, lightLLM, providerKeys]) => ({
        paidKeysEnabledFor: entitlement.paidKeysEnabledFor,
        geminiGenerateContent: geminiKeys.geminiGenerateContent,
        callLightLLM: lightLLM.callLightLLM,
        parseJsonSafe: lightLLM.parseJsonSafe,
        runWithPaidKeys: providerKeys.runWithPaidKeys
      }))
      .catch(error => {
        runtimePromise = null
        throw error
      })
  }

  return runtimePromise
}

function fail(message, status = 502) {
  const error = new Error(message)

  error.status = status
  throw error
}

function genericPayload() {
  const description = 'A general-purpose calculator for everyday arithmetic.'

  return {
    instant: true,
    provider: 'local',
    plan: {
      title: 'Calculator',
      description,
      summary: 'A general-purpose calculator. The request was not turned into a niche tool.',
      kind: 'arithmetic',
      steps: stepsFor('arithmetic')
    },
    magnetConfig: {
      mode: 'arithmetic',
      title: 'Calculator',
      description
    }
  }
}

function slugId(label, index, seen) {
  const parts = String(label || '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  let id = parts
    .map((part, partIndex) => {
      const lower = part.toLowerCase()

      return partIndex === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
    .replace(/[^A-Za-z0-9]/g, '')

  if (!/^[A-Za-z]/.test(id)) id = `value${index + 1}`
  id = id.slice(0, 24)

  let unique = id
  let suffix = 2

  while (seen.has(unique)) unique = `${id}${suffix++}`
  seen.add(unique)

  return unique
}

function normalizeInputs(raw, { numericOnly = false, limit = 8 } = {}) {
  const inputs = []
  const seen = new Set()

  for (const input of Array.isArray(raw) ? raw : []) {
    if (!input || typeof input !== 'object') continue
    const label = String(input.label || '').trim().slice(0, 160)

    if (!label) continue

    const requested = numericOnly ? 'number' : INPUT_TYPES.has(input.type) ? input.type : 'text'
    const id = slugId(input.id && /^[A-Za-z][A-Za-z0-9]*$/.test(String(input.id)) ? input.id : label, inputs.length, seen)

    inputs.push({
      id,
      label,
      type: requested,
      placeholder: String(input.placeholder || '').trim().slice(0, 120),
      suffix: String(input.suffix || '').trim().slice(0, 16)
    })
    if (inputs.length >= limit) break
  }

  return inputs
}

function trustedInputs(raw, numericOnly) {
  const inputs = []
  const seen = new Set()

  for (const input of Array.isArray(raw) ? raw : []) {
    if (!input || typeof input !== 'object') continue

    const id = String(input.id || '')
    const label = String(input.label || '').trim().slice(0, 160)

    if (!/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(id) || !label || seen.has(id)) continue
    if (id === 'constructor' || id === 'prototype') continue
    seen.add(id)
    inputs.push({
      id,
      label,
      type: numericOnly ? 'number' : INPUT_TYPES.has(input.type) ? input.type : 'text',
      placeholder: String(input.placeholder || '').trim().slice(0, 120),
      suffix: String(input.suffix || '').trim().slice(0, 16)
    })
    if (inputs.length >= 6) break
  }

  return inputs
}

function readPlan(prompt, plan) {
  const source = plan && typeof plan === 'object' ? plan : {}
  const kind = inferKind(prompt, source.kind)
  const title = literalTitle(prompt, source.title || prompt)
  const description = literalDescription(prompt, source.description || source.summary || '', kind)

  return {
    title,
    description,
    summary: literalDescription(prompt, source.summary || description, kind),
    kind,
    steps: stepsFor(kind)
  }
}

async function callMagnetModel(runtime, { system, prompt, json, maxTokens, paid, label, temperature }) {
  const started = Date.now()

  console.info(`[magnets] ${label}: requesting gemini-3.1-flash-lite`)

  try {
    const data = await runtime.geminiGenerateContent({
      model: 'gemini-3.1-flash-lite',
      paid,
      timeoutMs: 30000,
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: 'application/json' } : {})
        }
      }
    })
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .join('')
      .trim()

    if (!text) throw new Error('Gemini returned an empty response.')
    console.info(`[magnets] ${label}: gemini responded in ${Date.now() - started}ms`)

    return { text, provider: 'gemini', model: 'gemini-3.1-flash-lite' }
  } catch (error) {
    console.warn(`[magnets] ${label}: gemini failed in ${Date.now() - started}ms: ${serializeError(error).slice(0, 180)}`)
    const light = await runtime.callLightLLM({
      system,
      prompt,
      json,
      max_tokens: Math.min(maxTokens, 4096),
      waitOn429: false,
      timeoutMs: 20000
    })

    if (!light?.text) throw error
    console.info(`[magnets] ${label}: fallback ${light.provider} in ${Date.now() - started}ms`)

    return { text: light.text, provider: light.provider, model: light.provider }
  }
}

async function callMagnetJson(runtime, args, accept) {
  let lastReason = 'The model did not return usable JSON.'
  let lastText = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? args.prompt
        : `${args.prompt}\n\nThe previous response was rejected: ${lastReason}\nPrevious response:\n${lastText.slice(0, 800)}\nReturn corrected JSON only.`
    const result = await callMagnetModel(runtime, { ...args, prompt, json: true })
    const parsed = runtime.parseJsonSafe(result.text)

    lastText = result.text || ''
    if (!parsed) {
      lastReason = 'Response was not valid JSON.'
      console.warn(`[magnets] ${args.label}: invalid json attempt ${attempt + 1}`)
      continue
    }

    const accepted = accept(parsed)

    if (accepted.ok) return { ...accepted, provider: result.provider, model: result.model }
    lastReason = accepted.reason || 'Response did not match the required tool shape.'
    console.warn(`[magnets] ${args.label}: rejected attempt ${attempt + 1}: ${lastReason}`)
  }

  fail(lastReason)
}

function planPrompt(prompt) {
  return `
The user asked for this tool and nothing else: "${prompt}"

Return JSON only:
{
  "title": "title using the user's wording",
  "description": "one sentence about that same request",
  "kind": "formula or assistant",
  "summary": "what will be built, with no added niche"
}

Rules:
- Do not invent a business, industry, product, or scenario the user did not write.
- If the user says only "Calculator", the title is "Calculator". Do not turn it into an ROI, savings, business, or automation calculator.
- kind "formula" when the result is a number computed from the user's numbers (calculator, converter, estimator).
- kind "assistant" only when the result must be written text.
`.trim()
}

function inputsPrompt(prompt, plan) {
  const shape =
    plan.kind === 'formula'
      ? `{ "inputs": [{ "label": "Input name from the user's request", "placeholder": "e.g. 20", "suffix": "" }] }`
      : `{ "inputs": [{ "label": "Question", "type": "text", "placeholder": "" }] }`

  return `
Build the input list for the user's tool: "${prompt}"
Planned title: "${plan.title}"
Kind: ${plan.kind}

Return JSON only:
${shape}

Rules:
- Stay on the user's topic. Do not add a niche they did not name.
- ${plan.kind === 'formula' ? '1 to 6 numeric inputs that a person would type into this calculator.' : '1 to 6 inputs. type is "text", "number", or "textarea".'}
- Labels must be specific to this request, not a generic marketing form.
`.trim()
}

function logicPrompt(prompt, plan, inputs) {
  const fields = inputs.map(input => `${input.id}: ${input.label}`).join('\n')

  if (plan.kind === 'formula') {
    return `
Write the calculation for the user's tool: "${prompt}"
Title: "${plan.title}"
Use only these ids:
${fields}

Return JSON only:
{
  "formula": "expression using the ids, numbers, + - * / and parentheses",
  "resultLabel": "name of the result",
  "resultPrefix": "",
  "resultSuffix": "",
  "decimals": 2
}

Rules:
- Every id must appear in the formula. Do not invent ids.
- The page calculates this itself. Do not describe an AI step.
- Do not change the topic.
`.trim()
  }

  return `
Write the instructions for a text tool: "${prompt}"
Title: "${plan.title}"
Inputs:
${fields}

Return JSON only:
{
  "buttonText": "short action label",
  "aiInstructions": "instructions for turning those inputs into the result the user asked for"
}

Rules:
- Stay on the user's topic. Do not invent a niche.
- aiInstructions must say how to use the inputs. Do not ask for extra inputs.
`.trim()
}

async function makePlan(runtime, prompt, paid) {
  const accepted = await callMagnetJson(
    runtime,
    {
      system: 'You plan interactive tools and reply with JSON only. Follow the user wording literally.',
      prompt: planPrompt(prompt),
      maxTokens: 700,
      paid,
      label: 'plan',
      temperature: 0.2
    },
    parsed => {
      const kind = inferKind(prompt, parsed.kind)
      const title = literalTitle(prompt, parsed.title || prompt)
      const description = literalDescription(prompt, parsed.description || '', kind)
      const summary = literalDescription(prompt, parsed.summary || description, kind)

      if (!title) return { ok: false, reason: 'Plan title was empty.' }

      return {
        ok: true,
        value: { title, description, summary, kind, steps: stepsFor(kind) }
      }
    }
  )

  return accepted.value
}

async function makeInputs(runtime, prompt, plan, paid) {
  const accepted = await callMagnetJson(
    runtime,
    {
      system: 'You choose tool inputs and reply with JSON only.',
      prompt: inputsPrompt(prompt, plan),
      maxTokens: 900,
      paid,
      label: 'inputs',
      temperature: 0.2
    },
    parsed => {
      const inputs = normalizeInputs(parsed.inputs, {
        numericOnly: plan.kind === 'formula',
        limit: plan.kind === 'formula' ? 6 : 6
      })

      if (!inputs.length) return { ok: false, reason: 'No usable inputs were returned.' }

      return { ok: true, value: inputs }
    }
  )

  return {
    title: plan.title,
    description: plan.description,
    inputs: accepted.value
  }
}

async function makeLogic(runtime, prompt, plan, draft, paid) {
  const inputs = trustedInputs(draft?.inputs, plan.kind === 'formula')

  if (!inputs.length) fail('Build the inputs before the calculation.', 400)

  const accepted = await callMagnetJson(
    runtime,
    {
      system:
        plan.kind === 'formula'
          ? 'You write calculator formulas and reply with JSON only.'
          : 'You write tool instructions and reply with JSON only.',
      prompt: logicPrompt(prompt, plan, inputs),
      maxTokens: 900,
      paid,
      label: 'logic',
      temperature: 0.2
    },
    parsed => {
      if (plan.kind === 'formula') {
        const check = validateFormula(parsed.formula, inputs)

        if (!check.ok) return check
        const decimals = Number(parsed.decimals)

        return {
          ok: true,
          value: {
            mode: 'formula',
            title: plan.title,
            description: plan.description,
            inputs,
            formula: check.formula,
            resultLabel: String(parsed.resultLabel || 'Result').trim().slice(0, 80) || 'Result',
            resultPrefix: String(parsed.resultPrefix || '').trim().slice(0, 8),
            resultSuffix: String(parsed.resultSuffix || '').trim().slice(0, 16),
            decimals: Number.isInteger(decimals) ? Math.max(0, Math.min(6, decimals)) : 2
          }
        }
      }

      const aiInstructions = String(parsed.aiInstructions || '').trim().slice(0, 4000)

      if (aiInstructions.length < 20) return { ok: false, reason: 'Result instructions were too short.' }

      return {
        ok: true,
        value: {
          mode: 'assistant',
          title: plan.title,
          description: plan.description,
          inputs,
          buttonText: String(parsed.buttonText || 'Generate').trim().slice(0, 80) || 'Generate',
          aiInstructions
        }
      }
    }
  )

  return accepted.value
}

async function executeMagnet(runtime, aiInstructions, userInputs, paid) {
  if (!String(aiInstructions || '').trim()) {
    return NextResponse.json(
      { success: false, error: 'This tool has no AI instructions yet. Create it again.' },
      { status: 400 }
    )
  }

  const result = await callMagnetModel(runtime, {
    system:
      'You are the execution engine for a specialized web tool. Provide a direct, helpful response in Markdown. Do not explain how you generated it.',
    prompt: `SYSTEM INSTRUCTIONS FOR THIS TOOL:\n${aiInstructions}\n\nUSER INPUT DATA TO PROCESS:\n${JSON.stringify(userInputs || {}, null, 2)}`,
    json: false,
    maxTokens: 2048,
    paid,
    label: 'execute',
    temperature: 0.4
  })

  return NextResponse.json({ success: true, result: result.text, provider: result.provider, model: result.model })
}

export async function POST(req) {
  const started = Date.now()

  console.info('[magnets] POST received')

  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Request body must be JSON.' }, { status: 400 })
    }

    const action = body.action || 'create'
    const prompt = String(body.prompt || '').trim()

    console.info(`[magnets] ${action} prompt="${prompt.slice(0, 120)}" +${Date.now() - started}ms`)

    if (!prompt && action !== 'execute') {
      return NextResponse.json({ success: false, error: 'Please provide a description.' }, { status: 400 })
    }

    if ((action === 'plan' || action === 'create') && isGenericCalculator(prompt)) {
      console.info(`[magnets] generic calculator served locally in ${Date.now() - started}ms (no database, no model)`)

      return NextResponse.json({ success: true, ...genericPayload() })
    }

    const runtime = await loadRuntime()
    const usePaidKeys = await runtime.paidKeysEnabledFor(['module-magnets'])

    console.info(`[magnets] runtime ready paid=${usePaidKeys} +${Date.now() - started}ms`)

    return await runtime.runWithPaidKeys(usePaidKeys, async () => {
      if (action === 'plan') {
        const plan = await makePlan(runtime, prompt, usePaidKeys)

        console.info(`[magnets] plan ready kind=${plan.kind} title="${plan.title}" +${Date.now() - started}ms`)

        return NextResponse.json({ success: true, instant: false, plan, provider: 'gemini' })
      }

      if (action === 'build') {
        const plan = readPlan(prompt, body.plan)
        const step = body.step === 'logic' ? 'logic' : body.step === 'inputs' ? 'inputs' : ''

        if (!step) {
          return NextResponse.json({ success: false, error: 'Build step must be inputs or logic.' }, { status: 400 })
        }

        if (step === 'inputs') {
          const draft = await makeInputs(runtime, prompt, plan, usePaidKeys)

          console.info(`[magnets] inputs ready count=${draft.inputs.length} +${Date.now() - started}ms`)

          return NextResponse.json({ success: true, partial: true, step: 'inputs', draft })
        }

        const magnetConfig = await makeLogic(runtime, prompt, plan, body.draft, usePaidKeys)

        console.info(`[magnets] logic ready mode=${magnetConfig.mode} +${Date.now() - started}ms`)

        return NextResponse.json({ success: true, magnetConfig })
      }

      if (action === 'create') {
        const plan = await makePlan(runtime, prompt, usePaidKeys)
        const draft = await makeInputs(runtime, prompt, plan, usePaidKeys)
        const magnetConfig = await makeLogic(runtime, prompt, plan, draft, usePaidKeys)

        return NextResponse.json({ success: true, plan, magnetConfig })
      }

      if (action === 'execute') return executeMagnet(runtime, body.aiInstructions, body.userInputs, usePaidKeys)

      return NextResponse.json({ success: false, error: 'Invalid action. Use plan, build, create, or execute.' }, { status: 400 })
    })
  } catch (error) {
    const message = serializeError(error)

    console.error(`[magnets] failed +${Date.now() - started}ms:`, message)

    return NextResponse.json(
      { success: false, error: message, code: error?.code || null },
      { status: error?.status || 500 }
    )
  }
}

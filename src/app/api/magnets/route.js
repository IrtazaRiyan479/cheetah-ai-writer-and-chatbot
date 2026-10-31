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

const INPUT_TYPES = new Set(['text', 'number', 'textarea', 'select'])
const MAGNET_MODELS = new Set([
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview-customtools',
  'claude-haiku-4-5',
  'claude-haiku-5-5',
  'claude-sonnet-4-5',
  'claude-sonnet-4-6',
  'claude-sonnet-5',
  'claude-sonnet-5-5',
  'claude-opus-4-6',
  'claude-opus-5-5',
  'gpt-5.2',
  'gpt-5-mini',
  'grok-4.7'
])
const DEFAULT_MAGNET_MODEL = 'gemini-3.5-flash'
let runtimePromise = null

function selectedModel(value) {
  const model = String(value || '').trim()

  return MAGNET_MODELS.has(model) ? model : DEFAULT_MAGNET_MODEL
}

function loadRuntime() {
  if (!runtimePromise) {
    console.info('[magnets] importing model runtime')
    runtimePromise = Promise.all([
      import('@/libs/entitlement'),
      import('@/app/api/generate/utils/lightLLM'),
      import('@/app/api/generate/utils/providerKeys'),
      import('@/app/api/generate/utils/llm')
    ])
      .then(([entitlement, lightLLM, providerKeys, llm]) => ({
        paidKeysEnabledFor: entitlement.paidKeysEnabledFor,
        parseJsonSafe: lightLLM.parseJsonSafe,
        runWithPaidKeys: providerKeys.runWithPaidKeys,
        callLLM: llm.callLLM
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

    const requested = numericOnly
      ? 'number'
      : input.type === 'select' && Array.isArray(input.options) && input.options.length
        ? 'select'
        : INPUT_TYPES.has(input.type)
          ? input.type
          : 'text'
    const options =
      requested === 'select'
        ? input.options.map(option => String(option?.label || option || '').trim().slice(0, 80)).filter(Boolean).slice(0, 12)
        : []
    const id = slugId(input.id && /^[A-Za-z][A-Za-z0-9]*$/.test(String(input.id)) ? input.id : label, inputs.length, seen)

    inputs.push({
      id,
      label,
      type: requested,
      placeholder: String(input.placeholder || '').trim().slice(0, 120),
      suffix: String(input.suffix || '').trim().slice(0, 16),
      ...(options.length ? { options } : {})
    })
    if (inputs.length >= 8) break
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
    const options =
      !numericOnly && input.type === 'select' && Array.isArray(input.options)
        ? input.options.map(option => String(option || '').trim().slice(0, 80)).filter(Boolean).slice(0, 12)
        : []

    seen.add(id)
    inputs.push({
      id,
      label,
      type: numericOnly ? 'number' : input.type === 'select' && options.length ? 'select' : INPUT_TYPES.has(input.type) ? input.type : 'text',
      placeholder: String(input.placeholder || '').trim().slice(0, 120),
      suffix: String(input.suffix || '').trim().slice(0, 16),
      ...(options.length ? { options } : {})
    })
    if (inputs.length >= 8) break
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

async function callMagnetModel(runtime, { system, prompt, json, maxTokens, paid, label, temperature, model }) {
  const started = Date.now()
  const chosen = selectedModel(model)

  console.info(`[magnets] ${label}: requesting ${chosen}`)

  const result = await runtime.callLLM({
    system,
    prompt: json ? `${prompt}\n\nReturn ONLY valid JSON. No markdown fences.` : prompt,
    json: false,
    maxTokens,
    temperature,
    model: chosen,
    paid,
    bareSystem: true,
    timeoutMs: label === 'execute' ? 60000 : 45000
  })

  if (!result?.text) throw new Error('The selected model returned an empty response.')
  console.info(`[magnets] ${label}: ${result.provider || chosen} responded in ${Date.now() - started}ms`)

  return { text: result.text, provider: result.provider || 'model', model: result.model || chosen }
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
The user wants this interactive tool: "${prompt}"

Return JSON only:
{
  "title": "short title from the user's request",
  "description": "one sentence of what the finished tool does",
  "kind": "formula or assistant",
  "summary": "what will be built"
}

Rules:
- Build the tool they asked for. It may be a calculator, quiz, checklist, comparison, planner, generator, gallery, form, chart, or any other interactive tool.
- Do not collapse the request into a generic calculator or a generic gallery unless that is what they asked for.
- Do not invent a business, industry, or scenario they did not write.
- kind "formula" ONLY when the whole result is one number from a closed arithmetic expression of numeric inputs.
- kind "assistant" for every other tool, including tools whose result is a layout, list, recommendation, piece of writing, or visual.
`.trim()
}

function inputsPrompt(prompt, plan) {
  const shape =
    plan.kind === 'formula'
      ? `{ "inputs": [{ "label": "Input name", "type": "number", "placeholder": "e.g. 20", "suffix": "" }] }`
      : `{ "inputs": [{ "label": "Question", "type": "text", "placeholder": "realistic example", "options": [] }] }`

  return `
Build the input list for this tool: "${prompt}"
Planned title: "${plan.title}"
Kind: ${plan.kind}

Return JSON only:
${shape}

Rules:
- 1 to 8 inputs that a person needs in order to produce this result.
- Stay on the user's request. Do not add an unrelated niche.
- type is "number", "text", "textarea", or "select".
- Use "textarea" when they will paste a list, several URLs, or a long note.
- Use "select" with an "options" array only when the choices are already known.
- Placeholders must be realistic examples for that field, not the word "Calculator".
`.trim()
}

function logicPrompt(prompt, plan, inputs) {
  const fields = inputs.map(input => `${input.id} (${input.type}): ${input.label}`).join('\n')

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
Write the run instructions for this tool: "${prompt}"
Title: "${plan.title}"
Inputs:
${fields}

Return JSON only:
{
  "buttonText": "short action label",
  "output": "html or markdown",
  "aiInstructions": "how to turn the inputs into the finished result"
}

Rules:
- output is "html" when the person should see a laid-out result: a gallery, cards, table, chart, comparison, checklist, quiz result, widget, or any other visual.
- output is "markdown" when the result is prose, advice, or a written answer.
- aiInstructions must say to use the user's inputs as the only source of facts. If they supplied URLs, those URLs must be used. Do not tell the runner to invent replacement data.
- For html output, tell the runner to return one HTML fragment with inline CSS and no code fence.
- Do not ask for inputs that are not listed.
`.trim()
}

async function makePlan(runtime, prompt, paid, model) {
  const accepted = await callMagnetJson(
    runtime,
    {
      system: 'You plan interactive tools of any kind and reply with JSON only. Follow the user request literally.',
      prompt: planPrompt(prompt),
      maxTokens: 700,
      paid,
      model,
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

async function makeInputs(runtime, prompt, plan, paid, model) {
  const accepted = await callMagnetJson(
    runtime,
    {
      system: 'You choose inputs for any interactive tool and reply with JSON only.',
      prompt: inputsPrompt(prompt, plan),
      maxTokens: 1200,
      paid,
      model,
      label: 'inputs',
      temperature: 0.2
    },
    parsed => {
      const inputs = normalizeInputs(parsed.inputs, {
        numericOnly: plan.kind === 'formula',
        limit: 8
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

async function makeLogic(runtime, prompt, plan, draft, paid, model) {
  const inputs = trustedInputs(draft?.inputs, plan.kind === 'formula')

  if (!inputs.length) fail('Build the inputs before the result logic.', 400)

  const accepted = await callMagnetJson(
    runtime,
    {
      system:
        plan.kind === 'formula'
          ? 'You write calculator formulas and reply with JSON only.'
          : 'You write instructions for any interactive tool and reply with JSON only.',
      prompt: logicPrompt(prompt, plan, inputs),
      maxTokens: 1400,
      paid,
      model,
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

      const aiInstructions = String(parsed.aiInstructions || '').trim().slice(0, 6000)

      if (aiInstructions.length < 20) return { ok: false, reason: 'Result instructions were too short.' }

      return {
        ok: true,
        value: {
          mode: 'assistant',
          title: plan.title,
          description: plan.description,
          inputs,
          output: parsed.output === 'html' ? 'html' : 'markdown',
          buttonText: String(parsed.buttonText || 'Generate').trim().slice(0, 80) || 'Generate',
          aiInstructions
        }
      }
    }
  )

  return accepted.value
}

async function executeMagnet(runtime, { aiInstructions, userInputs, paid, model, output }) {
  if (!String(aiInstructions || '').trim()) {
    return NextResponse.json(
      { success: false, error: 'This tool has no AI instructions yet. Create it again.' },
      { status: 400 }
    )
  }

  const visual = output === 'html'
  const result = await callMagnetModel(runtime, {
    system: visual
      ? 'You run one interactive tool. Return only the finished result as a single HTML fragment with inline CSS. No markdown fence, no commentary before or after. Use the user input as the only source of facts. If they supplied URLs, use those URLs and do not replace them.'
      : 'You run one interactive tool. Return only the finished result. If the result is a layout, gallery, table, chart, cards, checklist, or other visual, return one HTML fragment with inline CSS and no markdown fence. If the result is writing, return Markdown. Use the user input as the only source of facts. If they supplied URLs, use those URLs. Do not explain how you made it.',
    prompt: `TOOL INSTRUCTIONS:\n${aiInstructions}\n\nUSER INPUT:\n${JSON.stringify(userInputs || {}, null, 2)}`,
    json: false,
    maxTokens: 8192,
    paid,
    model,
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
    const model = selectedModel(body.model)

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
        const plan = await makePlan(runtime, prompt, usePaidKeys, model)

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
          const draft = await makeInputs(runtime, prompt, plan, usePaidKeys, model)

          console.info(`[magnets] inputs ready count=${draft.inputs.length} +${Date.now() - started}ms`)

          return NextResponse.json({ success: true, partial: true, step: 'inputs', draft })
        }

        const magnetConfig = await makeLogic(runtime, prompt, plan, body.draft, usePaidKeys, model)

        console.info(`[magnets] logic ready mode=${magnetConfig.mode} +${Date.now() - started}ms`)

        return NextResponse.json({ success: true, magnetConfig })
      }

      if (action === 'create') {
        const plan = await makePlan(runtime, prompt, usePaidKeys, model)
        const draft = await makeInputs(runtime, prompt, plan, usePaidKeys, model)
        const magnetConfig = await makeLogic(runtime, prompt, plan, draft, usePaidKeys, model)

        return NextResponse.json({ success: true, plan, magnetConfig })
      }

      if (action === 'execute') {
        return executeMagnet(runtime, {
          aiInstructions: body.aiInstructions,
          userInputs: body.userInputs,
          paid: usePaidKeys,
          model,
          output: body.output === 'html' ? 'html' : 'markdown'
        })
      }

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

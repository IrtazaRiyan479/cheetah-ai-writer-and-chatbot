import { NextResponse } from 'next/server'

import { serializeError } from '@/utils/serializeError'
import { callLLMCascade } from '@/app/api/generate/utils/llm'
import { parseJsonSafe } from '@/app/api/generate/utils/lightLLM'
import { runWithPaidKeys } from '@/app/api/generate/utils/providerKeys'
import { paidKeysEnabledFor } from '@/libs/entitlement'

export const maxDuration = 300

const INPUT_TYPES = new Set(['text', 'number', 'textarea'])

function normalizeMagnetConfig(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const inputs = (Array.isArray(parsed.inputs) ? parsed.inputs : [])
    .filter(input => input && typeof input === 'object' && String(input.label || '').trim())
    .slice(0, 4)
    .map((input, index) => ({
      id: String(input.id || `input_${index + 1}`).slice(0, 40),
      label: String(input.label).trim().slice(0, 160),
      type: INPUT_TYPES.has(input.type) ? input.type : 'text',
      placeholder: String(input.placeholder || '').slice(0, 200)
    }))

  if (!inputs.length || !String(parsed.aiInstructions || '').trim()) return null

  return {
    title: String(parsed.title || 'Your tool').trim().slice(0, 200),
    description: String(parsed.description || '').trim().slice(0, 500),
    inputs,
    buttonText: String(parsed.buttonText || 'Generate').trim().slice(0, 80) || 'Generate',
    aiInstructions: String(parsed.aiInstructions).trim().slice(0, 4000)
  }
}

function createPrompt(prompt) {
  return `
You are an expert software architect building custom interactive web tools (Lead Magnets).
The user wants to create a tool described as: "${prompt}".

Return ONLY valid JSON. No markdown fences. Use exactly this structure:
{
  "title": "A catchy, conversion-optimized title for the tool",
  "description": "A brief 1-2 sentence description explaining the value to the end user.",
  "inputs": [
    {
      "id": "input_1",
      "label": "User-friendly input label",
      "type": "text",
      "placeholder": "Helpful placeholder text"
    }
  ],
  "buttonText": "Action-oriented submit button text",
  "aiInstructions": "A system prompt instructing the AI on how to process the inputs to generate the final result."
}
"type" must be one of "text", "number", or "textarea".
Keep it to 1-4 highly relevant input fields.
`.trim()
}

async function createMagnet(prompt, paid) {
  const result = await callLLMCascade({
    system: 'You design lead-magnet tools and reply with JSON only.',
    prompt: createPrompt(prompt),
    json: true,
    maxTokens: 2048,
    temperature: 0.4,
    paid,
    accept: normalizeMagnetConfig
  })
  const magnetConfig = normalizeMagnetConfig(parseJsonSafe(result.text))

  if (!magnetConfig) {
    throw new Error('The AI responded, but the tool configuration was incomplete.')
  }

  return NextResponse.json({ success: true, magnetConfig, provider: result.provider, model: result.model })
}

async function executeMagnet(aiInstructions, userInputs, paid) {
  if (!aiInstructions) {
    return NextResponse.json({ success: false, error: 'This tool has no AI instructions yet. Create it again.' }, { status: 400 })
  }

  const result = await callLLMCascade({
    system:
      'You are the execution engine for a specialized web tool. Provide a direct, helpful, user-friendly, and concise response formatted cleanly in Markdown. Do not explain how you generated the result.',
    prompt: `SYSTEM INSTRUCTIONS FOR THIS TOOL:\n${aiInstructions}\n\nUSER INPUT DATA TO PROCESS:\n${JSON.stringify(userInputs || {}, null, 2)}`,
    maxTokens: 2048,
    temperature: 0.4,
    paid
  })

  return NextResponse.json({ success: true, result: result.text, provider: result.provider, model: result.model })
}

export async function POST(req) {
  try {
    const usePaidKeys = await paidKeysEnabledFor(['module-magnets'])

    return await runWithPaidKeys(usePaidKeys, async () => {
      const body = await req.json()
      const { action = 'create', prompt, aiInstructions, userInputs } = body

      if (action === 'create') {
        if (!prompt || !String(prompt).trim()) {
          return NextResponse.json({ success: false, error: 'Please provide a description.' }, { status: 400 })
        }

        return createMagnet(String(prompt), usePaidKeys)
      }

      if (action === 'execute') return executeMagnet(aiInstructions, userInputs, usePaidKeys)

      return NextResponse.json({ success: false, error: 'Invalid action. Use create or execute.' }, { status: 400 })
    })
  } catch (error) {
    const message = serializeError(error)

    console.error('AffiGenieMagnets API Error:', message)

    const status = error?.code === 'ALL_MODELS_EXHAUSTED' ? 502 : 500

    return NextResponse.json({ success: false, error: message, code: error?.code || null }, { status })
  }
}

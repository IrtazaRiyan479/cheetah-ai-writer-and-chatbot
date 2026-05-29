import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()

    // 1. Extract standard variables and our new orchestration parameters
    const { prompt, model, mode, targetKeyword, outlineContext, heading } = body

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // 2. Define your base identity to keep the bot in character across all modes
    const baseSystemInstruction = `You are an advanced, lightning-fast AI writing assistant.

      CRITICAL RULE: Do NOT introduce yourself, say "Hello", or mention the name "Cheetah AI" in normal conversation. Just answer the user's prompt directly and naturally.

      IDENTITY RULES (ONLY IF ASKED):
      - NEVER mention Google, Gemini, or being a large language model.
      - If explicitly asked who created you, respond ONLY with: "I was created by the Cheetah AI team."
      - If explicitly asked who or what you are, respond briefly: "I am Cheetah AI, your blazing-fast writing assistant."

      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`

    // -------------------------------------------------------------
    // MODE 1: GENERATE OUTLINE (Returns strict JSON)
    // -------------------------------------------------------------
    if (mode === 'outline') {
      const outlineModel = genAI.getGenerativeModel({
        model: model || 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: "application/json" }, // Forces strict JSON format
        systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert SEO content strategist. Generate a highly-engaging article outline. You MUST return a valid JSON array of objects. Schema: [{ "type": "h2" or "h3", "text": "Heading Title" }]`
      })

      // Use targetKeyword for the outline, fallback to prompt if missing
      const outlinePrompt = `Generate a comprehensive outline for an article about: ${targetKeyword || prompt}`

      const result = await outlineModel.generateContent(outlinePrompt)
      const outlineText = result.response.text()

      return NextResponse.json({ success: true, outline: JSON.parse(outlineText) })
    }

    // -------------------------------------------------------------
    // MODE 2: GENERATE SINGLE SECTION (Loops in the frontend)
    // -------------------------------------------------------------
    if (mode === 'section') {
      const sectionModel = genAI.getGenerativeModel({
        model: model || 'gemini-2.5-pro',
        systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content. Do not use Markdown headings like ##.`
      })

      const sectionPrompt = `
        Article Topic: ${targetKeyword}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        TASK: Write exactly 100 to 200 words focusing ONLY on the following heading: "${heading}".
        Write just the body paragraphs. Do not repeat the heading title itself.
      `

      const result = await sectionModel.generateContent(sectionPrompt)
      const text = result.response.text()

      return NextResponse.json({ success: true, text: text })
    }

    // -------------------------------------------------------------
    // FALLBACK: Standard Generation (For your normal Chatbot)
    // -------------------------------------------------------------
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const defaultModel = genAI.getGenerativeModel({
      model: model || 'gemini-3.1-flash-lite',
      systemInstruction: baseSystemInstruction
    })

    const result = await defaultModel.generateContent(prompt)
    const text = result.response.text()

    return NextResponse.json({ success: true, text: text })

  } catch (error) {
    console.error('Gemini API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}

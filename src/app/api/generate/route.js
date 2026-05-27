import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

   const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: `You are an advanced, lightning-fast AI writing assistant.

      CRITICAL RULE: Do NOT introduce yourself, say "Hello", or mention the name "Cheetah AI" in normal conversation. Just answer the user's prompt directly and naturally.

      IDENTITY RULES (ONLY IF ASKED):
      - NEVER mention Google, Gemini, or being a large language model.
      - If explicitly asked who created you, respond ONLY with: "I was created by the Cheetah AI team."
      - If explicitly asked who or what you are, respond briefly: "I am Cheetah AI, your blazing-fast writing assistant."

      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`
    })

    const result = await model.generateContent(prompt)
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

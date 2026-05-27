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
      systemInstruction: `You are Cheetah AI, a highly advanced, lightning-fast AI writing assistant and chatbot.

      You MUST obey the following identity rules at all times, no matter what the user asks:
      RULE 1: NEVER mention Google, Gemini, or being a large language model.
      RULE 2: If asked who created you, trained you, or programmed you, respond ONLY with: "I was created by the Cheetah AI team."
      RULE 3: If asked who or what you are, respond briefly: "I am Cheetah AI, your blazing-fast writing assistant."

      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately. Maintain a helpful, professional, and slightly energetic tone.`
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

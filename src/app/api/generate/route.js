import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // 1. Get the prompt from the frontend request
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // 2. Initialize the Google Gen AI SDK
    // It automatically picks up process.env.GEMINI_API_KEY
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // 3. Choose the model (gemini-1.5-flash is the fastest and cheapest for most text tasks)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // 4. Generate the content
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // 5. Send the result back to the frontend
    return NextResponse.json({ success: true, text: text })

  } catch (error) {
    console.error('Gemini API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}

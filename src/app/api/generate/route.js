import { NextResponse } from 'next/server'

import { GoogleGenerativeAI } from '@google/generative-ai'

import { generateLocalRoundupOutline, generateLocalRoundupSection } from './services/localRoundup'
import { generateListicleOutline, generateListicleSection } from './services/listicle'
import { generateStandardBlogOutline, generateStandardBlogSection } from './services/standard'
import { generateYoutubeBlogOutline, generateYoutubeBlogSection } from './services/youtubeBlog'
import { generateRewriteOutline, generateRewriteSection } from './services/rewrite'
import { generateAmazonRoundupOutline, generateAmazonRoundupSection } from './services/amazonRoundUp'
import { generateAmazonReviewOutline, generateAmazonReviewSection } from './services/amazonReview'
import { getBaseSystemInstruction } from './utils/helpers'

export async function POST(request) {
  try {
    const body = await request.json()
    const { mode, prompt, settings = {}, history = [] } = body
    const { type } = settings

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_FREE_API_KEY)

    if (mode === 'outline') {
      let result

      switch (type) {
        case 'local-roundup':
          result = await generateLocalRoundupOutline(body, genAI)
          break
        case 'listicle':
          result = await generateListicleOutline(body, genAI)
          break
        case 'youtube-blog':
          result = await generateYoutubeBlogOutline(body, genAI)
          break
        case 'rewrite':
          result = await generateRewriteOutline(body, genAI)
          break
        case 'amazon-roundup':
          result = await generateAmazonRoundupOutline(body, genAI)
          break
        case 'amazon-review':
          result = await generateAmazonReviewOutline(body, genAI)
          break
        default:
          result = await generateStandardBlogOutline(body, genAI)
          break
      }

      return NextResponse.json(result)
    }

    if (mode === 'section') {
      let result

      switch (type) {
        case 'local-roundup':
          result = await generateLocalRoundupSection(body, genAI)
          break
        case 'listicle':
          result = await generateListicleSection(body, genAI)
          break
        case 'youtube-blog':
          result = await generateYoutubeBlogSection(body, genAI)
          break
        case 'rewrite':
          result = await generateRewriteSection(body, genAI)
          break
        case 'amazon-roundup':
          result = await generateAmazonRoundupSection(body, genAI)
          break
        case 'amazon-review':
          result = await generateAmazonReviewSection(body, genAI)
          break
        default:
          result = await generateStandardBlogSection(body, genAI)
          break
      }

      return NextResponse.json(result)
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const defaultModel = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: getBaseSystemInstruction()
    })

    let cleanHistory = []
    let lastRole = null

    for (const msg of history) {
      const role = msg.senderId === 'ai-assistant' ? 'model' : 'user'

      if (cleanHistory.length === 0 && role === 'model') continue

      if (role !== lastRole) {
        cleanHistory.push({ role: role, parts: [{ text: msg.message }] })
        lastRole = role
      } else {
        cleanHistory[cleanHistory.length - 1].parts[0].text += `\n\n${msg.message}`
      }
    }

    const chat = defaultModel.startChat({
      history: cleanHistory
    })

    const result = await chat.sendMessage(prompt)

    return NextResponse.json({ success: true, text: result.response.text() })
  } catch (error) {
    console.error('Gemini API Error:', error)

    return NextResponse.json({ success: false, error: 'Failed to generate content', error }, { status: 500 })
  }
}

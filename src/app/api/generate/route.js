import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate, featureKeyForType } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

import { generateLocalRoundupOutline, generateLocalRoundupSection } from './services/localRoundup'
import { generateListicleOutline, generateListicleSection } from './services/listicle'
import { generateStandardBlogOutline, generateStandardBlogSection } from './services/standard'
import { generateYoutubeBlogOutline, generateYoutubeBlogSection } from './services/youtubeBlog'
import { generateRewriteOutline, generateRewriteSection } from './services/rewrite'
import { generateAmazonRoundupOutline, generateAmazonRoundupSection } from './services/amazonRoundUp'
import { generateAmazonReviewOutline, generateAmazonReviewSection } from './services/amazonReview'
import { getBaseSystemInstruction } from './utils/helpers'
import { callLLM, createProviderGenAI } from './utils/llm'
import { attachBrandedHero, fetchSerperOutlineData, pickRelevantImages } from './utils/helpers'

export const maxDuration = 60

function logStage(stage, started, type) {
  console.info(`[generate] ${stage} type=${type || 'blog'} ms=${Date.now() - started}`)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { mode, prompt, settings = {}, history = [] } = body
    const { type } = settings
    const session = await getServerSession(authOptions)
    const gate = await assertCanGenerate({
      userId: session?.user?.id,
      email: session?.user?.email,
      featureKey: featureKeyForType(type),
      estimatedWords: mode === 'section' ? 0 : 1
    })

    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status })
    }

    const genAI = createProviderGenAI()
    const started = Date.now()

    if (mode === 'prepare') {
      const keyword = settings.targetKeyword || body.targetKeyword || ''
      const title = settings.generatedTitle || keyword
      const [images, serp] = await Promise.all([
        pickRelevantImages(title, keyword, 6).catch(() => []),
        keyword ? fetchSerperOutlineData(keyword).catch(() => null) : null
      ])
      let amazon = null

      if ((type === 'amazon-roundup' || type === 'amazon-review') && keyword) {
        try {
          const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const res = await fetch(`${base}/api/amazon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword,
              domain: settings.amazonDomain || 'www.amazon.com',
              partnerTag: process.env.AMAZON_PARTNER_TAG || ''
            })
          })

          if (res.ok) amazon = await res.json()
        } catch {
          amazon = null
        }
      }

      logStage('prepare', started, type)

      return NextResponse.json({ success: true, shared: { images, serp, amazon } })
    }

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
        case 'amazon-roundup-rewrite':
        case 'amazon-review-rewrite':
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

      logStage('outline', started, type)

      return NextResponse.json(await attachBrandedHero(result, settings))
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
        case 'amazon-roundup-rewrite':
        case 'amazon-review-rewrite':
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

      logStage('section', started, type)

      return NextResponse.json(result)
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const historyText = (Array.isArray(history) ? history : [])
      .map(msg => `${msg?.senderId === 'ai-assistant' ? 'Assistant' : 'User'}: ${msg?.message || ''}`)
      .filter(Boolean)
      .join('\n\n')

    const result = await callLLM({
      system: getBaseSystemInstruction(),
      prompt: historyText ? `${historyText}\n\nUser: ${prompt}` : prompt,
      maxTokens: 2048
    })

    return NextResponse.json({ success: true, text: result.text })
  } catch (error) {
    const msg = serializeError(error)

    const isCapacity =
      /429|quota|rate.?limit|503|high demand|unavailable|overloaded|OUTLINE_PARSE_FAILED|RATE_LIMIT/i.test(msg)

    return NextResponse.json({ success: false, skipped: isCapacity, error: msg }, { status: isCapacity ? 200 : 500 })
  }
}

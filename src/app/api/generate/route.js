import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { resolveGenerationAccess, claimFreeWords, settleReservedWords, FEATURE_KEYS } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

import { generateLocalRoundupOutline, generateLocalRoundupSection } from './services/localRoundup'
import { generateListicleOutline, generateListicleSection } from './services/listicle'
import { generateStandardBlogOutline, generateStandardBlogSection } from './services/standard'
import { generateYoutubeBlogOutline, generateYoutubeBlogSection } from './services/youtubeBlog'
import { generateRewriteOutline, generateRewriteSection } from './services/rewrite'
import { generateAmazonRoundupOutline, generateAmazonRoundupSection } from './services/amazonRoundUp'
import { generateAmazonReviewOutline, generateAmazonReviewSection } from './services/amazonReview'
import { generateProductComparisonOutline, generateProductComparisonSection, validateProductComparisonUrls } from './services/productComparison'
import { getBaseSystemInstruction } from './utils/helpers'
import { callLLM, createProviderGenAI } from './utils/llm'
import { runWithPaidKeys } from './utils/providerKeys'
import { attachBrandedHero, fetchSerperOutlineData, pickRelevantImages } from './utils/helpers'

export const maxDuration = 60

function logStage(stage, started, type) {
  console.info(`[generate] ${stage} type=${type || 'blog'} ms=${Date.now() - started}`)
}

export async function POST(request) {
  let reserved = 0
  let reserveUserId = null

  try {
    const body = await request.json()
    const { mode, prompt, settings = {}, history = [] } = body
    const { type } = settings
    if (type === 'product-comparison') {
      const validation = validateProductComparisonUrls(settings.productComparisonUrls)
      if (!validation.ok) return NextResponse.json({ success: false, error: serializeError(new Error('Provide two or three valid Amazon product URLs.')) }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    const extraFeatureKeys = []
    if (!mode && prompt && Array.isArray(history)) extraFeatureKeys.push('module-chat')
    if (Array.isArray(body.extraFeatureKeys)) {
      for (const key of body.extraFeatureKeys) {
        if (typeof key === 'string' && FEATURE_KEYS.includes(key)) extraFeatureKeys.push(key)
      }
    }
    const gate = await resolveGenerationAccess({
      userId: session?.user?.id,
      email: session?.user?.email,
      settings,
      type,
      model: settings.model || body.model,
      estimatedWords: mode === 'section' ? 0 : 1,
      extraFeatureKeys
    })

    if (!gate.ok) {
      return NextResponse.json(
        { success: false, error: serializeError(gate.error), code: gate.code || null },
        { status: gate.status }
      )
    }

    return await runWithPaidKeys(Boolean(gate.usePaidKeys), async () => {
    const genAI = createProviderGenAI({ paid: Boolean(gate.usePaidKeys) })
    const started = Date.now()
    console.info(`[generate] keys=${gate.usePaidKeys ? 'paid' : 'free'} features=${(gate.activeKeys || []).join(',')}`)

    const reserveFreeWords = async () => {
      if (gate.paid || !gate.user?.id) return true
      const claim = await claimFreeWords(gate.user.id)
      if (claim.blocked) return false
      reserved = claim.claimed || 0
      reserveUserId = gate.user.id
      return true
    }

    if (mode === 'prepare' && type === 'product-comparison') return NextResponse.json({ success: true, shared: {} })

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
        case 'product-comparison':
          result = await generateProductComparisonOutline(body)
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

      return NextResponse.json(type === 'product-comparison' ? result : await attachBrandedHero(result, settings))
    }

    if (mode === 'section') {
      if (!(await reserveFreeWords())) {
        return NextResponse.json(
          { success: false, error: 'Free word limit reached. Upgrade to Pro for unlimited writing.', code: 'WORD_LIMIT' },
          { status: 402 }
        )
      }

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
        case 'product-comparison':
          result = await generateProductComparisonSection(body)
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

      const sectionText = result?.text || result?.content || result?.html || ''
      if (gate.user?.id) await settleReservedWords(gate.user.id, reserved, sectionText)
      reserved = 0

      return NextResponse.json(result)
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const historyText = (Array.isArray(history) ? history : [])
      .map(msg => `${msg?.senderId === 'ai-assistant' ? 'Assistant' : 'User'}: ${msg?.message || ''}`)
      .filter(Boolean)
      .join('\n\n')

    if (!(await reserveFreeWords())) {
      return NextResponse.json(
        { success: false, error: 'Free word limit reached. Upgrade to Pro for unlimited writing.', code: 'WORD_LIMIT' },
        { status: 402 }
      )
    }

    const result = await callLLM({
      system: getBaseSystemInstruction(),
      prompt: historyText ? `${historyText}\n\nUser: ${prompt}` : prompt,
      maxTokens: 2048,
      model: settings.model || 'gemini-3.1-flash-lite',
      paid: Boolean(gate.usePaidKeys)
    })

    if (gate.user?.id) await settleReservedWords(gate.user.id, reserved, result?.text || '')
    reserved = 0

    return NextResponse.json({ success: true, text: result.text })
    })
  } catch (error) {
    if (reserved && reserveUserId) {
      await settleReservedWords(reserveUserId, reserved, '').catch(() => {})
      reserved = 0
    }
    const msg = serializeError(error)
    const isPaidKeys = error?.code === 'PAID_KEYS_FAILED' || /Low credits/i.test(msg)
    if (isPaidKeys) {
      return NextResponse.json({ success: false, error: 'Low credits.', code: 'PAID_KEYS_FAILED' }, { status: 502 })
    }
    const isCapacity =
      /429|quota|rate.?limit|503|high demand|unavailable|overloaded|OUTLINE_PARSE_FAILED|RATE_LIMIT/i.test(msg)

    return NextResponse.json({ success: false, skipped: isCapacity, error: msg }, { status: isCapacity ? 200 : 500 })
  }
}

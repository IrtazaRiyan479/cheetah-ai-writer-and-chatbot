import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

export const maxDuration = 60

function appBase(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')

  if (!host) return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const proto =
    request.headers.get('x-forwarded-proto') ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')

  return `${proto}://${host}`
}

function ownerId(session) {
  return session?.user?.id || session?.user?.email || ''
}

const batches = globalThis.__affigenieBatches || (globalThis.__affigenieBatches = new Map())

async function canBatch(session) {
  const gate = await assertCanGenerate({
    userId: session?.user?.id,
    email: session?.user?.email,
    featureKey: 'batch-generate',
    estimatedWords: 1
  })

  return gate.ok
}

async function runPool(items, limit, worker) {
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++

      await worker(items[index], index)
    }
  })

  await Promise.all(runners)
}

export async function GET(request) {
  const session = await getServerSession(authOptions)

  if (!(await canBatch(session))) {
    return NextResponse.json(
      { success: false, error: 'Batch generation requires a Pro or admin account.' },
      { status: 403 }
    )
  }

  const id = new URL(request.url).searchParams.get('id')
  const batch = batches.get(id)

  if (!batch || batch.userId !== ownerId(session)) {
    return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, batch })
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!(await canBatch(session))) {
      return NextResponse.json(
        { success: false, error: 'Batch generation requires a Pro or admin account.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const articles = Array.isArray(body.articles) ? body.articles.slice(0, 20) : []

    if (!articles.length) {
      return NextResponse.json({ success: false, error: 'At least one article is required.' }, { status: 400 })
    }

    const id = body.batchId || `batch-${Date.now()}`
    const existing = batches.get(id)
    const userId = ownerId(session)

    if (existing && existing.userId !== userId) {
      return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 404 })
    }

    const startAt = existing?.nextIndex || 0

    const batch = existing || {
      id,
      userId,
      status: 'running',
      total: articles.length,
      nextIndex: 0,
      results: []
    }

    batch.status = 'running'
    batches.set(id, batch)

    const base = appBase(request)
    const cookie = request.headers.get('cookie') || ''
    const pending = articles.slice(startAt)

    await runPool(pending, 2, async (article, pendingIndex) => {
      const started = Date.now()
      const settings = article.settings || article
      const keyword = settings.targetKeyword || ''
      const index = Number.isInteger(article.index) ? article.index : startAt + pendingIndex

      try {
        const res = await fetch(`${base}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie
          },
          cache: 'no-store',
          body: JSON.stringify({
            mode: 'outline',
            settings,
            extraFeatureKeys: ['batch-generate'],
            targetKeyword: keyword || 'General Topic',
            model: settings.model,
            articleLength: settings.articleLength,
            customArticleLength: settings.customArticleLength,
            language: settings.language,
            country: settings.country,
            automaticExternalLinks: settings.automaticExternalLinks,
            includeFaq: settings.includeFaq,
            includeKeyTakeaways: settings.includeKeyTakeaways
          })
        })

        const data = await res.json().catch(() => ({}))
        const created = Boolean(res.ok && data.success && Array.isArray(data.outline))

        batch.results.push({
          index,
          ok: created,
          keyword,
          title: data.title || keyword,
          outline: created ? data.outline : null,
          externalLinks: data.externalLinks || null,
          heroImage: data.heroImage || null,
          heroImageId: data.heroImageId ?? null,
          heroImageSource: data.heroImageSource || null,
          comparisonShared: data.comparisonShared || null,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          error: created ? null : serializeError(data?.error || data || `Outline failed (${res.status})`),
          ms: Date.now() - started
        })
      } catch (error) {
        batch.results.push({
          index,
          ok: false,
          keyword,
          title: keyword,
          outline: null,
          error: serializeError(error),
          ms: Date.now() - started
        })
      }

      batch.nextIndex += 1
    })

    batch.status = batch.nextIndex >= batch.total ? 'complete' : 'paused'
    console.info(`[generate] batch id=${id} done=${batch.nextIndex} total=${batch.total}`)

    return NextResponse.json({ success: true, batch })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

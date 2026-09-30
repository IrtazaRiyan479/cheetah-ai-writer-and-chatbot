import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

export const maxDuration = 60

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
    return NextResponse.json({ success: false, error: 'Batch generation requires a Pro or admin account.' }, { status: 403 })
  }

  const id = new URL(request.url).searchParams.get('id')
  const batch = batches.get(id)

  if (!batch) return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 404 })

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
    const startAt = existing?.nextIndex || 0
    const batch = existing || {
      id,
      status: 'running',
      total: articles.length,
      nextIndex: 0,
      results: []
    }

    batch.status = 'running'
    batches.set(id, batch)

    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const pending = articles.slice(startAt)

    await runPool(pending, 2, async article => {
      const started = Date.now()

      try {
        const res = await fetch(`${base}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'outline', settings: article.settings || article })
        })
        const data = await res.json()

        batch.results.push({ ok: Boolean(data.success), title: data.title || '', ms: Date.now() - started })
      } catch (error) {
        batch.results.push({ ok: false, error: serializeError(error), ms: Date.now() - started })
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

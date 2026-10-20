import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate, getFeatureModes } from '@/libs/entitlement'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const prisma = global.prismaCalendar || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prismaCalendar = prisma

const ADMIN_EMAIL = 'abrarshovon@admin.com'
const ACTION_TYPES = ['Draft', 'Published', 'Scheduled']
const ARTICLE_TYPE_LABELS = {
  blog: 'Blog Post',
  listicle: 'Listicle',
  'local-roundup': 'Local Places Roundup',
  'amazon-roundup': 'Amazon Product Roundup',
  'amazon-review': 'Amazon Single Product Review',
  'product-comparison': 'Product Comparison',
  'youtube-blog': 'YouTube Video to Blog Post',
  rewrite: 'Rewrite Blog Post',
  'amazon-roundup-rewrite': 'Rewrite Amazon Roundup',
  'amazon-review-rewrite': 'Rewrite Amazon Review'
}

function normalizeWpSiteUrl(url) {
  let clean = String(url || '').trim()

  if (!clean) throw new Error('WordPress site URL is missing.')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`

  return clean.replace(/\/+$/, '').replace(/\/wp-json(?:\/wp\/v2)?$/i, '')
}

function toWpGmt(value) {
  const when = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(when.getTime())) throw new Error('Choose a valid date.')

  return when.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function wpMessage(data, status) {
  const raw = data?.message || data?.error || 'WordPress request failed.'
  const message = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `WordPress HTTP ${status}: ${message}`.slice(0, 400)
}

function readableError(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'WordPress request timed out.'

  return error?.message || 'WordPress request failed.'
}

async function requireUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) return { session: null, user: null }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })

  return { session, user }
}

function predefinedSites() {
  try {
    const parsed = JSON.parse(process.env.PREDEFINED_WP_SITES || '[]')

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function connectedSites(user, session) {
  const sites = []
  const saved = await prisma.customWPSite.findMany({ where: { userId: user.id } })

  saved.forEach(site => {
    sites.push({
      siteKey: `db_${site.id}`,
      label: site.name || site.url,
      url: site.url,
      username: site.username,
      password: site.password
    })
  })

  const email = String(session?.user?.email || '').trim().toLowerCase()

  if (email === ADMIN_EMAIL) {
    predefinedSites().forEach(site => {
      if (!site?.id || !site?.url) return

      sites.push({
        siteKey: site.id,
        label: site.name || site.id,
        url: site.url,
        username: site.username,
        password: site.password
      })
    })
  }

  return sites
}

function publicSites(sites) {
  return sites.map(site => ({
    value: site.siteKey,
    label: site.label || site.siteKey
  }))
}

function siteAuth(site) {
  const base = normalizeWpSiteUrl(site.url)
  const password = String(site.password || '').replace(/\s+/g, '')
  const authorization = `Basic ${Buffer.from(`${site.username}:${password}`).toString('base64')}`

  return { ...site, base, authorization }
}

async function wpRequest(site, path, { method = 'GET', payload } = {}) {
  const response = await fetch(`${site.base}${path}`, {
    method,
    headers: {
      Authorization: site.authorization,
      ...(payload ? { 'Content-Type': 'application/json' } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: 'no-store'
  })
  const raw = await response.text()
  let data = null

  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    const error = new Error(data ? wpMessage(data, response.status) : `WordPress HTTP ${response.status}`)

    error.status = response.status
    error.code = data?.code || ''
    throw error
  }

  return { data, response }
}

function readMeta(article) {
  try {
    const value = JSON.parse(article?.publishMeta || '')

    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function isOutlineLike(article) {
  const status = String(article?.status || '').toLowerCase()

  if (status === 'outline') return true

  const content = String(article?.content || '').trim()
  const outline = String(article?.outline || '').trim()

  return !content && Boolean(outline)
}

function isHidden(article) {
  return readMeta(article).hidden === true
}

function articleTypeFromContent(content) {
  const html = String(content || '')
  const attr = html.match(/data-affigenie-type=["']([a-z0-9-]+)["']/i)

  if (attr?.[1]) return attr[1].toLowerCase()

  const marker = html.match(/affigenie-article-type:([a-z0-9-]+)/i)

  if (marker?.[1]) return marker[1].toLowerCase()

  return ''
}

function articleTypeLabel(type) {
  if (!type) return 'Article'

  return ARTICLE_TYPE_LABELS[type] || 'Article'
}

function laneForStatus(status) {
  const value = String(status || '').toLowerCase()

  if (value === 'scheduled') return 'Scheduled'
  if (value === 'published' || value === 'promotion') return 'Published'
  if (value === 'draft' || value === 'revision') return 'Draft'

  return 'Draft'
}

function asDate(value) {
  if (!value) return null

  const when = value instanceof Date ? value : new Date(value)

  return Number.isNaN(when.getTime()) ? null : when
}

function eventStart(article, meta, lane) {
  if (lane === 'Scheduled') {
    const scheduled = asDate(article.scheduledAt)

    if (scheduled) return scheduled
  }

  const fromMeta = asDate(meta.start)

  if (fromMeta) return fromMeta
  if (lane === 'Published') return asDate(article.updatedAt) || asDate(article.createdAt) || new Date()

  return asDate(article.createdAt) || new Date()
}

function toArticleEvent(article) {
  const meta = readMeta(article)
  const lane = laneForStatus(article.status)
  const start = eventStart(article, meta, lane)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  const articleType = articleTypeFromContent(article.content)

  return {
    id: article.id,
    display: 'block',
    title: article.title || 'Untitled article',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    url: '',
    extendedProps: {
      calendar: lane,
      guests: [],
      description: typeof meta.description === 'string' ? meta.description : '',
      articleId: article.id,
      articleType,
      articleTypeLabel: articleTypeLabel(articleType),
      siteKey: article.targetSite || (typeof meta.siteKey === 'string' ? meta.siteKey : '') || '',
      createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : null,
      wpPostId: article.wpPostId || null
    }
  }
}

function toDraftOption(article) {
  const articleType = articleTypeFromContent(article.content)

  return {
    id: article.id,
    title: article.title || 'Untitled article',
    createdAt: article.createdAt ? new Date(article.createdAt).toISOString() : null,
    articleType,
    articleTypeLabel: articleTypeLabel(articleType)
  }
}

function writeMeta(article, patch) {
  return JSON.stringify({
    ...readMeta(article),
    ...patch,
    allDay: false,
    hidden: patch.hidden === true
  })
}

async function loadOwnedArticle(userId, articleId) {
  if (!articleId) return null

  return prisma.article.findFirst({ where: { id: String(articleId), userId } })
}


async function assertCalendarModuleOpen() {
  const modes = await getFeatureModes()
  const mode = modes['module-calendar'] || 'free'

  if (mode === 'off') {
    return NextResponse.json({ error: 'Publishing Calendar is turned off.' }, { status: 403 })
  }

  return null
}

export async function GET() {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = await assertCalendarModuleOpen()
    if (blocked) return blocked

    const articles = await prisma.article.findMany({
      where: {
        userId: user.id,
        NOT: { status: { in: ['outline', 'archived'] } }
      },
      orderBy: { createdAt: 'desc' }
    })
    const visible = articles.filter(article => !isOutlineLike(article) && !isHidden(article))
    const sites = publicSites(await connectedSites(user, session))

    return NextResponse.json({
      events: visible.map(toArticleEvent),
      drafts: visible.filter(article => String(article.status || '').toLowerCase() === 'draft').map(toDraftOption),
      sites,
      warnings: []
    })
  } catch (error) {
    console.error(error?.message || 'Calendar load failed')
    const message = String(error?.message || '')
    if (/scheduledAt|does not exist in the current database/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Database is missing Article.scheduledAt (and possibly other calendar columns). Run the migration 20261020123000_article_calendar_fields or apply src/prisma/add_article_calendar_columns.sql, then restart the server.'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: readableError(error) || 'Failed to load the calendar.' }, { status: 500 })
  }
}

async function saveAction(user, session, body) {
  const calendar = body.calendar
  const article = await loadOwnedArticle(user.id, body.articleId || body.id)

  if (!article || isOutlineLike(article)) {
    return NextResponse.json(
      { error: article ? 'Outlines cannot be placed on the calendar. Generate the article first.' : 'Article not found.' },
      { status: 400 }
    )
  }

  if (!ACTION_TYPES.includes(calendar)) {
    return NextResponse.json({ error: 'Choose Draft, Published, or Scheduled.' }, { status: 400 })
  }

  const sites = await connectedSites(user, session)
  const site = sites.find(item => item.siteKey === String(body.siteKey || ''))

  if (!site) {
    return NextResponse.json({ error: 'Add a WordPress site in the writer before scheduling.' }, { status: 400 })
  }

  const description = String(body.description || '').slice(0, 8000)

  if (calendar === 'Draft') {
    const start = asDate(article.createdAt) || new Date()
    const updated = await prisma.article.update({
      where: { id: article.id },
      data: {
        status: 'draft',
        targetSite: site.siteKey,
        scheduledAt: null,
        publishMeta: writeMeta(article, {
          calendar: 'Draft',
          start: start.toISOString(),
          end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
          description,
          siteKey: site.siteKey,
          hidden: false
        })
      }
    })

    return NextResponse.json({ event: toArticleEvent(updated) })
  }

  const gate = await assertCanGenerate({
    userId: user.id,
    email: session?.user?.email,
    featureKey: 'wp-publish',
    estimatedWords: 0
  })

  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status || 403 })

  let start = new Date()

  if (calendar === 'Scheduled') {
    start = asDate(body.start)

    if (!start) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
    if (start.getTime() <= Date.now() + 60 * 1000) {
      return NextResponse.json({ error: 'Scheduled posts must be at least one minute in the future.' }, { status: 400 })
    }
  }

  const wpStatus = calendar === 'Scheduled' ? 'future' : 'publish'
  const authed = siteAuth(site)
  const payload = {
    title: article.title || 'Untitled article',
    status: wpStatus
  }

  if (!article.wpPostId) payload.content = article.content || ''
  if (wpStatus === 'future') payload.date_gmt = toWpGmt(start)

  const path = article.wpPostId ? `/wp-json/wp/v2/posts/${article.wpPostId}` : '/wp-json/wp/v2/posts'
  let wpPostId = article.wpPostId || null

  try {
    const { data } = await wpRequest(authed, path, { method: 'POST', payload })

    wpPostId = Number(data?.id) || wpPostId
    if (!wpPostId) throw new Error('WordPress did not return a post id.')
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      status: calendar === 'Scheduled' ? 'scheduled' : 'published',
      wpPostId: Number(wpPostId),
      targetSite: site.siteKey,
      scheduledAt: calendar === 'Scheduled' ? start : null,
      publishMeta: writeMeta(article, {
        calendar,
        start: start.toISOString(),
        end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
        description,
        siteKey: site.siteKey,
        hidden: false
      })
    }
  })

  return NextResponse.json({ event: toArticleEvent(updated) })
}

async function moveEvent(user, session, body) {
  const article = await loadOwnedArticle(user.id, body.articleId || body.id)

  if (!article || isOutlineLike(article)) {
    return NextResponse.json({ error: article ? 'Outlines cannot be moved on the calendar.' : 'Article not found.' }, { status: 400 })
  }

  const start = asDate(body.start)

  if (!start) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })

  const scheduled = String(article.status || '').toLowerCase() === 'scheduled'

  if (scheduled && article.wpPostId) {
    const sites = await connectedSites(user, session)
    const site = sites.find(item => item.siteKey === (article.targetSite || body.siteKey || ''))

    if (!site) {
      return NextResponse.json({ error: 'Add a WordPress site in the writer before scheduling.' }, { status: 400 })
    }

    try {
      await wpRequest(siteAuth(site), `/wp-json/wp/v2/posts/${article.wpPostId}`, {
        method: 'POST',
        payload: { date_gmt: toWpGmt(start) }
      })
    } catch (error) {
      return NextResponse.json({ error: readableError(error) }, { status: 400 })
    }
  }

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      scheduledAt: scheduled ? start : article.scheduledAt,
      publishMeta: writeMeta(article, {
        start: start.toISOString(),
        end: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
        hidden: false
      })
    }
  })

  return NextResponse.json({ event: toArticleEvent(updated) })
}

async function writeEvent(request) {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = await assertCalendarModuleOpen()
    if (blocked) return blocked

    const body = await request.json()
    const intent = body.intent === 'move' ? 'move' : 'action'

    if (intent === 'move') return moveEvent(user, session, body)

    return saveAction(user, session, body)
  } catch (error) {
    console.error(error?.message || 'Calendar save failed')

    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }
}

export async function POST(request) {
  return writeEvent(request)
}

export async function PUT(request) {
  return writeEvent(request)
}

export async function DELETE(request) {
  try {
    const { user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = await assertCalendarModuleOpen()
    if (blocked) return blocked

    const article = await loadOwnedArticle(user.id, new URL(request.url).searchParams.get('id'))

    if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 400 })

    await prisma.article.update({
      where: { id: article.id },
      data: { publishMeta: writeMeta(article, { hidden: true }) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error?.message || 'Calendar hide failed')

    return NextResponse.json({ error: readableError(error) }, { status: 400 })
  }
}

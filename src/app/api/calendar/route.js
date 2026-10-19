import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate } from '@/libs/entitlement'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const prisma = global.prismaCalendar || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prismaCalendar = prisma

const CALENDARS = ['Scheduled', 'Published', 'Draft', 'Revision', 'Promotion']
const ADMIN_EMAIL = 'abrarshovon@admin.com'
const MARKER_RE = /<!--affigenie-calendar:([A-Za-z0-9_-]+)-->/g
const CHANNELS = ['WordPress', 'Medium', 'LinkedIn', 'Newsletter', 'Facebook', 'Pinterest']

function normalizeWpSiteUrl(url) {
  let clean = String(url || '').trim()

  if (!clean) throw new Error('WordPress site URL is missing.')
  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`

  return clean.replace(/\/+$/, '').replace(/\/wp-json(?:\/wp\/v2)?$/i, '')
}

function decodeMarker(html) {
  const match = MARKER_RE.exec(String(html || ''))

  MARKER_RE.lastIndex = 0
  if (!match) return {}

  try {
    const value = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'))

    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function embedMarker(html, meta) {
  const clean = String(html || '').replace(MARKER_RE, '').trim()
  const token = Buffer.from(JSON.stringify(meta), 'utf8').toString('base64url')

  return `${clean}\n<!--affigenie-calendar:${token}-->`.trim()
}

function plainTitle(post) {
  const raw = post?.title?.raw

  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 240)

  const rendered = String(post?.title?.rendered || 'Untitled article')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return (rendered || 'Untitled article').slice(0, 240)
}

function isoFromGmt(value) {
  if (!value || String(value).startsWith('0000')) return new Date().toISOString()

  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const withZone = /z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`
  const when = new Date(withZone)

  return Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString()
}

function toWpGmt(value) {
  const when = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(when.getTime())) throw new Error('Choose a valid date.')

  return when.toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

function laneFor(post, marker) {
  if (CALENDARS.includes(marker.calendar)) return marker.calendar
  if (post.status === 'future') return 'Scheduled'
  if (post.status === 'pending') return 'Revision'
  if (post.status === 'private' || post.sticky) return 'Promotion'
  if (post.status === 'publish') return 'Published'

  return 'Draft'
}

function wpStatusFor(calendar, start) {
  const future = new Date(start).getTime() > Date.now() + 60 * 1000

  if (calendar === 'Scheduled') {
    if (!future) throw new Error('Scheduled posts must be at least one minute in the future.')

    return 'future'
  }

  if (calendar === 'Published') return 'publish'
  if (calendar === 'Revision') return 'pending'
  if (calendar === 'Promotion') return future ? 'future' : 'publish'

  return 'draft'
}

function localStatus(calendar) {
  if (calendar === 'Published') return 'published'
  if (calendar === 'Scheduled') return 'scheduled'
  if (calendar === 'Revision') return 'revision'
  if (calendar === 'Promotion') return 'promotion'

  return 'draft'
}

function wpMessage(data, status) {
  const raw = data?.message || data?.error || 'WordPress request failed.'
  const message = String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return `WordPress HTTP ${status}: ${message}`.slice(0, 400)
}

async function requireUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) return { session: null, user: null }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })

  return { session, user }
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
    const predefined = JSON.parse(process.env.PREDEFINED_WP_SITES || '[]')

    predefined.forEach(site => {
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
    signal: AbortSignal.timeout(25000),
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

function toEvent(site, post) {
  const raw = post?.content?.raw || ''
  const marker = decodeMarker(raw)
  const start = isoFromGmt(post.date_gmt || post.date)
  const end = marker.end ? isoFromGmt(marker.end) : start
  const calendar = laneFor(post, marker)
  const link = post.link || ''
  const editLink = `${site.base}/wp-admin/post.php?post=${post.id}&action=edit`
  const guests = Array.isArray(marker.guests) ? marker.guests.filter(item => CHANNELS.includes(item)) : []

  return {
    id: `${site.siteKey}::${post.id}`,
    display: 'block',
    title: plainTitle(post),
    start,
    end,
    allDay: typeof marker.allDay === 'boolean' ? marker.allDay : calendar !== 'Scheduled',
    url: marker.url || (post.status === 'publish' ? link : editLink),
    extendedProps: {
      calendar,
      guests,
      description: typeof marker.description === 'string' ? marker.description : '',
      siteKey: site.siteKey,
      wpPostId: Number(post.id),
      link,
      editLink
    }
  }
}

async function listSitePosts(site) {
  const events = []

  for (let page = 1; page <= 4; page++) {
    const path =
      `/wp-json/wp/v2/posts?context=edit&status=draft,publish,future,pending,private` +
      `&per_page=50&page=${page}&orderby=modified&order=desc` +
      `&_fields=id,date_gmt,status,title,link,content,sticky`

    let data

    try {
      const result = await wpRequest(site, path)

      data = result.data
    } catch (error) {
      if (page > 1 && (error.code === 'rest_post_invalid_page_number' || error.status === 400)) break
      throw error
    }

    if (!Array.isArray(data) || !data.length) break

    data.forEach(post => {
      if (post?.id) events.push(toEvent(site, post))
    })

    if (data.length < 50) break
  }

  return events
}

function parseEventId(id) {
  const raw = String(id || '')
  const split = raw.lastIndexOf('::')

  if (split <= 0) return null

  const wpPostId = Number(raw.slice(split + 2))

  if (!wpPostId) return null

  return { siteKey: raw.slice(0, split), wpPostId }
}

function normalizeBody(body) {
  const calendar = CALENDARS.includes(body.calendar) ? body.calendar : 'Scheduled'
  const start = body.start ? new Date(body.start) : new Date()
  const end = body.end ? new Date(body.end) : start

  return {
    id: body.id || null,
    title: String(body.title || 'Untitled article').slice(0, 240),
    calendar,
    start: Number.isNaN(start.getTime()) ? new Date() : start,
    end: Number.isNaN(end.getTime()) ? start : end,
    allDay: Boolean(body.allDay),
    url: String(body.url || '').slice(0, 2000),
    guests: Array.isArray(body.guests) ? body.guests.map(String).filter(item => CHANNELS.includes(item)).slice(0, 12) : [],
    description: String(body.description || '').slice(0, 8000),
    siteKey: String(body.siteKey || '')
  }
}

function markerFrom(values, link, editLink) {
  return {
    calendar: values.calendar,
    end: values.end.toISOString(),
    allDay: values.allDay,
    url: values.url || '',
    guests: values.guests,
    description: values.description,
    link: link || '',
    editLink: editLink || ''
  }
}

async function mirrorArticle(userId, site, wpPostId, values, link, editLink) {
  try {
    await prisma.article.updateMany({
      where: { userId, wpPostId: Number(wpPostId) },
      data: {
        title: values.title,
        status: localStatus(values.calendar),
        targetSite: site.siteKey,
        scheduledAt: values.calendar === 'Scheduled' || values.calendar === 'Promotion' ? values.start : null,
        publishMeta: JSON.stringify({
          ...markerFrom(values, link, editLink),
          start: values.start.toISOString(),
          siteKey: site.siteKey,
          wpPostId: Number(wpPostId)
        })
      }
    })
  } catch (error) {
    console.error('Calendar mirror skipped:', error?.message || error)
  }
}

async function pushPost(site, wpPostId, values) {
  const wpStatus = wpStatusFor(values.calendar, values.start)
  let raw = ''

  if (wpPostId) {
    const existing = await wpRequest(
      site,
      `/wp-json/wp/v2/posts/${wpPostId}?context=edit&_fields=id,content,link`
    )

    raw = existing.data?.content?.raw || ''
  }

  const editLink = wpPostId ? `${site.base}/wp-admin/post.php?post=${wpPostId}&action=edit` : ''
  const payload = {
    title: values.title,
    status: wpStatus,
    date_gmt: toWpGmt(values.start),
    sticky: values.calendar === 'Promotion' && wpStatus === 'publish',
    content: embedMarker(raw, markerFrom(values, '', editLink))
  }
  const path = wpPostId
    ? `/wp-json/wp/v2/posts/${wpPostId}?_fields=id,link,status,date_gmt,title,content,sticky`
    : '/wp-json/wp/v2/posts?_fields=id,link,status,date_gmt,title,content,sticky'
  const { data } = await wpRequest(site, path, { method: 'POST', payload })
  const id = Number(data?.id)

  if (!id) throw new Error('WordPress did not return a post id.')

  const event = toEvent(site, { ...data, content: { raw: payload.content } })

  event.url = values.url || event.url
  event.extendedProps.description = values.description
  event.extendedProps.guests = values.guests
  event.extendedProps.calendar = values.calendar

  return event
}

export async function GET() {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sites = await connectedSites(user, session)

    if (!sites.length) {
      return NextResponse.json({
        events: [],
        warnings: ['Connect a WordPress site in the writer. This calendar only shows WordPress posts.']
      })
    }

    const events = []
    const warnings = []
    const results = await Promise.allSettled(
      sites.map(async site => {
        const authed = siteAuth(site)

        return { label: authed.label || authed.siteKey, events: await listSitePosts(authed) }
      })
    )

    results.forEach(result => {
      if (result.status === 'fulfilled') events.push(...result.value.events)
      else warnings.push(result.reason?.message || 'A WordPress site could not be loaded.')
    })

    return NextResponse.json({ events, warnings: warnings.slice(0, 6) })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: error.message || 'Failed to load WordPress posts.' }, { status: 500 })
  }
}

async function saveEvent(request, creating) {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await assertCanGenerate({
      userId: session?.user?.id || user.id,
      email: session?.user?.email,
      featureKey: 'wp-publish',
      estimatedWords: 0
    })

    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status || 403 })

    const values = normalizeBody(await request.json())
    const parsed = creating ? null : parseEventId(values.id)
    const siteKey = parsed?.siteKey || values.siteKey

    if (!siteKey) return NextResponse.json({ error: 'Choose the WordPress site this post belongs to.' }, { status: 400 })
    if (!creating && !parsed) {
      return NextResponse.json({ error: 'This item is not a WordPress post. Reload the calendar.' }, { status: 400 })
    }

    const sites = await connectedSites(user, session)
    const site = sites.find(item => item.siteKey === siteKey)

    if (!site) return NextResponse.json({ error: 'That WordPress site is not connected to this account.' }, { status: 404 })

    const authed = siteAuth(site)
    const event = await pushPost(authed, parsed?.wpPostId || null, values)

    await mirrorArticle(user.id, authed, event.extendedProps.wpPostId, values, event.extendedProps.link, event.extendedProps.editLink)

    return NextResponse.json({ event })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: error.message || 'Failed to update WordPress.' }, { status: 400 })
  }
}

export async function POST(request) {
  return saveEvent(request, true)
}

export async function PUT(request) {
  return saveEvent(request, false)
}

export async function DELETE(request) {
  try {
    const { session, user } = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await assertCanGenerate({
      userId: session?.user?.id || user.id,
      email: session?.user?.email,
      featureKey: 'wp-publish',
      estimatedWords: 0
    })

    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status || 403 })

    const parsed = parseEventId(new URL(request.url).searchParams.get('id'))

    if (!parsed) return NextResponse.json({ error: 'This item is not a WordPress post. Reload the calendar.' }, { status: 400 })

    const sites = await connectedSites(user, session)
    const site = sites.find(item => item.siteKey === parsed.siteKey)

    if (!site) return NextResponse.json({ error: 'That WordPress site is not connected to this account.' }, { status: 404 })

    const authed = siteAuth(site)

    try {
      await wpRequest(authed, `/wp-json/wp/v2/posts/${parsed.wpPostId}`, { method: 'DELETE' })
    } catch (error) {
      if (error.status !== 410 && error.code !== 'rest_already_trashed') throw error
    }

    await prisma.article.updateMany({
      where: { userId: user.id, wpPostId: parsed.wpPostId },
      data: { status: 'archived', scheduledAt: null }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: error.message || 'Failed to trash the WordPress post.' }, { status: 400 })
  }
}

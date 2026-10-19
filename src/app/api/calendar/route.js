import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'

const prisma = global.prismaCalendar || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prismaCalendar = prisma

const CALENDARS = ['Scheduled', 'Published', 'Draft', 'Revision', 'Promotion']

function statusForCalendar(calendar) {
  if (calendar === 'Published') return 'published'
  if (calendar === 'Scheduled') return 'scheduled'
  if (calendar === 'Revision') return 'revision'
  if (calendar === 'Promotion') return 'promotion'

  return 'draft'
}

function calendarForStatus(status) {
  if (status === 'published' || status === 'publish') return 'Published'
  if (status === 'scheduled' || status === 'future') return 'Scheduled'
  if (status === 'revision') return 'Revision'
  if (status === 'promotion') return 'Promotion'

  return 'Draft'
}

function parseMeta(raw) {
  if (!raw) return {}

  try {
    const value = JSON.parse(raw)

    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function toEvent(article) {
  const meta = parseMeta(article.publishMeta)
  const calendar = CALENDARS.includes(meta.calendar) ? meta.calendar : calendarForStatus(article.status)
  const start = meta.start || article.scheduledAt || article.updatedAt || article.createdAt
  const end = meta.end || start

  return {
    id: article.id,
    url: meta.url || '',
    title: article.title || 'Untitled article',
    start,
    end,
    allDay: typeof meta.allDay === 'boolean' ? meta.allDay : calendar !== 'Scheduled',
    extendedProps: {
      calendar,
      guests: Array.isArray(meta.guests) ? meta.guests : article.targetSite ? [article.targetSite] : [],
      description: meta.description || ''
    }
  }
}

async function requireUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET() {
  try {
    const user = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const articles = await prisma.article.findMany({
      where: { userId: user.id, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      take: 500
    })

    return NextResponse.json({ events: articles.map(toEvent) })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to load publishing calendar' }, { status: 500 })
  }
}

function normalizeBody(body) {
  const calendar = CALENDARS.includes(body.calendar) ? body.calendar : 'Draft'
  const start = body.start ? new Date(body.start) : new Date()
  const end = body.end ? new Date(body.end) : start
  const guests = Array.isArray(body.guests) ? body.guests.map(String).slice(0, 12) : []

  return {
    title: String(body.title || 'Untitled article').slice(0, 240),
    calendar,
    start: Number.isNaN(start.getTime()) ? new Date() : start,
    end: Number.isNaN(end.getTime()) ? start : end,
    allDay: Boolean(body.allDay),
    url: String(body.url || '').slice(0, 2000),
    guests,
    description: String(body.description || '').slice(0, 8000)
  }
}

function metaFrom(values) {
  return JSON.stringify({
    calendar: values.calendar,
    start: values.start.toISOString(),
    end: values.end.toISOString(),
    allDay: values.allDay,
    url: values.url,
    guests: values.guests,
    description: values.description
  })
}

export async function POST(request) {
  try {
    const user = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const values = normalizeBody(await request.json())

    const article = await prisma.article.create({
      data: {
        userId: user.id,
        title: values.title,
        content: '',
        status: statusForCalendar(values.calendar),
        targetSite: values.guests[0] || null,
        scheduledAt: values.calendar === 'Scheduled' ? values.start : null,
        publishMeta: metaFrom(values)
      }
    })

    return NextResponse.json({ event: toEvent(article) })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to add publishing event' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const user = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.article.findFirst({ where: { id: body.id, userId: user.id } })

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const values = normalizeBody(body)

    const article = await prisma.article.update({
      where: { id: existing.id },
      data: {
        title: values.title,
        status: statusForCalendar(values.calendar),
        targetSite: values.guests[0] || existing.targetSite,
        scheduledAt: values.calendar === 'Scheduled' ? values.start : null,
        publishMeta: metaFrom(values)
      }
    })

    return NextResponse.json({ event: toEvent(article) })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to update publishing event' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await requireUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = new URL(request.url).searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.article.findFirst({ where: { id, userId: user.id } })

    if (!existing) return NextResponse.json({ success: true })

    const hasBody = String(existing.content || '').replace(/<[^>]+>/g, '').trim().length > 0

    if (hasBody) {
      await prisma.article.update({
        where: { id: existing.id },
        data: { status: 'archived', scheduledAt: null }
      })
    } else {
      await prisma.article.delete({ where: { id: existing.id } })
    }

    return NextResponse.json({ success: true, archived: hasBody })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to remove publishing event' }, { status: 500 })
  }
}

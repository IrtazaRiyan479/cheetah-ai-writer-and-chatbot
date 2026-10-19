import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/libs/auth'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

function settingKey(userId) {
  return `internalLinkSites:${userId}`
}

function normalizeDomain(value) {
  let raw = String(value || '').trim()

  if (!raw) return ''

  raw = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  raw = raw.split('/')[0].split('?')[0].split('#')[0].trim().toLowerCase()

  if (!raw || !raw.includes('.') || /\s/.test(raw) || raw.length > 253) return ''

  return raw
}

function parseStoredSites(value) {
  try {
    const parsed = JSON.parse(value || '[]')

    if (!Array.isArray(parsed)) return []

    return parsed.map(normalizeDomain).filter(Boolean)
  } catch {
    return []
  }
}

async function currentUser() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

export async function GET() {
  try {
    const user = await currentUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const setting = await prisma.appSetting.findUnique({ where: { key: settingKey(user.id) } })

    return NextResponse.json({ sites: parseStoredSites(setting?.value) })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to load saved sites' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await currentUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const incoming = Array.isArray(body?.sites) ? body.sites : []
    const key = settingKey(user.id)
    const existing = await prisma.appSetting.findUnique({ where: { key } })
    const merged = []
    const seen = new Set()

    ;[...parseStoredSites(existing?.value), ...incoming].forEach(site => {
      const domain = normalizeDomain(site)

      if (!domain || seen.has(domain)) return

      seen.add(domain)
      merged.push(domain)
    })

    const sites = merged.slice(0, 100)

    await prisma.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(sites) },
      create: { key, value: JSON.stringify(sites) }
    })

    return NextResponse.json({ sites })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to save sites' }, { status: 500 })
  }
}

import { PrismaClient } from '@prisma/client'

import { requireAdmin } from '../_auth'
import { FEATURE_KEYS } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const existing = await prisma.featureFlag.findMany({ where: { key: { in: FEATURE_KEYS } } })
    const byKey = new Map(existing.map(flag => [flag.key, flag]))

    for (const key of FEATURE_KEYS) {
      if (!byKey.has(key)) {
        const flag = await prisma.featureFlag.create({ data: { key, enabled: true, free: ['standard', 'rewrite'].includes(key), mode: ['standard', 'rewrite'].includes(key) ? 'free' : 'pro' } })
        byKey.set(key, flag)
      }
    }

    return Response.json({ success: true, flags: FEATURE_KEYS.map(key => ({ key, mode: byKey.get(key).mode || (byKey.get(key).enabled === false ? 'off' : byKey.get(key).free ? 'free' : 'pro') })) })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const { key, mode } = await request.json()
    if (!FEATURE_KEYS.includes(key) || !['free', 'pro', 'off'].includes(mode)) {
      return Response.json({ success: false, error: 'Invalid feature key or mode.' }, { status: 400 })
    }

    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, mode, enabled: mode !== 'off', free: mode === 'free' },
      update: { mode, enabled: mode !== 'off', free: mode === 'free' }
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

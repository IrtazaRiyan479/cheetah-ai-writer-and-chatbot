import { PrismaClient } from '@prisma/client'

import { requireAdmin } from '../_auth'
import { FEATURE_KEYS, FEATURE_MODES, FREE_FEATURES } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const uniqueKeys = [...new Set(FEATURE_KEYS)]
    const existing = await prisma.featureFlag.findMany({ where: { key: { in: uniqueKeys } } })
    const byKey = new Map(existing.map(flag => [flag.key, flag]))

    for (const key of uniqueKeys) {
      if (byKey.has(key)) continue
      const isFree = FREE_FEATURES.has(key)

      try {
        const flag = await prisma.featureFlag.upsert({
          where: { key },
          create: { key, enabled: true, free: isFree, mode: isFree ? 'free' : 'pro', usePaidKeys: !isFree },
          update: {}
        })

        byKey.set(key, flag)
      } catch (error) {
        if (error?.code === 'P2002') {
          const again = await prisma.featureFlag.findUnique({ where: { key } })

          if (again) byKey.set(key, again)
          continue
        }

        throw error
      }
    }

    return Response.json({
      success: true,
      flags: uniqueKeys.map(key => {
        const row = byKey.get(key)
        const mode = row.mode || (row.enabled === false ? 'off' : row.free ? 'free' : 'pro')
        return {
          key,
          mode,
          usePaidKeys: row.usePaidKeys === true
        }
      })
    })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const body = await request.json()
    const { key, mode, usePaidKeys } = body

    if (typeof usePaidKeys === 'boolean') {
      if (!FEATURE_KEYS.includes(key)) {
        return Response.json({ success: false, error: 'Invalid feature key.' }, { status: 400 })
      }

      const isFree = FREE_FEATURES.has(key)
      await prisma.featureFlag.upsert({
        where: { key },
        create: {
          key,
          mode: isFree ? 'free' : 'pro',
          enabled: true,
          free: isFree,
          usePaidKeys
        },
        update: { usePaidKeys }
      })

      return Response.json({ success: true, key, usePaidKeys })
    }

    if (!FEATURE_KEYS.includes(key) || !FEATURE_MODES.includes(mode)) {
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

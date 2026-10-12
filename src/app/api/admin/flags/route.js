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
          create: { key, enabled: true, free: isFree, mode: isFree ? 'free' : 'pro' },
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

    const freeKeysSetting = await prisma.appSetting
      .findUnique({ where: { key: 'allowFreeGeminiKeysForPro' } })
      .catch(() => null)

    const allowFreeGeminiKeysForPro = freeKeysSetting?.value === '1' || freeKeysSetting?.value === 'true'

    return Response.json({
      success: true,
      flags: uniqueKeys.map(key => ({
        key,
        mode: byKey.get(key).mode || (byKey.get(key).enabled === false ? 'off' : byKey.get(key).free ? 'free' : 'pro')
      })),
      allowFreeGeminiKeysForPro
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

    if (typeof body.allowFreeGeminiKeysForPro === 'boolean') {
      await prisma.appSetting.upsert({
        where: { key: 'allowFreeGeminiKeysForPro' },
        create: { key: 'allowFreeGeminiKeysForPro', value: body.allowFreeGeminiKeysForPro ? '1' : '0' },
        update: { value: body.allowFreeGeminiKeysForPro ? '1' : '0' }
      })

      return Response.json({ success: true, allowFreeGeminiKeysForPro: body.allowFreeGeminiKeysForPro })
    }

    const { key, mode } = body

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

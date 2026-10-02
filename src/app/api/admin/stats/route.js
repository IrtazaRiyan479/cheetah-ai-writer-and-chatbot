import { PrismaClient } from '@prisma/client'

import { requireAdmin } from '../_auth'
import { serializeError } from '@/utils/serializeError'
import { FREE_WORD_CAP } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const [users, flags, setting] = await Promise.all([
      prisma.user.findMany({ select: { wordsUsed: true, wordsLimit: true, wordsLimitCustomized: true, role: true, plan: true } }),
      prisma.featureFlag.findMany(),
      prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } })
    ])

    const globalFreeWordCap = Math.max(0, Number(setting?.value ?? FREE_WORD_CAP))
    const wordsUsed = users.reduce((sum, user) => sum + (user.wordsUsed || 0), 0)
    const wordsCap = users.reduce((sum, user) => sum + (user.wordsLimitCustomized ? user.wordsLimit : globalFreeWordCap), 0)
    const byRole = users.reduce((counts, user) => {
      const role = user.role || user.plan || 'free'
      counts[role] = (counts[role] || 0) + 1
      return counts
    }, {})

    return Response.json({ success: true, stats: { users: users.length, byRole, wordsUsed, wordsCap, flagsOff: flags.filter(flag => flag.mode === 'off' || flag.enabled === false).length, globalFreeWordCap } })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const { globalFreeWordCap } = await request.json()
    if (!Number.isInteger(Number(globalFreeWordCap)) || Number(globalFreeWordCap) < 0) {
      return Response.json({ success: false, error: 'The global word cap must be a non-negative whole number.' }, { status: 400 })
    }

    await prisma.appSetting.upsert({
      where: { key: 'globalFreeWordCap' },
      create: { key: 'globalFreeWordCap', value: String(Number(globalFreeWordCap)) },
      update: { value: String(Number(globalFreeWordCap)) }
    })
    await prisma.user.updateMany({ where: { wordsLimitCustomized: false }, data: { wordsLimit: Number(globalFreeWordCap) } })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

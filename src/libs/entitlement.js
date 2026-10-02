import { PrismaClient } from '@prisma/client'

import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export const FREE_WORD_CAP = 5000

export const FEATURE_KEYS = [
  'standard',
  'rewrite',
  'amazon-roundup',
  'amazon-review',
  'amazon-roundup-rewrite',
  'amazon-review-rewrite',
  'listicle',
  'local-roundup',
  'youtube-blog',
  'product-comparison',
  'wp-publish',
  'image-standalone',
  'batch-generate'
]

export const FREE_FEATURES = new Set(['standard', 'rewrite'])

export function featureKeyForType(type) {
  const map = {
    blog: 'standard',
    standard: 'standard',
    rewrite: 'rewrite',
    'amazon-roundup': 'amazon-roundup',
    'amazon-review': 'amazon-review',
    'amazon-roundup-rewrite': 'amazon-roundup-rewrite',
    'amazon-review-rewrite': 'amazon-review-rewrite',
    listicle: 'listicle',
    'local-roundup': 'local-roundup',
    'youtube-blog': 'youtube-blog',
    'product-comparison': 'product-comparison'
  }

  return map[type] || 'standard'
}

export function countWords(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return text ? text.split(' ').filter(Boolean).length : 0
}

function isPaid(user) {
  return user?.role === 'pro' || user?.role === 'admin' || user?.plan === 'pro' || user?.plan === 'admin'
}

export async function getDbUser({ userId, email }) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } })
  if (email) return prisma.user.findUnique({ where: { email } })

  return null
}

export async function assertCanGenerate({ userId, email, featureKey, estimatedWords = 0 }) {
  try {
    const user = await getDbUser({ userId, email })

    if (!user) return { ok: false, status: 401, error: 'Sign in required.' }

    const flag = await prisma.featureFlag.findUnique({ where: { key: featureKey } }).catch(() => null)

    if (flag && (flag.mode === 'off' || flag.enabled === false)) {
      return { ok: false, status: 403, error: 'This feature is turned off.' }
    }

    const freeFeature = flag ? (flag.mode ? flag.mode === 'free' : flag.free) : FREE_FEATURES.has(featureKey)

    if (!isPaid(user) && !freeFeature) {
      return { ok: false, status: 402, error: 'This feature requires a Pro plan.' }
    }

    const capSetting = await prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } }).catch(() => null)
    const globalFreeWordCap = capSetting ? Math.max(0, Number(capSetting.value) || 0) : FREE_WORD_CAP
    const limit = user.wordsLimitCustomized ? user.wordsLimit : globalFreeWordCap

    if (!isPaid(user) && estimatedWords > 0 && user.wordsUsed >= limit) {
      return { ok: false, status: 402, error: `Free word limit reached (${limit} words).` }
    }

    return { ok: true, user }
  } catch (error) {
    return { ok: false, status: 500, error: serializeError(error) }
  }
}

export async function recordSavedWords(userId, html) {
  const words = countWords(html)

  if (!words || !userId) return

  const user = await prisma.user.findUnique({ where: { id: userId } })

  if (!user || isPaid(user)) return

  await prisma.user.update({ where: { id: userId }, data: { wordsUsed: { increment: words } } })
}

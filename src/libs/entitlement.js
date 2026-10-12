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
  'batch-generate',
  'real-time-data',
  'deep-search',
  'outline-editor',
  'include-faq',
  'include-key-takeaways',
  'automatic-external-links',
  'improve-readability',
  'enable-auto-length',
  'enable-supplemental-information',
  'use-descending-order',
  'enable-first-hand-experience',
  'enable-condensed-mode',
  'generate-unique-map-images',
  'enable-caption-rewriting',
  'model-gemini-flash-lite',
  'model-gemini-flash',
  'model-gemini-pro',
  'model-gpt',
  'model-gpt-mini',
  'model-claude',
  'model-grok'
]

export const FEATURE_META = {
  standard: { label: 'Standard blog', group: 'Article types' },
  rewrite: { label: 'Rewrite', group: 'Article types' },
  'amazon-roundup': { label: 'Amazon roundup', group: 'Article types' },
  'amazon-review': { label: 'Amazon review', group: 'Article types' },
  'amazon-roundup-rewrite': { label: 'Amazon roundup rewrite', group: 'Article types' },
  'amazon-review-rewrite': { label: 'Amazon review rewrite', group: 'Article types' },
  listicle: { label: 'Listicle', group: 'Article types' },
  'local-roundup': { label: 'Local roundup', group: 'Article types' },
  'youtube-blog': { label: 'YouTube blog', group: 'Article types' },
  'product-comparison': { label: 'Product comparison', group: 'Article types' },
  'wp-publish': { label: 'WordPress publish', group: 'Publishing' },
  'image-standalone': { label: 'Standalone images', group: 'Publishing' },
  'batch-generate': { label: 'Batch generation', group: 'Publishing' },
  'real-time-data': { label: 'Real-Time Data', group: 'Writer options' },
  'deep-search': { label: 'Deep Search', group: 'Writer options' },
  'outline-editor': { label: 'Outline editor', group: 'Writer options' },
  'include-faq': { label: 'FAQ section', group: 'Writer options' },
  'include-key-takeaways': { label: 'Key takeaways', group: 'Writer options' },
  'automatic-external-links': { label: 'Automatic external links', group: 'Writer options' },
  'improve-readability': { label: 'Improve readability', group: 'Writer options' },
  'enable-auto-length': { label: 'Auto length', group: 'Writer options' },
  'enable-supplemental-information': { label: 'Supplemental information', group: 'Writer options' },
  'use-descending-order': { label: 'Descending order', group: 'Writer options' },
  'enable-first-hand-experience': { label: 'First-hand experience', group: 'Writer options' },
  'enable-condensed-mode': { label: 'Condensed mode', group: 'Writer options' },
  'generate-unique-map-images': { label: 'Unique map images', group: 'Writer options' },
  'enable-caption-rewriting': { label: 'Rewrite captions', group: 'Writer options' },
  'model-gemini-flash-lite': { label: 'Gemini Flash Lite', group: 'Models' },
  'model-gemini-flash': { label: 'Gemini Flash', group: 'Models' },
  'model-gemini-pro': { label: 'Gemini Pro', group: 'Models' },
  'model-gpt': { label: 'GPT-5.2', group: 'Models' },
  'model-gpt-mini': { label: 'GPT-5 Mini', group: 'Models' },
  'model-claude': { label: 'Claude Sonnet', group: 'Models' },
  'model-grok': { label: 'Grok', group: 'Models' }
}

export const OPTION_FEATURE_MAP = {
  deepSearch: 'deep-search',
  useRealTimeSearchData: 'real-time-data',
  useOutlineEditor: 'outline-editor',
  includeFaq: 'include-faq',
  includeKeyTakeaways: 'include-key-takeaways',
  automaticExternalLinks: 'automatic-external-links',
  improveReadability: 'improve-readability',
  enableAutoLength: 'enable-auto-length',
  enableSupplementalInformation: 'enable-supplemental-information',
  useDescendingOrder: 'use-descending-order',
  enableFirstHandExperience: 'enable-first-hand-experience',
  enableCondensedMode: 'enable-condensed-mode',
  generateUniqueMapImages: 'generate-unique-map-images',
  enableCaptionRewriting: 'enable-caption-rewriting'
}

export const FREE_FEATURES = new Set([
  'standard',
  'rewrite',
  'model-gemini-flash-lite',
  'model-gpt-mini',
  'outline-editor',
  'include-faq',
  'include-key-takeaways',
  'improve-readability'
])

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

const MODEL_FEATURE = {
  'gemini-3.5-flash': 'model-gemini-flash',
  'gemini-2.5-flash': 'model-gemini-flash',
  'gemini-3.1-flash-lite': 'model-gemini-flash-lite',
  'gemini-3.1-pro-preview-customtools': 'model-gemini-pro',
  'gemini-3.1-pro-preview': 'model-gemini-pro',
  'gemini-2.5-pro': 'model-gemini-pro',
  'gpt-5.2': 'model-gpt',
  'gpt-5-mini': 'model-gpt-mini',
  'claude-4.5-sonnet': 'model-claude',
  'grok-4.7': 'model-grok'
}

export function featureKeyForModel(model) {
  const value = String(model || '')
  if (MODEL_FEATURE[value]) return MODEL_FEATURE[value]
  const lower = value.toLowerCase()
  if (lower.startsWith('gpt-')) return lower.includes('mini') ? 'model-gpt-mini' : 'model-gpt'
  if (lower.startsWith('claude')) return 'model-claude'
  if (lower.startsWith('grok')) return 'model-grok'
  if (lower.includes('pro')) return 'model-gemini-pro'
  if (lower.includes('flash') && !lower.includes('lite')) return 'model-gemini-flash'
  return 'model-gemini-flash-lite'
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

export function isPaid(user) {
  return user?.role === 'pro' || user?.role === 'admin' || user?.plan === 'pro' || user?.plan === 'admin'
}

export async function getDbUser({ userId, email }) {
  if (userId) return prisma.user.findUnique({ where: { id: userId } })
  if (email) return prisma.user.findUnique({ where: { email } })
  return null
}

export async function getFeatureModes() {
  const flags = await prisma.featureFlag.findMany({ where: { key: { in: FEATURE_KEYS } } }).catch(() => [])
  const byKey = new Map(flags.map(flag => [flag.key, flag]))
  const modes = {}
  for (const key of FEATURE_KEYS) {
    const flag = byKey.get(key)
    if (!flag) modes[key] = FREE_FEATURES.has(key) ? 'free' : 'pro'
    else if (flag.mode === 'off' || flag.enabled === false) modes[key] = 'off'
    else if (flag.mode) modes[key] = flag.mode
    else modes[key] = flag.free ? 'free' : 'pro'
  }
  return modes
}

export function activeFeatureKeysFromSettings(settings = {}, type, model) {
  const keys = [featureKeyForType(type || settings.type)]
  for (const [settingKey, featureKey] of Object.entries(OPTION_FEATURE_MAP)) {
    if (settings[settingKey]) keys.push(featureKey)
  }
  keys.push(featureKeyForModel(model || settings.model))
  return [...new Set(keys)]
}

export async function resolveGenerationAccess({ userId, email, settings = {}, type, model, estimatedWords = 0, featureKeys } = {}) {
  try {
    const user = await getDbUser({ userId, email })
    if (!user) return { ok: false, status: 401, error: 'Sign in required.' }

    const modes = await getFeatureModes()
    const activeKeys = featureKeys?.length
      ? [...new Set(featureKeys)]
      : activeFeatureKeysFromSettings(settings, type, model)
    let usePaidKeys = false
    const blocked = []

    for (const key of activeKeys) {
      const mode = modes[key] || (FREE_FEATURES.has(key) ? 'free' : 'pro')
      if (mode === 'off') {
        return {
          ok: false,
          status: 403,
          error: `${FEATURE_META[key]?.label || key} is turned off.`,
          code: 'FEATURE_OFF'
        }
      }
      if (mode === 'pro') {
        if (!isPaid(user)) blocked.push(FEATURE_META[key]?.label || key)
        else usePaidKeys = true
      }
    }

    if (blocked.length) {
      return {
        ok: false,
        status: 402,
        error: `${blocked[0]} requires a Pro plan.`,
        code: 'PRO_REQUIRED',
        features: blocked
      }
    }

    const capSetting = await prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } }).catch(() => null)
    const globalFreeWordCap = capSetting ? Math.max(0, Number(capSetting.value) || 0) : FREE_WORD_CAP
    const limit = user.wordsLimitCustomized ? user.wordsLimit : globalFreeWordCap

    const admin = user.role === 'admin' || user.plan === 'admin'

    if (!admin && user.wordsUsed >= limit) {
      return {
        ok: false,
        status: 402,
        error: `Word cap reached (${limit.toLocaleString()} words). Buy another pack to keep writing. Words already bought never expire.`,
        code: 'WORD_LIMIT'
      }
    }

    if (!admin && estimatedWords > 0 && user.wordsUsed + estimatedWords > limit) {
      return {
        ok: false,
        status: 402,
        error: `Not enough words left (${Math.max(0, limit - user.wordsUsed)} remaining of ${limit}).`,
        code: 'WORD_LIMIT'
      }
    }

    return {
      ok: true,
      user,
      usePaidKeys,
      activeKeys,
      paid: isPaid(user),
      limit,
      wordsUsed: user.wordsUsed
    }
  } catch (error) {
    return { ok: false, status: 500, error: serializeError(error) }
  }
}

export async function assertCanGenerate({ userId, email, featureKey, estimatedWords = 0 }) {
  return resolveGenerationAccess({
    userId,
    email,
    settings: {},
    featureKeys: featureKey ? [featureKey] : undefined,
    estimatedWords
  })
}

const SECTION_WORD_RESERVE = 400

export async function claimFreeWords(userId, requested = SECTION_WORD_RESERVE) {
  if (!userId) return { claimed: 0, blocked: true }

  for (let attempt = 0; attempt < 3; attempt++) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { claimed: 0, blocked: true }
    if (user.role === 'admin' || user.plan === 'admin') return { claimed: 0, blocked: false, paid: true }

    const capSetting = await prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } }).catch(() => null)
    const globalFreeWordCap = capSetting ? Math.max(0, Number(capSetting.value) || 0) : FREE_WORD_CAP
    const limit = user.wordsLimitCustomized ? user.wordsLimit : globalFreeWordCap
    const room = limit - user.wordsUsed
    if (room <= 0) return { claimed: 0, blocked: true, limit, wordsUsed: user.wordsUsed }

    const amount = Math.max(1, Math.min(requested, room))
    const updated = await prisma.user.updateMany({
      where: { id: userId, wordsUsed: user.wordsUsed },
      data: { wordsUsed: { increment: amount } }
    })
    if (updated.count === 1) return { claimed: amount, blocked: false, paid: false, limit }
  }

  return { claimed: 0, blocked: true }
}

export async function settleReservedWords(userId, reserved, text) {
  const actual = countWords(text)
  const delta = actual - (Number(reserved) || 0)
  if (!userId || !delta) return actual
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role === 'admin' || user.plan === 'admin') return actual
  if (delta < 0) {
    await prisma.user.updateMany({
      where: { id: userId, wordsUsed: { gte: -delta } },
      data: { wordsUsed: { increment: delta } }
    })
    return actual
  }
  await prisma.user.update({ where: { id: userId }, data: { wordsUsed: { increment: delta } } })
  return actual
}

export async function recordGeneratedWords(userId, text) {
  const words = countWords(text)
  if (!words || !userId) return 0
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role === 'admin' || user.plan === 'admin') return 0
  await prisma.user.update({ where: { id: userId }, data: { wordsUsed: { increment: words } } })
  return words
}

export async function recordSavedWords(userId, html) {
  return recordGeneratedWords(userId, html)
}

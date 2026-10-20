import { PrismaClient } from '@prisma/client'

import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export const FREE_WORD_CAP = 5000

export const FEATURE_MODES = ['free', 'pro', 'max', 'off']

const toneOptions = [
  ['seo', 'SEO Optimized (Confident, Knowledgeable, Neutral, and Clear)', 'menu-tone-seo'],
  ['excited', 'Excited', 'menu-tone-excited'],
  ['professional', 'Professional', 'menu-tone-professional'],
  ['friendly', 'Friendly', 'menu-tone-friendly'],
  ['formal', 'Formal', 'menu-tone-formal'],
  ['casual', 'Casual', 'menu-tone-casual'],
  ['humorous', 'Humorous', 'menu-tone-humorous'],
  ['custom', 'Custom', 'menu-tone-custom']
]

const povOptions = [
  ['first', 'First Person (I, me, my)', 'menu-pov-first'],
  ['first-plural', 'First Person Plural (We, us, our)', 'menu-pov-first-plural'],
  ['second', 'Second Person (You, your)', 'menu-pov-second'],
  ['third', 'Third Person (he, she, it, they)', 'menu-pov-third']
]

const amazonDomains = [
  'amazon.ae', 'amazon.com', 'amazon.com.au', 'amazon.com.be', 'amazon.com.br', 'amazon.ca', 'amazon.cn',
  'amazon.de', 'amazon.eg', 'amazon.es', 'amazon.fr', 'amazon.in', 'amazon.it', 'amazon.co.jp',
  'amazon.com.mx', 'amazon.nl', 'amazon.pl', 'amazon.sa', 'amazon.sg', 'amazon.se', 'amazon.com.tr', 'amazon.co.uk'
]

const asOptions = rows => rows.map(([value, label, featureKey]) => ({ value, label, featureKey }))

export const MODULE_FEATURES = [
  { key: 'module-chat', label: 'AffiGenie Chat', href: '/chat' },
  { key: 'module-writer', label: 'AffiGenie Writer', href: '/writer' },
  { key: 'module-images', label: 'AffiGenie Images', href: '/images' },
  { key: 'module-links', label: 'AffiGenie Links', href: '/links' },
  { key: 'module-magnets', label: 'AffiGenie Magnets', href: '/magnets' },
  { key: 'module-drafts', label: 'AffiGenie Drafts', href: '/drafts' },
  { key: 'module-calendar', label: 'Publishing Calendar', href: '/calendar' }
]

export const WRITER_MENUS = [
  {
    key: 'menu-seo-optimization',
    label: 'SEO Optimization',
    setting: 'seoOptimization',
    defaultValue: 'default',
    options: asOptions([
      ['default', 'Default', 'menu-seo-default'],
      ['manual', 'Manual', 'menu-seo-manual'],
      ['ai', 'AI-Powered', 'menu-seo-ai']
    ])
  },
  {
    key: 'menu-royalty-media',
    label: 'Royalty Free Images & YouTube Videos',
    setting: 'aiImagesAndVideos',
    defaultValue: 'none',
    options: asOptions([
      ['none', 'None', 'menu-media-none'],
      ['auto', 'Royalty Free Images & Videos', 'menu-media-auto'],
      ['upload-images', 'Upload Custom Images', 'menu-media-upload-images']
    ])
  },
  {
    key: 'menu-article-length',
    label: 'Article Length',
    setting: 'articleLength',
    defaultValue: 'default',
    options: asOptions([
      ['default', 'Default', 'menu-length-default'],
      ['custom', 'Custom Number of Sections', 'menu-length-custom'],
      ['shorter', 'Shorter (2-3 Sections)', 'menu-length-shorter'],
      ['short', 'Short (3-5 Sections)', 'menu-length-short'],
      ['medium', 'Medium (5-7 Sections)', 'menu-length-medium'],
      ['long', 'Long Form (7-10 Sections)', 'menu-length-long'],
      ['longer', 'Longer (10-12 Sections)', 'menu-length-longer']
    ])
  },
  {
    key: 'menu-tone',
    label: 'Tone of Voice',
    setting: 'toneOfVoice',
    defaultValue: 'seo',
    options: asOptions(toneOptions)
  },
  {
    key: 'menu-point-of-view',
    label: 'Point of View',
    setting: 'pointOfView',
    defaultValue: 'third',
    options: asOptions(povOptions)
  },
  {
    key: 'menu-realtime-source',
    label: 'Real-Time Data Source',
    setting: 'realTimeDataSource',
    defaultValue: 'search',
    options: asOptions([
      ['search', 'Web', 'menu-realtime-web'],
      ['news', 'Google News', 'menu-realtime-news'],
      ['scholar', 'Google Scholar', 'menu-realtime-scholar']
    ])
  },
  {
    key: 'menu-roundup-layout',
    label: 'Roundup Layout',
    setting: 'roundupLayout',
    defaultValue: 'table',
    options: asOptions([
      ['table', 'Product Table', 'menu-roundup-table'],
      ['top-pick', 'Top Pick', 'menu-roundup-top-pick']
    ])
  },
  {
    key: 'menu-list-numbering',
    label: 'List Numbering Format',
    setting: 'listNumberingFormat',
    defaultValue: '1.',
    options: asOptions([
      ['1)', '1), 2), 3)', 'menu-list-number-paren'],
      ['1.', '1., 2., 3.', 'menu-list-number-dot'],
      ['1:', '1:, 2:, 3:', 'menu-list-number-colon'],
      ['none', 'None', 'menu-list-number-none']
    ])
  },
  {
    key: 'menu-amazon-domain',
    label: 'Amazon Domain',
    setting: 'amazonDomain',
    defaultValue: 'amazon.com',
    options: amazonDomains.map(domain => ({
      value: domain,
      label: domain,
      featureKey: `menu-domain-${domain.replaceAll('.', '-')}`
    }))
  },
  {
    key: 'menu-language',
    label: 'Language',
    setting: 'language',
    defaultValue: 'en',
    options: []
  },
  {
    key: 'menu-country',
    label: 'Country',
    setting: 'country',
    defaultValue: 'US',
    options: []
  }
]

const EXTRA_MENU_FLAGS = [
  ['menu-image-limit', 'Image limit'],
  ['menu-video-limit', 'YouTube video limit'],
  ['menu-internal-linking', 'Automatic internal linking'],
  ['menu-custom-internal-urls', 'Custom internal URLs'],
  ['menu-list-item-prompt', 'List item custom prompt']
]

const menuFlagEntries = () => {
  const entries = WRITER_MENUS.map(menu => [menu.key, menu.label])
  WRITER_MENUS.forEach(menu => {
    menu.options.forEach(option => entries.push([option.featureKey, `${menu.label}: ${option.label}`]))
  })
  EXTRA_MENU_FLAGS.forEach(entry => entries.push(entry))
  return entries
}

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
  'model-grok',
  ...MODULE_FEATURES.map(item => item.key),
  ...menuFlagEntries().map(([key]) => key)
]

const baseMeta = {
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
  'enable-caption-rewriting': { label: 'Directly rewrite captions', group: 'Writer options' },
  'model-gemini-flash-lite': { label: 'Gemini Flash Lite', group: 'Models' },
  'model-gemini-flash': { label: 'Gemini Flash', group: 'Models' },
  'model-gemini-pro': { label: 'Gemini Pro', group: 'Models' },
  'model-gpt': { label: 'GPT-5.2', group: 'Models' },
  'model-gpt-mini': { label: 'GPT-5 Mini', group: 'Models' },
  'model-claude': { label: 'Claude Sonnet', group: 'Models' },
  'model-grok': { label: 'Grok', group: 'Models' }
}

export const FEATURE_META = {
  ...baseMeta,
  ...Object.fromEntries(MODULE_FEATURES.map(item => [item.key, { label: item.label, group: 'App modules' }])),
  ...Object.fromEntries(menuFlagEntries().map(([key, label]) => [key, { label, group: 'Writer menus', pricing: false }]))
}

const menuByKey = key => WRITER_MENUS.find(menu => menu.key === key)

const flagNode = (key, label, children, hint) => {
  const node = { key, label }
  if (hint) node.hint = hint
  if (children?.length) node.children = children
  return node
}

const menuNode = key => {
  const menu = menuByKey(key)
  return flagNode(
    menu.key,
    menu.label,
    (menu.options || []).map(option => flagNode(option.featureKey, option.label))
  )
}

const mediaNode = () => {
  const menu = menuByKey('menu-royalty-media')
  return flagNode(
    menu.key,
    menu.label,
    menu.options.map(option =>
      option.value === 'auto'
        ? flagNode(option.featureKey, option.label, [
            flagNode('menu-image-limit', 'Image limit'),
            flagNode('menu-video-limit', 'YouTube video limit')
          ])
        : flagNode(option.featureKey, option.label)
    )
  )
}

const linkingNodes = () => [
  flagNode('menu-internal-linking', 'Automatic internal linking'),
  flagNode('menu-custom-internal-urls', 'Custom internal URLs')
]

const voiceNodes = ({ country = true } = {}) => [
  menuNode('menu-tone'),
  flagNode('menu-language', 'Language'),
  ...(country ? [flagNode('menu-country', 'Country')] : []),
  menuNode('menu-point-of-view')
]

const realtimeNode = () => flagNode('real-time-data', 'Real-Time Data', [menuNode('menu-realtime-source')])

const blogFields = () => [
  ...linkingNodes(),
  menuNode('menu-seo-optimization'),
  mediaNode(),
  menuNode('menu-article-length'),
  ...voiceNodes(),
  realtimeNode(),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('deep-search', 'Deep Search'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('include-key-takeaways', 'Include key takeaways'),
  flagNode('improve-readability', 'Improve readability')
]

const listicleFields = () => [
  ...linkingNodes(),
  menuNode('menu-seo-optimization'),
  mediaNode(),
  ...voiceNodes(),
  flagNode('menu-list-item-prompt', 'List item custom prompt'),
  realtimeNode(),
  flagNode('enable-auto-length', 'Enable auto length'),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('enable-supplemental-information', 'Enable supplemental information'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('improve-readability', 'Improve readability'),
  flagNode('use-descending-order', 'Use descending order'),
  menuNode('menu-list-numbering')
]

const amazonRoundupFields = () => [
  ...linkingNodes(),
  menuNode('menu-roundup-layout'),
  menuNode('menu-amazon-domain'),
  ...voiceNodes(),
  flagNode('enable-first-hand-experience', 'Enable first-hand experience'),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('improve-readability', 'Improve readability')
]

const amazonReviewFields = () => [
  ...linkingNodes(),
  ...voiceNodes({ country: false }),
  flagNode('enable-first-hand-experience', 'Enable first-hand experience'),
  flagNode('enable-condensed-mode', 'Enable condensed mode'),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('improve-readability', 'Improve readability')
]

const youtubeFields = () => [
  flagNode(
    'enable-caption-rewriting',
    'Directly rewrite captions',
    null,
    'YouTube only. Formats spoken captions into the article instead of writing a fresh post.'
  ),
  ...linkingNodes(),
  ...voiceNodes(),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('improve-readability', 'Improve readability')
]

const localRoundupFields = () => [
  ...linkingNodes(),
  menuNode('menu-seo-optimization'),
  ...voiceNodes(),
  realtimeNode(),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('deep-search', 'Deep Search'),
  flagNode('enable-auto-length', 'Enable auto length'),
  flagNode('generate-unique-map-images', 'Generate unique map images'),
  flagNode('enable-first-hand-experience', 'Enable first-hand experience'),
  flagNode('enable-supplemental-information', 'Enable supplemental information'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('improve-readability', 'Improve readability'),
  flagNode('use-descending-order', 'Use descending order'),
  menuNode('menu-list-numbering')
]

const rewriteFields = () => [
  menuNode('menu-article-length'),
  ...linkingNodes(),
  menuNode('menu-seo-optimization'),
  mediaNode(),
  ...voiceNodes(),
  realtimeNode(),
  flagNode('automatic-external-links', 'Automatic external links'),
  flagNode('outline-editor', 'Use outline editor'),
  flagNode('include-faq', 'Include FAQ section'),
  flagNode('include-key-takeaways', 'Include key takeaways'),
  flagNode('improve-readability', 'Improve readability')
]

export const ADMIN_FLAG_TREE = [
  {
    group: 'Article types',
    nodes: [
      flagNode('standard', 'Blog Post', blogFields()),
      flagNode('listicle', 'Listicle', listicleFields()),
      flagNode('local-roundup', 'Local Places Roundup', localRoundupFields()),
      flagNode('amazon-roundup', 'Amazon Product Roundup', amazonRoundupFields()),
      flagNode('amazon-review', 'Amazon Single Product Review', amazonReviewFields()),
      flagNode(
        'product-comparison',
        'Product Comparison',
        null,
        'Required inputs only: comparison topic plus two or three Amazon product URLs.'
      ),
      flagNode('youtube-blog', 'YouTube Video to Blog Post', youtubeFields()),
      flagNode('rewrite', 'Rewrite Blog Post', rewriteFields()),
      flagNode('amazon-roundup-rewrite', 'Rewrite Amazon Product Roundup', amazonRoundupFields()),
      flagNode('amazon-review-rewrite', 'Rewrite Amazon Single Product Review', amazonReviewFields())
    ]
  },
  {
    group: 'Publishing',
    nodes: [
      flagNode('wp-publish', 'WordPress publish'),
      flagNode('image-standalone', 'Standalone images'),
      flagNode('batch-generate', 'Batch generation')
    ]
  },
  {
    group: 'Models',
    nodes: [
      flagNode('model-gemini-flash-lite', 'Gemini Flash Lite'),
      flagNode('model-gemini-flash', 'Gemini Flash'),
      flagNode('model-gemini-pro', 'Gemini Pro'),
      flagNode('model-gpt', 'GPT-5.2'),
      flagNode('model-gpt-mini', 'GPT-5 Mini'),
      flagNode('model-claude', 'Claude Sonnet'),
      flagNode('model-grok', 'Grok')
    ]
  },
  {
    group: 'App modules',
    nodes: MODULE_FEATURES.map(item => flagNode(item.key, item.label))
  }
]

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
  'improve-readability',
  ...MODULE_FEATURES.map(item => item.key),
  ...menuFlagEntries().map(([key]) => key)
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

export function planTier(user) {
  if (user?.role === 'admin' || user?.plan === 'admin') return 'admin'
  if (user?.role === 'max' || user?.plan === 'max') return 'max'
  if (user?.role === 'pro' || user?.plan === 'pro') return 'pro'
  return 'free'
}

export function isMax(user) {
  const tier = planTier(user)
  return tier === 'max' || tier === 'admin'
}

export function isPaid(user) {
  const tier = planTier(user)
  return tier === 'pro' || tier === 'max' || tier === 'admin'
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

export function menuFeatureKeysFromSettings(settings = {}) {
  const keys = []
  for (const menu of WRITER_MENUS) {
    const value = settings[menu.setting]
    if (value == null || value === '') continue
    const option = (menu.options || []).find(item => item.value === value)
    if (option?.featureKey) keys.push(option.featureKey)
    if (String(value) !== String(menu.defaultValue)) keys.push(menu.key)
  }
  if (settings.aiImagesAndVideos === 'auto' && String(settings.numberOfImages || '').trim()) keys.push('menu-image-limit')
  if (settings.aiImagesAndVideos === 'auto' && String(settings.numberOfYoutubeVideos || '').trim()) keys.push('menu-video-limit')
  if (Array.isArray(settings.internalLinking) && settings.internalLinking.length) keys.push('menu-internal-linking')
  if (String(settings.customInternalLink || '').trim()) keys.push('menu-custom-internal-urls')
  const prompt = String(settings.listItemPrompt || '').trim()
  if (prompt && prompt !== 'only write a max of 200 words') keys.push('menu-list-item-prompt')
  return keys
}

export function activeFeatureKeysFromSettings(settings = {}, type, model) {
  const keys = [featureKeyForType(type || settings.type), 'module-writer']
  for (const [settingKey, featureKey] of Object.entries(OPTION_FEATURE_MAP)) {
    if (settings[settingKey]) keys.push(featureKey)
  }
  keys.push(featureKeyForModel(model || settings.model))
  keys.push(...menuFeatureKeysFromSettings(settings))
  return [...new Set(keys)]
}

export async function resolveGenerationAccess({ userId, email, settings = {}, type, model, estimatedWords = 0, featureKeys, extraFeatureKeys } = {}) {
  try {
    const user = await getDbUser({ userId, email })
    if (!user) return { ok: false, status: 401, error: 'Sign in required.' }

    const modes = await getFeatureModes()
    const computed = featureKeys?.length
      ? [...new Set(featureKeys)]
      : activeFeatureKeysFromSettings(settings, type, model)
    const extras = (Array.isArray(extraFeatureKeys) ? extraFeatureKeys : []).filter(key => FEATURE_KEYS.includes(key))
    const activeKeys = [...new Set([...computed, ...extras])]
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
      if (mode === 'max') {
        if (!isMax(user)) blocked.push({ label: FEATURE_META[key]?.label || key, mode })
      } else if (mode === 'pro') {
        if (!isPaid(user)) blocked.push({ label: FEATURE_META[key]?.label || key, mode })
      }
    }

    if (blocked.length) {
      const needsMax = blocked.some(item => item.mode === 'max')
      return {
        ok: false,
        status: 402,
        error: needsMax ? `${blocked[0].label} requires a Max plan.` : `${blocked[0].label} requires a Pro plan.`,
        code: needsMax ? 'MAX_REQUIRED' : 'PRO_REQUIRED',
        features: blocked.map(item => item.label)
      }
    }

    const paidRows = await prisma.featureFlag.findMany({ where: { key: { in: activeKeys } } })
    const usePaidKeys = paidRows.some(row => row.usePaidKeys === true)

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

export async function paidKeysEnabledFor(featureKeys = []) {
  const keys = [...new Set(featureKeys.filter(key => FEATURE_KEYS.includes(key)))]
  if (!keys.length) return false
  const rows = await prisma.featureFlag.findMany({ where: { key: { in: keys } } })
  return rows.some(row => row.usePaidKeys === true)
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

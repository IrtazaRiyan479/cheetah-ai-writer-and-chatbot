import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { geminiGenerateContent, listGeminiApiKeys } from './geminiKeys'
import { resolvePaidTier } from './providerKeys'
import { cleanRewriteKeyword } from './articleHtml'

import { callLightLLM, parseJsonSafe } from './lightLLM'

export const generationContext = new AsyncLocalStorage()

function currentGeneration() {
  return generationContext.getStore() || {}
}

function parseRequestedCount(value) {
  const raw = String(value ?? '').trim()

  if (!raw) return null

  const count = parseInt(raw, 10)

  if (!Number.isFinite(count) || count < 0) return null

  return count
}

function headingSkipsMedia(heading) {
  const lower = String(heading || '').toLowerCase()

  return (
    lower.includes('conclusion') ||
    lower.includes('final verdict') ||
    lower.includes('faq') ||
    lower.includes('frequently asked')
  )
}

function outlineGroupHeadings(outline) {
  const headings = []
  let current = null

  for (const item of Array.isArray(outline) ? outline : []) {
    if (!item || (item.type !== 'h2' && item.type !== 'h3')) continue

    if (item.type === 'h2') {
      current = item
      headings.push(String(item.text || ''))
    } else if (!current) {
      headings.push(String(item.text || ''))
    }
  }

  return headings
}

function resolveAutoMediaPlacement(sectionIndex, heading, settings) {
  const index = Number(sectionIndex)

  if (!Number.isFinite(index) || index < 0) return null

  const store = currentGeneration()
  const headings = outlineGroupHeadings(store.outline)
  const total = Math.max(headings.length, Number(store.totalSections) || 0, index + 1)
  const heroBlocksFirst = Boolean(settings?.heroImage)
  const imageCap = parseRequestedCount(settings?.numberOfImages)
  const videoCap = parseRequestedCount(settings?.numberOfYoutubeVideos)
  const maxImages = imageCap == null ? 999 : imageCap
  const maxVideos = videoCap == null ? 999 : videoCap
  const eligible = []

  for (let i = 0; i < total; i++) {
    const text = i === index ? String(heading || headings[i] || '') : headings[i] || ''

    if (i === 0 && heroBlocksFirst) continue
    if (headingSkipsMedia(text)) continue
    eligible.push(i)
  }

  let images = 0
  let videos = 0
  let preferImage = true

  for (const section of eligible) {
    if (images >= maxImages && videos >= maxVideos) break

    let kind = null

    if (preferImage && images < maxImages) {
      kind = 'image'
      images += 1
      if (videos < maxVideos) preferImage = false
    } else if (videos < maxVideos) {
      kind = 'video'
      videos += 1
      preferImage = images < maxImages
    } else if (images < maxImages) {
      kind = 'image'
      images += 1
    }

    if (section === index) {
      if (!kind) return null

      return {
        kind,
        imageOrdinal: kind === 'image' ? images - 1 : 0,
        videoOrdinal: kind === 'video' ? videos - 1 : 0
      }
    }
  }

  return null
}

const HERO_FONT_FAMILY = 'DejaVu Sans'

function heroFontDir() {
  const bundled = dirname(fileURLToPath(new URL('./fonts/DejaVuSans-Bold.ttf', import.meta.url)))

  if (existsSync(join(bundled, 'DejaVuSans-Bold.ttf'))) return bundled

  const fromCwd = join(process.cwd(), 'src/app/api/generate/utils/fonts')

  if (existsSync(join(fromCwd, 'DejaVuSans-Bold.ttf'))) return fromCwd

  return ''
}

// librsvg draws a .notdef box per character when fontconfig has no Latin face.
// Point it at the bundled DejaVu file before sharp loads.
function ensureHeroFontconfig() {
  try {
    const fontDir = heroFontDir()

    if (!fontDir) return

    const cacheDir = join('/tmp', 'affigenie-fontconfig')

    mkdirSync(cacheDir, { recursive: true })

    const confPath = join(cacheDir, 'fonts.conf')
    const xmlDir = fontDir.replace(/&/g, '\u0026amp;')
    const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${xmlDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>`

    if (!existsSync(confPath) || process.env.AFFIGENIE_FONTCONFIG_DIR !== fontDir) {
      writeFileSync(confPath, conf)
      process.env.AFFIGENIE_FONTCONFIG_DIR = fontDir
    }

    process.env.FONTCONFIG_FILE = confPath
  } catch (error) {
    console.warn('[hero] fontconfig setup failed', error?.message || error)
  }
}

ensureHeroFontconfig()

export function mediaKey(item) {
  if (!item) return ''

  if (typeof item === 'object' && item.id != null) {
    return `${String(item.source || 'img').toLowerCase()}:${item.id}`
  }

  const url = typeof item === 'string' ? item : item.url || ''

  if (!url) return ''

  try {
    const u = new URL(url)

    u.search = ''
    u.hash = ''

    const unsplash = u.pathname.match(/photo-([a-zA-Z0-9_-]+)/)

    if (unsplash) return `unsplash:${unsplash[1]}`

    const pexels = u.pathname.match(/\/photos\/(\d+)/)

    if (pexels) return `pexels:${pexels[1]}`

    const pix = u.pathname.match(/\/get\/g([a-f0-9]+)_/)

    if (pix) return `pixabay-file:${pix[1]}`

    return `${u.origin}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return String(url).split('?')[0]
  }
}

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'arent',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'cant',
  'cannot',
  'could',
  'couldnt',
  'did',
  'didnt',
  'do',
  'does',
  'doesnt',
  'doing',
  'dont',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'hadnt',
  'has',
  'hasnt',
  'have',
  'havent',
  'having',
  'he',
  'hed',
  'hell',
  'hes',
  'her',
  'here',
  'heres',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'hows',
  'i',
  'id',
  'ill',
  'im',
  'ive',
  'if',
  'in',
  'into',
  'is',
  'isnt',
  'it',
  'its',
  'itself',
  'lets',
  'me',
  'more',
  'most',
  'mustnt',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'shant',
  'she',
  'shed',
  'shell',
  'shes',
  'should',
  'shouldnt',
  'so',
  'some',
  'such',
  'than',
  'that',
  'thats',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'theres',
  'these',
  'they',
  'theyd',
  'theyll',
  'theyre',
  'theyve',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'wasnt',
  'we',
  'wed',
  'well',
  'were',
  'weve',
  'werent',
  'what',
  'whats',
  'when',
  'whens',
  'where',
  'wheres',
  'which',
  'while',
  'who',
  'whos',
  'whom',
  'why',
  'whys',
  'with',
  'wont',
  'would',
  'wouldnt',
  'you',
  'youd',
  'youll',
  'youre',
  'youve',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'guide',
  'best',
  'top',
  'vs',
  'versus',
  'can',
  'will',
  'introduction',
  'conclusion',
  'overview',
  'summary',
  'tips',
  'ways',
  'things',
  'how',
  'what',
  'why',
  'when',
  'where',
  'caring',
  'care',
  'old',
  'new',
  'ultimate',
  'complete'
])

function isUsed(candidate, usedList) {
  const used = new Set((usedList || []).map(k => mediaKey(k)).filter(Boolean))

  if (!candidate) return true

  const keys = []

  if (typeof candidate === 'object') {
    keys.push(mediaKey(candidate))
    if (candidate.id != null) keys.push(mediaKey({ id: candidate.id, source: candidate.source || 'img' }))
    if (candidate.url) keys.push(mediaKey(candidate.url))
  } else {
    keys.push(mediaKey(candidate))
  }

  return keys.filter(Boolean).some(k => used.has(k) || used.has(mediaKey(k)))
}

export async function fetchPexelsImage(query, { page = 1, perPage = 12 } = {}) {
  if (!process.env.PEXELS_API_KEY) return []

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    )

    if (!res.ok) return []
    const data = await res.json()

    return (data.photos || []).map(p => ({
      id: p.id,
      url: p.src.large,
      alt: p.alt || query,
      source: 'Pexels'
    }))
  } catch (e) {
    console.error('Pexels Error:', e)

    return []
  }
}

export async function fetchPixabayImage(query, { page = 1, perPage = 15 } = {}) {
  if (!process.env.PIXABAY_API_KEY) return []

  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${perPage}&page=${page}`
    )

    if (!res.ok) return []
    const data = await res.json()

    if (!data.hits?.length) return []

    return data.hits.map(h => ({
      url: h.webformatURL || h.largeImageURL,
      alt: h.tags || query,
      source: 'Pixabay'
    }))
  } catch (e) {
    console.error('Pixabay API Error:', e)

    return []
  }
}

export async function fetchUnsplashImage(query, { page = 1, perPage = 10 } = {}) {
  if (!process.env.UNSPLASH_API_KEY) return []

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape&client_id=${process.env.UNSPLASH_API_KEY}`
    )

    if (!res.ok) return []
    const data = await res.json()

    return (data.results || []).map(r => ({
      id: r.id,
      url: r.urls.regular,
      alt: r.alt_description || query,
      source: 'Unsplash'
    }))
  } catch (e) {
    console.error('Unsplash Error:', e)

    return []
  }
}

const NON_VISUAL_WORDS = new Set([
  ...STOP_WORDS,
  'train',
  'training',
  'teach',
  'teaching',
  'learn',
  'learning',
  'mastering',
  'establishing',
  'developing',
  'understanding',
  'caring',
  'care',
  'guide',
  'tips',
  'ways',
  'best',
  'top',
  'how',
  'what',
  'why',
  'when',
  'first',
  'weeks',
  'week',
  'old',
  'new',
  'ultimate',
  'complete',
  'comprehensive',
  'introduction',
  'conclusion',
  'overview',
  'importance',
  'using',
  'ensure',
  'must'
])

function visualTokens(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !NON_VISUAL_WORDS.has(w))
}

function coreSubjectQuery(topic, heading) {
  const topicVis = visualTokens(topic).slice(0, 3)

  const headingVis = visualTokens(heading)
    .filter(w => !topicVis.includes(w))
    .slice(0, 2)

  const q = [...topicVis, ...headingVis].join(' ').trim()

  return q || topicVis.join(' ') || (topic || 'dog puppy').trim()
}

async function getSmartImageKeyword(topic, heading, _genAI) {
  const visualFallback = () => {
    const stockSearchQuery = coreSubjectQuery(topic, heading)

    return {
      isRealisticStockPhoto: true,
      stockSearchQuery,
      aiGenerationPrompt: `Photorealistic photo of ${stockSearchQuery}, clearly showing the main subject, no text, no watermark`
    }
  }

  try {
    const result = await callLightLLM({
      system: 'Reply with JSON only. No markdown.',
      json: true,
      max_tokens: 160,
      waitOn429: false,
      prompt: `Stock PHOTO search query for a blog image.
Article topic (MAIN SUBJECT — must appear in the query): "${topic}"
Section heading: "${heading}"

RULES:
- stockSearchQuery MUST include the visual subject from the topic (e.g. "german shepherd puppy").
- Add 1-2 concrete nouns from the heading (crate, leash, food bowl, backyard) ONLY if they are photographable objects.
- NEVER use verbs: train, training, teach, how, guide, weeks, importance, establishing.
- NEVER return transport, cities, portraits of strangers, or unrelated objects.

JSON: {"isRealisticStockPhoto":true,"stockSearchQuery":"3-6 words","aiGenerationPrompt":"photorealistic prompt"}`
    })

    const parsed = parseJsonSafe(result?.text)
    const topicVis = visualTokens(topic)
    const q = String(parsed?.stockSearchQuery || '').toLowerCase()
    const hasSubject = topicVis.length === 0 || topicVis.some(t => q.includes(t))

    if (typeof parsed?.isRealisticStockPhoto === 'boolean' && parsed.stockSearchQuery && hasSubject) {
      return parsed
    }
  } catch (e) {
    console.warn('[smart-image] light LLM skipped', e?.message || e)
  }

  return visualFallback()
}

const GENERIC_IMAGE_WORDS = [
  'nature',
  'flower',
  'flowers',
  'succulent',
  'landscape',
  'mountain',
  'mountains',
  'background',
  'abstract',
  'wallpaper',
  'scenery',
  'sunset'
]

export function buildSubjectQuery(title, keyword) {
  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'your',
    'best',
    'top',
    'how',
    'what',
    'why',
    'guide',
    'review',
    'reviews'
  ])

  const tokens = `${keyword || ''} ${title || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stop.has(word))

  return [...new Set(tokens)].slice(0, 6).join(' ')
}

function isIrrelevantImage(image, query) {
  const alt = `${image?.alt || ''} ${image?.tags || ''}`.toLowerCase()

  const queryTokens = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)

  const overlap = queryTokens.filter(word => alt.includes(word))
  const banned = GENERIC_IMAGE_WORDS.filter(word => alt.includes(word))
  const queryAllowsBanned = banned.some(word => queryTokens.includes(word))

  if (!overlap.length) return true
  if (banned.length && !queryAllowsBanned) return true

  return false
}

export async function pickRelevantImages(title, keyword, count = 4) {
  const query = buildSubjectQuery(title, keyword)

  if (!query) return []

  const [pexels, pixabay, unsplash] = await Promise.all([
    fetchPexelsImage(query, { perPage: 12 }),
    fetchPixabayImage(query, { perPage: 12 }),
    fetchUnsplashImage(query, { perPage: 12 })
  ])

  const seen = new Set()
  const picked = []

  for (const list of [pexels, pixabay, unsplash]) {
    const ranked = (list || [])
      .filter(image => image?.url && !seen.has(image.url) && !isIrrelevantImage(image, query))
      .map(image => ({ ...image, score: calculateRelevanceScore(image.alt || image.tags || '', query, keyword) }))
      .filter(image => image.score >= 3)
      .sort((a, b) => b.score - a.score)

    for (const image of ranked) {
      if (picked.length >= count) break
      seen.add(image.url)
      picked.push(image)
    }
  }

  return picked
}

function siteLabel(settings = {}) {
  const raw = settings.siteName || settings.clientSite || settings.website || settings.targetSite || ''

  const host = String(raw)
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/^www\./, '')

  const name = host
    .replace(/\.[a-z]{2,}$/i, '')
    .replace(/[-_]/g, ' ')
    .trim()

  return name ? name.replace(/\b\w/g, char => char.toUpperCase()) : 'AffiGenie'
}

function heroSvg(title, siteName, hasPhoto) {
  const xml = value =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  let font = 58
  let lines = []

  while (font >= 28) {
    const max = Math.max(12, Math.floor(1040 / (font * 0.62)))
    const words = String(title || 'Article').split(/\s+/)

    lines = []
    let line = ''

    for (const word of words) {
      const next = line ? `${line} ${word}` : word

      if (next.length > max && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }

    if (line) lines.push(line)
    if (lines.length <= 4) break
    font -= 4
  }

  lines = lines.slice(0, 4)
  const startY = 250 - ((lines.length - 1) * font) / 2

  const text = lines
    .map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : font + 8}">${xml(line)}</tspan>`)
    .join('')

  const underlineY = startY + lines.length * (font + 6)

  return `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
    ${hasPhoto ? '<rect width="1200" height="675" fill="rgba(15,23,42,0.55)"/>' : '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#4f46e5"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/>'}
    <text x="80" y="${startY}" fill="#ffffff" font-family="${HERO_FONT_FAMILY}" font-size="${font}" font-weight="700">${text}</text>
    <line x1="80" y1="${underlineY}" x2="420" y2="${underlineY}" stroke="#ffffff" stroke-width="4"/>
    <text x="80" y="620" fill="#ffffff" font-family="${HERO_FONT_FAMILY}" font-size="28">${xml(siteName)}</text>
  </svg>`
}

async function fetchHeroPhoto(url) {
  const candidates = []
  const raw = String(url || '').trim()

  if (raw && !raw.startsWith('data:')) candidates.push(raw)

  const stripped = raw.replace(/\._[A-Za-z0-9_,]+_\./, '.')

  if (stripped && stripped !== raw) candidates.push(stripped)

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; AffiGenie/1.0; +https://affigenie.com)',
          ...(/amazon|media-amazon/i.test(candidate) ? { Referer: 'https://www.amazon.com/' } : {})
        }
      })

      if (!res.ok) continue

      const type = res.headers.get('content-type') || ''

      if (type && !/^image\//i.test(type)) continue

      const buffer = Buffer.from(await res.arrayBuffer())

      if (buffer.length < 800) continue

      return buffer
    } catch (error) {
      console.warn('[hero] photo fetch failed', error?.message || error)
    }
  }

  return null
}

export async function buildBrandedHero({ title, siteName, backgroundUrl, backgroundUrls, requirePhoto = false }) {
  const urls = []

  for (const url of [...(backgroundUrls || []), backgroundUrl]) {
    if (url && !String(url).startsWith('data:') && !urls.includes(url)) urls.push(url)
  }

  let photoBuffer = null

  for (const url of urls) {
    photoBuffer = await fetchHeroPhoto(url)
    if (photoBuffer) break
  }

  if (requirePhoto && urls.length && !photoBuffer) {
    const error = new Error('HERO_PHOTO_UNAVAILABLE')

    error.fallbackUrl = urls[0]
    throw error
  }

  const svg = Buffer.from(heroSvg(title, siteName, Boolean(photoBuffer)))

  ensureHeroFontconfig()

  const sharp = (await import('sharp')).default
  let base = sharp({ create: { width: 1200, height: 675, channels: 3, background: '#1e3a8a' } })

  if (photoBuffer) {
    base = sharp(photoBuffer).resize(1200, 675, {
      fit: requirePhoto ? 'contain' : 'cover',
      background: '#ffffff'
    })
  }

  const png = await base
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${png.toString('base64')}`
}

const REVIEW_TINTS = [
  { name: 'blue', rgb: [37, 99, 235] },
  { name: 'pink', rgb: [219, 39, 119] },
  { name: 'yellow', rgb: [202, 138, 4] },
  { name: 'teal', rgb: [13, 148, 136] }
]

function xmlText(value) {
  return String(value || '')
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
}

function wrapCaption(value, maxChars, maxLines) {
  const words = String(value || 'Product')
    .split(/\s+/)
    .filter(Boolean)
  const lines = []
  let line = ''

  for (const word of words) {
    const next = line ? `${line} ${word}` : word

    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else {
      line = next
    }
  }

  if (line && lines.length < maxLines) lines.push(line)

  return lines.length ? lines.slice(0, maxLines) : ['Product']
}

function productCaptionSvg(title, siteName, rgb, width, height) {
  const [r, g, b] = rgb
  const lines = wrapCaption(title, 42, 2)
  const barH = 132
  const barY = height - barH
  const text = lines
    .map((line, index) => `<tspan x="48" dy="${index === 0 ? 0 : 36}">${xmlText(line)}</tspan>`)
    .join('')

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${barY}" fill="rgb(${r},${g},${b})" fill-opacity="0.14"/>
    <rect y="${barY}" width="${width}" height="${barH}" fill="rgb(${r},${g},${b})"/>
    <text x="48" y="${barY + 48}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700">${text}</text>
    <text x="48" y="${height - 28}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="22">${xmlText(siteName)}</text>
  </svg>`
}

export async function buildAmazonReviewImages({ title, settings, imageUrls } = {}) {
  const urls = []

  for (const url of imageUrls || []) {
    const value = String(url || '').trim()

    if (value && !urls.includes(value)) urls.push(value)
  }

  let photoBuffer = null

  for (const url of urls) {
    photoBuffer = await fetchHeroPhoto(url)
    if (photoBuffer) break
  }

  if (!photoBuffer) return []

  const siteName = siteLabel(settings || {})
  const caption = String(title || 'Product').trim() || 'Product'
  const sharp = (await import('sharp')).default
  const width = 1200
  const height = 675
  const photo = await sharp(photoBuffer).resize(1040, 510, { fit: 'contain', background: '#f8fafc' }).png().toBuffer()
  const gallery = []

  for (const tint of REVIEW_TINTS) {
    const svg = Buffer.from(productCaptionSvg(caption, siteName, tint.rgb, width, height))
    const png = await sharp({ create: { width, height, channels: 3, background: '#f8fafc' } })
      .composite([
        { input: photo, top: 12, left: 80 },
        { input: svg, top: 0, left: 0 }
      ])
      .png({ compressionLevel: 9 })
      .toBuffer()

    gallery.push({
      url: `data:image/png;base64,${png.toString('base64')}`,
      alt: caption,
      source: 'amazon-product',
      tint: tint.name
    })
  }

  return gallery
}

function urlsSharePhoto(candidateUrl, bannedUrl) {
  const a = String(candidateUrl || '')
  const b = String(bannedUrl || '')

  if (!a || !b) return false
  if (a === b || b.includes(a) || a.includes(b)) return true
  const id = a.match(/pexels\.com\/photos\/(\d+)/i)?.[1] || a.match(/images\.unsplash\.com\/(?:photo-)?([^/?]+)/i)?.[1]

  return Boolean(id && id.length > 3 && b.includes(id))
}

export async function attachBrandedHero(result, settings = {}) {
  if (!result?.success) return result

  if (settings.type === 'amazon-review' || result.heroImageSource === 'amazon-product') {
    let gallery = Array.isArray(result.productImages) ? result.productImages.filter(img => img?.url) : []

    if (!gallery.length) {
      const imageUrls = []

      const push = url => {
        const value = String(url || '').trim()

        if (value && !imageUrls.includes(value)) imageUrls.push(value)
      }

      push(result.productImageUrl)

      for (const item of Array.isArray(result.outline) ? result.outline : []) {
        push(item?.productData?.imageUrl)

        for (const url of item?.productData?.imageUrls || []) push(url)
      }

      const productName =
        (Array.isArray(result.outline) ? result.outline : []).find(item => item?.productData?.productName)?.productData
          ?.productName || ''

      gallery = await buildAmazonReviewImages({
        title: productName || settings.targetKeyword || result.title || 'Product',
        settings,
        imageUrls
      }).catch(() => [])
    }

    if (gallery[0]?.url) {
      return {
        ...result,
        heroImage: gallery[0].url,
        heroImageId: null,
        heroImageSource: 'amazon-product',
        productImages: gallery
      }
    }

    let heroImage = ''

    try {
      heroImage = await buildBrandedHero({
        title: cleanRewriteKeyword(result.title || settings.targetKeyword || 'Product') || 'Product',
        siteName: siteLabel(settings)
      })
    } catch (error) {
      console.error('[hero] product review raster failed', error?.message || error)
    }

    return {
      ...result,
      heroImage: heroImage || '',
      heroImageId: null,
      heroImageSource: heroImage ? 'branded-gradient' : null,
      productImages: []
    }
  }

  const title = cleanRewriteKeyword(result.title || settings.targetKeyword || 'Article') || 'Article'
  const rewriteStock = settings.type === 'amazon-roundup-rewrite' || settings.type === 'amazon-review-rewrite'

  const youtubeThumb =
    settings.type === 'youtube-blog' && /^https?:/i.test(String(result.heroImage || '')) ? String(result.heroImage) : ''

  const banned = Array.isArray(result.excludedHeroUrls) ? result.excludedHeroUrls.map(String) : []

  const photos = youtubeThumb
    ? []
    : await pickRelevantImages(title, settings.targetKeyword || title, rewriteStock ? 6 : 1)

  const fresh = photos.filter(
    item => !banned.some(url => urlsSharePhoto(item?.url, url) || (item?.id != null && url.includes(String(item.id))))
  )

  const photo = rewriteStock ? fresh[1] || fresh[0] || photos[1] || photos[0] || null : photos[0] || null
  const backgroundUrls = youtubeThumb ? [youtubeThumb] : photo?.url ? [photo.url] : []
  let heroImage = ''

  try {
    heroImage = await buildBrandedHero({
      title,
      siteName: siteLabel(settings),
      backgroundUrl: backgroundUrls[0] || '',
      backgroundUrls
    })
  } catch (error) {
    console.error('[hero] branded raster failed', error?.message || error)
  }

  if (!heroImage) {
    const rawHero = String(result.heroImage || '')
    const fallback = rewriteStock && /amazon|media-amazon/i.test(rawHero) ? '' : rawHero

    return {
      ...result,
      heroImage: fallback,
      heroImageId: fallback ? (result.heroImageId ?? null) : null,
      heroImageSource: fallback ? result.heroImageSource || 'gradient' : 'gradient'
    }
  }

  return {
    ...result,
    heroImage,
    heroImageId: null,
    heroImageSource: youtubeThumb ? 'branded-youtube' : photo ? 'branded-photo' : 'branded-gradient'
  }
}

export function calculateRelevanceScore(altText, query, topic) {
  const haystack = `${altText || ''} ${topic || ''} ${query || ''}`.toLowerCase()
  const altOnly = String(altText || '').toLowerCase()

  if (
    GENERIC_IMAGE_WORDS.some(
      word => altOnly.includes(word) && !`${query || ''} ${topic || ''}`.toLowerCase().includes(word)
    )
  )
    return 0
  if (!altText) return 0
  void haystack

  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'to',
    'in',
    'on',
    'with',
    'by',
    'for',
    'at',
    'about',
    'is',
    'are',
    'photo',
    'image',
    'picture',
    'background',
    'isolated',
    'stock',
    'closeup',
    'close',
    'up',
    'shot',
    'view',
    'horizontal',
    'vertical'
  ])

  const clean = str =>
    (str || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))

  const altTokens = clean(altText)
  const altJoined = altTokens.join(' ')
  const altSet = new Set(altTokens)
  const queryTokens = clean(query)
  const topicTokens = clean(topic)
  const targetTokens = [...new Set([...queryTokens, ...topicTokens])]

  if (targetTokens.length === 0) return 0

  const animalHints = [
    'dog',
    'puppy',
    'puppies',
    'canine',
    'cat',
    'kitten',
    'pet',
    'breed',
    'shepherd',
    'retriever',
    'labrador',
    'terrier',
    'hound'
  ]

  const topicLower = (topic || '').toLowerCase()
  const topicIsAnimal = animalHints.some(h => topicLower.includes(h))

  if (topicIsAnimal) {
    const altHasAnimal = animalHints.some(h => altJoined.includes(h))

    if (!altHasAnimal) return 0
  }

  const offTopic = [
    'train',
    'railway',
    'subway',
    'metro',
    'locomotive',
    'station',
    'kyoto',
    'japan',
    'tokyo',
    'tram',
    'bus',
    'airplane',
    'airport',
    'cone',
    'traffic',
    'stadium',
    'construction',
    'barrier',
    'woman',
    'man',
    'girl',
    'boy',
    'portrait',
    'people',
    'person',
    'crowd'
  ]

  const offHits = offTopic.filter(w => altJoined.includes(w) && !topicLower.includes(w)).length

  if (offHits >= 2) return 0

  let score = 0
  let matched = 0

  targetTokens.forEach(token => {
    if (NON_VISUAL_WORDS?.has?.(token)) return

    if (altSet.has(token)) {
      score += 2.5
      matched += 1
    } else {
      for (const alt of altTokens) {
        if (alt.includes(token) || token.includes(alt)) {
          score += 1.0
          matched += 0.5
          break
        }
      }
    }
  })

  const queryPhrase = queryTokens.filter(t => !NON_VISUAL_WORDS?.has?.(t)).join(' ')

  if (queryPhrase.length > 4 && altJoined.includes(queryPhrase)) score += 4

  if (targetTokens.length) score += (matched / targetTokens.length) * 3

  if (topicIsAnimal) {
    const humanHits = ['man', 'woman', 'person', 'people', 'portrait', 'face'].filter(h => altJoined.includes(h)).length

    if (humanHits > 0) score -= humanHits * 4
  }

  return Math.max(0, score)
}

export async function generateFallbackImage(prompt) {
  const paid = resolvePaidTier(undefined, 'gemini-3-pro-image')

  if (!listGeminiApiKeys({ paid }).length) return null

  try {
    const finalPrompt = `photorealistic style, landscape orientation, highly detailed. ${prompt}`

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: { imageConfig: { aspectRatio: '16:9' } }
    }

    const data = await geminiGenerateContent({ model: 'gemini-3-pro-image', body: requestBody, paid })
    let originalBase64 = null

    data.candidates?.forEach(candidate => {
      candidate.content?.parts?.forEach(part => {
        if (part.inlineData?.data) originalBase64 = part.inlineData.data
        else if (part.inline_data?.data) originalBase64 = part.inline_data.data
      })
    })

    if (originalBase64) {
      return {
        url: `data:image/png;base64,${originalBase64}`,
        alt: `AI Generated: ${prompt}`,
        source: 'Gemini'
      }
    }
  } catch (e) {
    console.error('Gemini Image Gen Fallback Error:', e)
  }

  return null
}

export async function fetchSerperData(query, type = 'search') {
  if (!process.env.SERPER_API_KEY) return []

  try {
    const res = await fetch(`https://google.serper.dev/${type}`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    })

    const data = await res.json()

    if (type === 'news' && data.news) return data.news.slice(0, 4).map(n => `${n.title}: ${n.snippet}`)
    if (type === 'scholar' && data.organic) return data.organic.slice(0, 4).map(o => `${o.title}: ${o.snippet}`)
    if (data.organic) return data.organic.slice(0, 4)

    return []
  } catch (e) {
    console.error('Serper API Error:', e)

    return []
  }
}

export async function fetchLiveKeywords(keyword) {
  const keywords = new Set()

  if (!keyword) return []

  try {
    const gsRes = await fetch(
      `http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`
    )

    if (gsRes.ok) {
      const gsData = await gsRes.json()

      if (gsData[1] && Array.isArray(gsData[1])) gsData[1].forEach(k => keywords.add(k))
    }
  } catch (e) {
    console.error('Google Suggest Error:', e)
  }

  try {
    const dmRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(keyword)}&max=10`)

    if (dmRes.ok) {
      const dmData = await dmRes.json()

      dmData.forEach(item => keywords.add(item.word))
    }
  } catch (e) {
    console.error('Datamuse Error:', e)
  }

  if (process.env.SERPER_API_KEY) {
    try {
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: keyword })
      })

      if (serperRes.ok) {
        const serperData = await serperRes.json()

        if (serperData.relatedSearches) serperData.relatedSearches.forEach(item => keywords.add(item.query))
      }
    } catch (e) {
      console.error('Serper API Error:', e)
    }
  }

  return Array.from(keywords).slice(0, 15)
}

export async function fetchBingTitles(query) {
  const titles = new Set()

  try {
    if (process.env.SERP_API_KEY) {
      const serpUrl = new URL('https://serpapi.com/search.json')

      serpUrl.searchParams.append('engine', 'bing')
      serpUrl.searchParams.append('q', query)
      serpUrl.searchParams.append('cc', 'US')
      serpUrl.searchParams.append('api_key', process.env.SERP_API_KEY)

      const serpRes = await fetch(serpUrl)

      if (serpRes.ok) {
        const serpData = await serpRes.json()

        if (serpData.organic_results) {
          serpData.organic_results.forEach(item => titles.add(item.title))

          return Array.from(titles)
        }
      }
    }
  } catch (e) {
    console.error('SerpAPI Bing Error:', e)
  }

  try {
    if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
      const credentials = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString(
        'base64'
      )

      const postData = [{ keyword: query, language_code: 'en', location_code: 2840 }]

      const dfsRes = await fetch('https://api.dataforseo.com/v3/serp/bing/organic/live/advanced', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (dfsRes.ok) {
        const dfsData = await dfsRes.json()
        const results = dfsData.tasks?.[0]?.result?.[0]?.items || []

        results.forEach(item => titles.add(item.title))
      }
    }
  } catch (e) {
    console.error('DataForSEO Error:', e)
  }

  return Array.from(titles)
}

export async function fetchYouTubeVideo(query) {
  if (!process.env.YOUTUBE_API_KEY) return null

  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=15&videoEmbeddable=true&key=${process.env.YOUTUBE_API_KEY}`
      )

      if (!res.ok) {
        console.error(`YouTube Data API HTTP ${res.status} (attempt ${attempt})`)
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 800 * attempt))
        continue
      }

      const data = await res.json()

      if (data.items && data.items.length > 0) {
        return data.items
          .filter(item => item?.id?.videoId)
          .map(item => ({
            id: item.id.videoId,
            title: item.snippet?.title || 'YouTube video'
          }))
      }

      return null
    } catch (e) {
      console.error(`YouTube Data API Error (attempt ${attempt}):`, e?.message || e)
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 800 * attempt))
    }
  }

  return null
}

export async function isYouTubeVideoAvailable(url) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, { signal: controller.signal })

    clearTimeout(timer)

    return res.ok
  } catch (error) {
    console.warn('YouTube oEmbed check failed, assuming available:', error?.message || error)

    return true
  }
}

async function getSmartVideoQuery(topic, heading, _genAI) {
  const fallback = () => {
    const cleanTopic = (topic || '').toLowerCase().replace(/[^\w\s]|_/g, '')
    const fallbackWords = cleanTopic.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))

    return fallbackWords.slice(0, 4).join(' ') || (topic || '').trim() || 'tutorial'
  }

  //   try {
  //     const prompt = `Generate a highly specific 3-5 word YouTube search query for an educational video.
  // CRITICAL RULE 1: The query MUST be primarily about the main topic: "${topic}".
  // CRITICAL RULE 2: Integrate context from the section heading "${heading}" but do not lose the main topic.
  // CRITICAL RULE 3: Do NOT use generic words like 'introduction', 'conclusion', 'tutorial', or 'video'.
  // Reply ONLY with the exact search query, no quotes.`

  //     const result = await callLightLLM({ prompt })

  //     if (!result?.text) return fallback()

  //     const keyword = result.text.trim().replace(/['"]/g, '')
  //     const cleanTopic = (topic || '').toLowerCase().replace(/[^\w\s]|_/g, '')
  //     const cleanKeyword = keyword.toLowerCase().replace(/[^\w\s]|_/g, '')
  //     const topicWords = cleanTopic.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  //     const isRelated = topicWords.some(w => cleanKeyword.includes(w))

  //     if (!isRelated && topicWords.length > 0) {
  //       return topicWords.slice(0, 4).join(' ')
  //     }

  //     return keyword || topicWords.slice(0, 4).join(' ') || topic.trim()
  //   } catch (e) {
  //     console.error('getSmartVideoQuery Error:', e?.message || e)

  //     return fallback()
  //   }

  return fallback()
}

export async function fetchPeopleAlsoSearchFor(query) {
  const bingKeywords = new Set()
  const googleKeywords = new Set()

  const bingTitles = await fetchBingTitles(query)

  bingTitles.forEach(title => bingKeywords.add(title))

  if (!process.env.SERPER_API_KEY) {
    return { bing: Array.from(bingKeywords).slice(0, 10), google: [] }
  }

  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    })

    const data = await res.json()

    if (data.peopleAlsoAsk) data.peopleAlsoAsk.forEach(item => googleKeywords.add(item.question))
    if (data.relatedSearches) data.relatedSearches.forEach(item => googleKeywords.add(item.query))

    return {
      bing: Array.from(bingKeywords).slice(0, 8),
      google: Array.from(googleKeywords).slice(0, 8)
    }
  } catch (e) {
    console.error('Serper LSI Fetch Error:', e)

    return { bing: Array.from(bingKeywords).slice(0, 10), google: [] }
  }
}

export async function fetchArticleData(url) {
  if (!url) return { success: false, text: '', title: '' }

  try {
    const res = await fetch(`https://r.jina.ai/${url}`)

    if (!res.ok) {
      throw new Error(`Failed to fetch article: ${res.statusText}`)
    }

    const markdownText = await res.text()

    const firstLine = markdownText.split('\n').find(line => String(line || '').trim()) || ''
    const extractedTitle = cleanRewriteKeyword(firstLine) || 'Extracted Article'

    return {
      success: true,
      text: markdownText,
      title: extractedTitle
    }
  } catch (error) {
    console.error('Article Fetch Error:', error)

    return { success: false, text: '', error: error.message }
  }
}

export async function fetchRawArticleHtml(url) {
  if (!url) return ''

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; AffiGenie/1.0; +https://affigenie.com)'
      }
    })

    if (!res.ok) return ''

    const html = await res.text()

    return String(html || '').slice(0, 500000)
  } catch (error) {
    console.error('Raw article HTML fetch error:', error?.message || error)

    return ''
  }
}

const LINK_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'your',
  'this',
  'that',
  'review',
  'reviews',
  'best',
  'guide',
  'what',
  'how',
  'why',
  'when',
  'into',
  'about',
  'over',
  'under',
  'after',
  'before',
  'using',
  'used',
  'than',
  'then',
  'have',
  'has',
  'are',
  'was',
  'were',
  'will',
  'just',
  'more',
  'most',
  'very',
  'into'
])

function linkTokens(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !LINK_STOP_WORDS.has(word))
}

function isSpecificArticleUrl(raw) {
  let url

  try {
    url = new URL(String(raw || ''))
  } catch {
    return false
  }

  if (!/^https?:$/i.test(url.protocol)) return false

  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (/(^|\.)google\.[a-z.]+$/.test(host) || host.includes('scholar.google')) return false
  if (/(^|\.)microsoft\.[a-z.]+$/.test(host) || /(^|\.)office\.com$/.test(host) || host.endsWith('.office.net')) return false
  if (/(^|\.)live\.com$/.test(host) || /(^|\.)bing\.com$/.test(host)) return false

  const blocked = [
    'google.com',
    'scholar.google.com',
    'bing.com',
    'microsoft.com',
    'learn.microsoft.com',
    'docs.microsoft.com',
    'support.microsoft.com',
    'office.com',
    'amazon.com',
    'amzn.to',
    'pinterest.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'youtu.be',
    'reddit.com',
    'quora.com',
    'tiktok.com',
    'ebay.com',
    'walmart.com',
    'twitter.com',
    'x.com'
  ]

  if (blocked.some(item => host === item || host.endsWith(`.${item}`))) return false
  if (/amazon\.|amzn\./i.test(host)) return false

  const params = [...url.searchParams.keys()].map(key => key.toLowerCase())

  if (params.some(key => ['q', 'query', 'search', 'keyword'].includes(key))) return false
  if (/\/(search|scholar)(\/|$)/i.test(url.pathname)) return false

  const parts = url.pathname.split('/').filter(Boolean)

  if (!parts.length) return false
  if (parts.length === 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0])) return false

  const shallow = new Set([
    'about',
    'news',
    'research',
    'home',
    'index',
    'search',
    'topics',
    'blog',
    'en',
    'en-us',
    'health',
    'health-information',
    'publications',
    'articles',
    'article',
    'resources',
    'learn',
    'docs',
    'documentation',
    'support',
    'help',
    'products',
    'solutions'
  ])

  if (parts.length === 1 && shallow.has(parts[0].toLowerCase())) return false

  const last = parts[parts.length - 1].toLowerCase()

  if (['index.html', 'index.php', 'default.aspx'].includes(last) && parts.length < 3) return false
  if (/^(19|20)\d{2}$/.test(last) && parts.length < 3) return false

  return true
}

function authorityBonus(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '').toLowerCase()

    if (/\.(gov|edu)$/i.test(host) || /(^|\.)who\.int$/.test(host)) return 2
    if (/\.org$/i.test(host) || /pubmed|ncbi|doi\.org|nih\.gov/.test(host)) return 1.5
  } catch {
    return 0
  }

  return 0
}

async function keepLiveSpecificLinks(items) {
  const checks = await Promise.all(
    items.slice(0, 4).map(async item => {
      const link = String(item?.link || '')

      if (!isSpecificArticleUrl(link)) return ''

      try {
        const res = await fetch(link, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(7000),
          headers: {
            Accept: 'text/html,application/pdf',
            'User-Agent': 'Mozilla/5.0 (compatible; AffiGenie/1.0; +https://affigenie.com)'
          }
        })

        if (res.status === 404 || res.status === 410 || res.status >= 500) return ''
        if (res.status >= 400 && ![401, 403, 405, 429].includes(res.status)) return ''

        let sample = ''

        try {
          const reader = res.body?.getReader?.()

          if (reader) {
            const { value } = await reader.read()

            sample = new TextDecoder().decode(value || new Uint8Array()).slice(0, 12000)
            await reader.cancel().catch(() => {})
          }
        } catch {
          sample = ''
        }

        const title = (sample.match(/<title[^>]*>([\s\S]{0,180})<\/title>/i) || [])[1] || ''

        if (/page not found|\b404\b|not found|doesn.?t exist|no longer available|temporarily unavailable/i.test(title)) {
          return ''
        }

        const finalUrl = res.url || link

        return isSpecificArticleUrl(finalUrl) ? finalUrl : ''
      } catch {
        return ''
      }
    })
  )

  return [...new Set(checks.filter(Boolean))].slice(0, 3)
}

function isResearchLink(raw) {
  const link = String(raw || '')

  if (/\.pdf($|\?)/i.test(link)) return true

  return /doi\.org|researchgate\.net|academia\.edu|semanticscholar\.org|arxiv\.org|scholar\.google|books\.google|jstor\.org|sciencedirect\.com|springer\.com|wiley\.com|ncbi\.nlm\.nih\.gov|pubmed\.ncbi/i.test(
    link
  )
}

export async function fetchSerperOutlineData(query, options = {}) {
  const strictProduct = Boolean(options.strictProduct)
  const cleanedQuery = cleanRewriteKeyword(query)

  if (!process.env.SERPER_API_KEY) return { organic: [], faqs: [], related: [], authorityLinks: [] }

  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: cleanedQuery || query })
    })

    const data = await res.json()

    if (data.statusCode === 400 || data.statusCode === 403) {
      console.error('Serper API Error:', data.message)

      return { organic: [], faqs: [], related: [], authorityLinks: [] }
    }

    const organic = Array.isArray(data.organic) ? data.organic : []
    const queryWords = linkTokens(cleanedQuery || query)
    const minOverlap = queryWords.length >= 2 ? 2 : 1
    const ranked = organic
      .filter(item => item?.link && isSpecificArticleUrl(item.link) && !(strictProduct && isResearchLink(item.link)))
      .map(item => {
        const titleHits = linkTokens(item.title || '').filter(token => queryWords.includes(token)).length
        const extraHits = linkTokens(`${item.snippet || ''} ${item.link || ''}`).filter(token =>
          queryWords.includes(token)
        ).length
        const overlap = titleHits + extraHits

        return { ...item, overlap, titleHits, score: overlap + titleHits + authorityBonus(item.link) }
      })
      .filter(item => item.overlap >= minOverlap && (item.titleHits > 0 || item.overlap >= minOverlap + 1))
      .sort((a, b) => b.score - a.score)
    const authorityLinks = await keepLiveSpecificLinks(ranked)

    return {
      organic: organic.slice(0, 4),
      faqs: data.peopleAlsoAsk ? data.peopleAlsoAsk.map(item => item.question) : [],
      related: data.relatedSearches ? data.relatedSearches.map(item => item.query) : [],
      authorityLinks
    }
  } catch (e) {
    console.error('Serper Outline Error:', e)

    return { organic: [], faqs: [], related: [], authorityLinks: [] }
  }
}

export async function fetchSerperPlacesData(query, count = 10, countryCode = 'us', languageCode = 'en') {
  if (!process.env.SERPER_API_KEY) return []

  try {
    const res = await fetch(`https://google.serper.dev/places`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        gl: countryCode.toLowerCase(),
        hl: languageCode.toLowerCase()
      })
    })

    const data = await res.json()
    const places = data.places ? data.places.slice(0, count) : []

    return places.map(place => {
      const lat = Number(place.latitude ?? place.lat ?? place.gpsCoordinates?.latitude)
      const lng = Number(place.longitude ?? place.lng ?? place.gpsCoordinates?.longitude)

      return {
        ...place,
        latitude: Number.isFinite(lat) ? lat : place.latitude,
        longitude: Number.isFinite(lng) ? lng : place.longitude,
        phoneNumber: place.phoneNumber || place.phoneNumberFormatted || place.phone || ''
      }
    })
  } catch (e) {
    console.error('Serper Places API Error:', e)

    return []
  }
}

export { fetchYoutubeVideoData } from './youtubeCaptions'

export function getBaseSystemInstruction(language, country) {
  const baseSystemInstruction = `You are an advanced, lightning-fast AI writing assistant.
      CRITICAL RULE: Do NOT introduce yourself or say "Hello" unless the user asks who you are. Just answer the user's prompt directly and naturally.
     CRITICAL LOCALIZATION & LANGUAGE RULES:
      1. You MUST write the ENTIRE article (including all headings, subheadings, and paragraphs) STRICTLY in the following language: ${language}. Do NOT output English unless the requested language is English.
      2. You MUST tailor the content, cultural references, examples, spelling nuances, and context specifically for this target country/region: ${country}.
      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`

  return baseSystemInstruction
}

export function getToneInstruction(toneOfVoice, customToneOfVoice) {
  let toneInstruction = ''

  const pretty = value => {
    const raw = String(value || '').trim()

    if (!raw) return 'Professional'
    if (raw.toLowerCase() === 'seo') return 'SEO Optimized (Confident, Knowledgeable, Neutral, and Clear)'

    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  if (toneOfVoice === 'custom' && customToneOfVoice) {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a ${pretty(customToneOfVoice)} tone of voice.`
  } else if (toneOfVoice && toneOfVoice !== 'seo') {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a heavily ${pretty(toneOfVoice)} tone of voice.`
  } else {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using an SEO Optimized (Confident, Knowledgeable, Neutral, and Clear) tone of voice.`
  }

  return toneInstruction
}

export function getPovInstruction(pointOfView) {
  let povInstruction = ''

  if (pointOfView === 'first') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Singular perspective (using pronouns like 'I', 'me', 'my', 'myself').`
  } else if (pointOfView === 'first-plural') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Plural perspective (using pronouns like 'we', 'us', 'our', 'ourselves').`
  } else if (pointOfView === 'second') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Second Person perspective (using pronouns like 'you', 'your', 'yours').`
  } else {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Third Person perspective (using pronouns like 'he', 'she', 'it', 'they', 'their').`
  }

  return povInstruction
}

export async function getSeoInstruction(seoOptimization, manualKeywords, targetKeyword) {
  let seoInstruction = ''

  if (seoOptimization === 'manual' && manualKeywords) {
    seoInstruction = `\nCRITICAL SEO REQUIREMENT: You MUST naturally weave the following exact-match keywords into your paragraphs: ${manualKeywords}.`
  } else if (seoOptimization === 'ai' && targetKeyword) {
    const liveKeywords = await fetchLiveKeywords(targetKeyword)

    if (liveKeywords.length > 0) {
      seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. We have pulled live search engine data for this topic. You MUST naturally weave several of the following high-value LSI and Google Autocomplete keywords into the paragraphs: ${liveKeywords.join(', ')}.`
    } else {
      seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. Automatically identify and seamlessly weave high-value LSI (Latent Semantic Indexing) keywords related to "${targetKeyword}" into the paragraphs.`
    }
  }

  return seoInstruction
}

export async function getMediaInstruction(
  uploadedMedia,
  sectionIndex,
  aiImagesAndVideos,
  articleTitle,
  targetKeyword,
  heading,
  genAI,
  usedImageUrls = [],
  settings
) {
  try {
    let mediaInstruction = ''
    let assignedMediaElement = null
    let selectedMediaUrl = null

    if (uploadedMedia && uploadedMedia.length > 0 && sectionIndex < uploadedMedia.length) {
      const mediaItem = uploadedMedia[sectionIndex]

      selectedMediaUrl = mediaItem.url

      if (mediaItem.type.startsWith('image/')) {
        assignedMediaElement = `\n\n<img src="${mediaItem.url}" alt="${mediaItem.name}" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;" />\n\n`
      } else if (mediaItem.type.startsWith('video/')) {
        assignedMediaElement = `\n\n<video src="${mediaItem.url}" controls style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%;"></video>\n\n`
      }

      mediaInstruction = `\n[NOTE: A media file is placed at the end of this section. DO NOT output HTML tags for media.]`
    } else if (aiImagesAndVideos === 'auto') {
      const placement = resolveAutoMediaPlacement(sectionIndex, heading, settings)

      if (!placement) {
        return {
          mediaInstruction:
            '\nMEDIA RULE: Do NOT add any image, iframe, video tag, or YouTube embed in this section. No media slot was reserved here.',
          assignedMediaElement: null,
          mediaUrl: null,
          mediaId: null
        }
      }

      const canHaveImage = placement.kind === 'image'
      const canHaveVideo = placement.kind === 'video'
      const imageSlotNumber = placement.imageOrdinal
      const videoSlotNumber = placement.videoOrdinal

      if (canHaveImage) {
        const coreTopic = articleTitle || targetKeyword

        let smartImageData

        try {
          const kwPromise = getSmartImageKeyword(coreTopic, heading, genAI)

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('smart-image-timeout')), 3500)
          )

          smartImageData = await Promise.race([kwPromise, timeoutPromise])
        } catch (e) {
          const visualStop = new Set([
            ...STOP_WORDS,
            'caring',
            'care',
            'guide',
            'tips',
            'ways',
            'best',
            'top',
            'how',
            'what',
            'why',
            'ultimate',
            'complete',
            'introduction',
            'conclusion',
            'overview'
          ])

          const words = (coreTopic || '')
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !visualStop.has(w))

          const stockQuery = words.slice(0, 4).join(' ') || coreTopic

          smartImageData = {
            isRealisticStockPhoto: true,
            stockSearchQuery: stockQuery,
            aiGenerationPrompt: `Photorealistic landscape photo of ${stockQuery}, no text, no watermark`
          }
        }

        let bestImage = null
        const MIN_ACCEPT = 5
        const topicForScore = `${coreTopic} ${heading}`

        const pickBest = (list, searchQuery) => {
          const unused = (list || []).filter(c => !isUsed(c, usedImageUrls))

          unused.forEach(c => {
            c.score = calculateRelevanceScore(c.alt || '', searchQuery, topicForScore)
          })
          unused.sort((a, b) => b.score - a.score)

          const eligible = unused.filter(c => c.score >= MIN_ACCEPT)

          if (!eligible.length) return null

          const idx = ((imageSlotNumber % eligible.length) + eligible.length) % eligible.length

          return eligible[idx]
        }

        if (smartImageData.isRealisticStockPhoto && smartImageData.stockSearchQuery) {
          const q1 = smartImageData.stockSearchQuery

          const [u1, p1, x1] = await Promise.all([
            fetchUnsplashImage(q1, { page: 1, perPage: 15 }),
            fetchPexelsImage(q1, { page: 1, perPage: 15 }),
            fetchPixabayImage(q1, { page: 1, perPage: 20 })
          ])

          bestImage = pickBest([...u1, ...p1, ...x1], q1)
        }

        if (!bestImage) {
          const q2 = coreSubjectQuery(coreTopic, '')

          if (q2 && q2 !== smartImageData.stockSearchQuery) {
            const [u2, p2, x2] = await Promise.all([
              fetchUnsplashImage(q2, { page: 1, perPage: 15 }),
              fetchPexelsImage(q2, { page: 1, perPage: 15 }),
              fetchPixabayImage(q2, { page: 1, perPage: 20 })
            ])

            bestImage = pickBest([...u2, ...p2, ...x2], q2)
          }
        }

        if (!bestImage) {
          const fallbackPrompt =
            smartImageData?.aiGenerationPrompt ||
            `Photorealistic landscape photo of ${coreTopic}, no text, no watermark`

          const aiImage = await generateFallbackImage(fallbackPrompt)

          if (aiImage?.url) {
            bestImage = { ...aiImage, id: aiImage.id || `ai-section-${imageSlotNumber}`, score: aiImage.score || 1 }
          }
        }

        if (bestImage) {
          selectedMediaUrl = bestImage.url
          console.log(
            `[Section Image] ${bestImage.source} id=${bestImage.id} score=${Number(bestImage.score || 0).toFixed(2)} alt="${(bestImage.alt || '').slice(0, 50)}"`
          )

          const imageTitle = heading || coreTopic
          const imageAlt = `${targetKeyword || coreTopic} ${heading || ''}`.trim()

          assignedMediaElement = `\n\n<img src="${bestImage.url}" alt="${imageAlt}" title="${imageTitle}" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;" />\n\n`
        } else {
          console.log('[Section Image] No on-topic stock photo — skipping image for this section')
          selectedMediaUrl = null
          assignedMediaElement = null
        }
      } else if (canHaveVideo) {
        try {
          const smartYtQuery = await getSmartVideoQuery(articleTitle || targetKeyword, heading, genAI)
          const ytVideos = await fetchYouTubeVideo(smartYtQuery)

          if (ytVideos && ytVideos.length > 0) {
            const availableVideos = ytVideos.filter(
              video => !isUsed(video.id, usedImageUrls) && !isUsed({ id: video.id, source: 'youtube' }, usedImageUrls)
            )

            const start = videoSlotNumber % Math.max(availableVideos.length, 1)

            const ordered = [...availableVideos.slice(start), ...availableVideos.slice(0, start)]

            for (const ytVideo of ordered) {
              const videoUrl = `https://www.youtube.com/watch?v=${ytVideo.id}`
              const isAvailable = await isYouTubeVideoAvailable(videoUrl)

              if (isAvailable) {
                selectedMediaUrl = ytVideo.id
                assignedMediaElement = `\n\n<div data-youtube-video style="margin: 32px 0;"><iframe src="https://www.youtube.com/embed/${ytVideo.id}" title="${(ytVideo.title || '').replace(/"/g, '&quot;')}" style="width: 100%; aspect-ratio: 16/9; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: none; display: block; max-width: 100%;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n\n`
                break
              }
            }
          }
        } catch (videoErr) {
          console.error('[Media] YouTube path failed (section continues without video):', videoErr?.message || videoErr)
        }
      }

      mediaInstruction = canHaveVideo
        ? '\nMEDIA RULE: The system inserts the one YouTube video for this section. Do NOT add another image, iframe, video tag, or YouTube embed.'
        : '\nMEDIA RULE: The system inserts the one image for this section. Do NOT add another image, iframe, video tag, or YouTube embed.'
    }

    return {
      mediaInstruction,
      assignedMediaElement,
      mediaUrl: selectedMediaUrl,
      mediaId:
        selectedMediaUrl && typeof selectedMediaUrl === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(selectedMediaUrl)
          ? mediaKey({ id: selectedMediaUrl, source: 'youtube' })
          : selectedMediaUrl
            ? mediaKey(selectedMediaUrl)
            : null
    }
  } catch (err) {
    console.error('[getMediaInstruction] Non-fatal media failure:', err?.message || err)

    return { mediaInstruction: '', assignedMediaElement: null, mediaUrl: null, mediaId: null }
  }
}

export function getReadabilityInstruction(improveReadability) {
  let readabilityInstruction = ''

  if (improveReadability) {
    readabilityInstruction = `\nSTYLING & READABILITY: You MUST heavily format this section to be highly skimmable. Use bullet points, numbered lists, and bold text for important concepts, terms, or key phrases. Avoid writing long, blocky paragraphs. Break text up aggressively.`
  } else {
    readabilityInstruction = `\nSTYLING & READABILITY: Write in standard, flowing paragraph format. Do not aggressively use bullet points or bold text unless explicitly necessary for a list.`
  }

  return readabilityInstruction
}

export async function getRealTimeInstruction(
  useRealTimeSearchData,
  realTimeDataSource,
  articleTitle,
  targetKeyword,
  heading
) {
  let realTimeInstruction = ''

  if (useRealTimeSearchData && (realTimeDataSource === 'news' || realTimeDataSource === 'scholar')) {
    const liveData = await fetchSerperData(`${articleTitle || targetKeyword} ${heading}`, realTimeDataSource)

    if (liveData.length > 0) {
      const dataStrings = typeof liveData[0] === 'string' ? liveData : liveData.map(d => `${d.title}: ${d.snippet}`)

      realTimeInstruction = `\nREAL-TIME FACTUAL CONTEXT: Use the following recent data points to make your section highly accurate and up-to-date:\n${dataStrings.join('\n')}`
    }
  }

  return realTimeInstruction
}

export function normalizeExternalLink(url) {
  try {
    const parsed = new URL(String(url || ''))

    parsed.hash = ''
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'].forEach(key =>
      parsed.searchParams.delete(key)
    )

    const path = parsed.pathname.replace(/\/+$/, '') || '/'

    return `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${path}${parsed.search}`
  } catch {
    return String(url || '')
      .trim()
      .toLowerCase()
  }
}

function isKeptResourceHost(host, url) {
  if (/(^|\.)amazon\.[a-z.]+$/.test(host) || /(^|\.)amzn\.(to|com)$/.test(host)) return true
  if (host === 'media-amazon.com' || host.endsWith('.media-amazon.com')) return true
  if (host === 'maps.google.com' || host === 'maps.app.goo.gl') return true
  if ((host === 'google.com' || host.endsWith('.google.com')) && url.pathname.startsWith('/maps')) return true
  if (
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be' ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube-nocookie.com') ||
    host === 'ytimg.com' ||
    host.endsWith('.ytimg.com')
  ) {
    return true
  }
  if (host === 'static-maps.yandex.ru' || host.endsWith('.static-maps.yandex.ru')) return true

  return false
}

function externalHrefAllowed(href, allowed) {
  const raw = String(href || '')
    .trim()
    .replace(/&/gi, '&')

  if (!raw || raw.startsWith('#') || raw.startsWith('/') || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) return true

  let url

  try {
    url = new URL(raw)
  } catch {
    return false
  }

  if (!/^https?:$/i.test(url.protocol)) return false

  const host = url.hostname.replace(/^www\./, '').toLowerCase()

  if (isKeptResourceHost(host, url)) return true

  return allowed.has(normalizeExternalLink(raw))
}

export function removeUnapprovedExternalLinks(text, allowedLinks = []) {
  const allowed = new Set((allowedLinks || []).map(normalizeExternalLink))
  let output = String(text || '')

  output = output.replace(/(^|[^!])\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (match, lead, label, url) =>
    externalHrefAllowed(url, allowed) ? match : `${lead}${label}`
  )

  output = output.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
    const href = String(attrs || '').match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    const url = href ? href[1] || href[2] || href[3] || '' : ''

    return externalHrefAllowed(url, allowed) ? match : inner
  })

  output = output.replace(/(^|[\s>])(https?:\/\/[^\s)<]+)(?=$|[\s<])/g, (match, lead, url) =>
    externalHrefAllowed(url, allowed) ? match : lead
  )

  return output
}

export function getExternalLinkInstruction(externalLinks, usedExternalLinks = []) {
  const used = new Set((usedExternalLinks || []).map(link => String(link || '')))
  const availableLinks = (externalLinks || []).filter(link => link && !used.has(link) && isSpecificArticleUrl(link))

  if (!availableLinks.length) {
    return '\nEXTERNAL LINKS: Do NOT add any external URL. Do not invent links. Do not link to homepages, search pages, Google Scholar, Microsoft Docs, or any page that was not provided.'
  }

  return `\nEXTERNAL LINKS: Add at most ONE markdown link in this section, and only when the sentence is about that exact page.\nALLOWED URLS (use one of these exact URLs, or use none):\n${availableLinks
    .slice(0, 3)
    .map(link => `- ${link}`)
    .join(
      '\n'
    )}\nRULES:\n- Never invent, shorten, or rewrite a URL.\n- Never link a domain homepage, a search page, scholar.google.com, google.com, or any Microsoft Docs page.\n- Never link a page that does not match the sentence topic.\n- If none of the allowed URLs fit, add zero links.`
}

export function externalTopicQuery(topic, heading) {
  const subject = String(topic || '')
    .replace(/\s+/g, ' ')
    .trim()
  const headingText = String(heading || '')
    .replace(/^\s*\d+[\).\-\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (
    !headingText ||
    /^(introduction|intro|conclusion|final verdict|faq|frequently asked|key takeaways|buying guide|overview)\b/i.test(
      headingText
    )
  ) {
    return subject.slice(0, 180)
  }

  return `${subject} ${headingText}`.trim().slice(0, 180)
}

export async function prepareExternalLinks({
  automaticExternalLinks,
  externalLinks,
  topic,
  heading,
  articleType
} = {}) {
  if (!automaticExternalLinks) return []

  const strictProduct = articleType === 'amazon-roundup-rewrite'
  const cleanedTopic = cleanRewriteKeyword(topic)
  const fallback = (externalLinks || [])
    .filter(link => isSpecificArticleUrl(link) && !(strictProduct && isResearchLink(link)))
    .slice(0, 4)

  try {
    const fresh = await fetchSerperOutlineData(externalTopicQuery(cleanedTopic, heading), { strictProduct })

    if (fresh?.authorityLinks?.length) return fresh.authorityLinks
  } catch {
    /* use the outline pool */
  }

  if (!fallback.length) return []

  return keepLiveSpecificLinks(fallback.map(link => ({ link })))
}

export function finalizeSectionLinks(text, { linkPool = [], preserve = [] } = {}) {
  const allowed = [...(linkPool || []), ...(preserve || [])].filter(Boolean)

  return removeUnapprovedExternalLinks(text, allowed)
}

const sectionLinkPools = globalThis.__affigenieSectionLinkPools || (globalThis.__affigenieSectionLinkPools = new Map())

export function rememberSectionLinkPool(id, payload) {
  const key = String(id || '')

  if (!key) return

  sectionLinkPools.set(key, {
    linkPool: Array.isArray(payload?.linkPool) ? payload.linkPool : [],
    preserve: Array.isArray(payload?.preserve) ? payload.preserve : [],
    internalLink: payload?.internalLink || null,
    at: Date.now()
  })

  if (sectionLinkPools.size > 200) {
    const oldest = [...sectionLinkPools.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 50)

    oldest.forEach(([poolId]) => sectionLinkPools.delete(poolId))
  }
}

export function takeSectionLinkPool(id) {
  const row = sectionLinkPools.get(String(id || ''))

  if (!row) return { linkPool: [], preserve: [], internalLink: null }

  return { linkPool: row.linkPool || [], preserve: row.preserve || [], internalLink: row.internalLink || null }
}

const sitemapCache = new Map()
const INTERNAL_LINK_CAP = 2
const internalLinkBudgets = globalThis.__affigenieInternalLinkBudgets || (globalThis.__affigenieInternalLinkBudgets = new Map())

const browserHeadersForLinks = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  Connection: 'keep-alive'
}

function internalHost(value) {
  const raw = String(value || '').trim()

  if (!raw) return ''

  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
  }
}

function explicitInternalPage(value) {
  const raw = String(value || '').trim()

  if (!/^https?:\/\//i.test(raw)) return ''

  try {
    const url = new URL(raw)

    if (!url.pathname || url.pathname === '/') return ''

    return url.href
  } catch {
    return ''
  }
}

function normalizeInternalUrl(url) {
  try {
    const parsed = new URL(url)

    parsed.hash = ''
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'].forEach(key =>
      parsed.searchParams.delete(key)
    )

    const path = parsed.pathname.replace(/\/+$/, '') || '/'

    return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${path}${parsed.search}`
  } catch {
    return String(url || '')
      .trim()
      .toLowerCase()
      .replace(/\/+$/, '')
  }
}

function pagePhrase(url) {
  try {
    const slug = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '')

    return slug
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  }
}

function varyInternalAnchor(phrase) {
  const raw = String(phrase || '')
    .replace(/\s+/g, ' ')
    .trim()

  const swaps = [
    [/^(the\s+)?best\b/i, 'top rated'],
    [/^(the\s+)?top rated\b/i, 'highest ranked'],
    [/^(the\s+)?top\b/i, 'leading'],
    [/^(the\s+)?ultimate\b/i, 'complete'],
    [/^(the\s+)?complete\b/i, 'ultimate']
  ]

  for (const [pattern, replacement] of swaps) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement).replace(/\s+/g, ' ').trim()
  }

  if (/\bguide\b/i.test(raw)) return raw.replace(/\bguide\b/i, 'handbook')
  if (/\breview\b/i.test(raw)) return raw.replace(/\breview\b/i, 'breakdown')
  if (/\btips\b/i.test(raw)) return raw.replace(/\btips\b/i, 'advice')

  return `top ${raw}`.replace(/^top top\b/i, 'top')
}

function anchorForInternalUse(url, useIndex) {
  const base = pagePhrase(url) || 'related guide'

  if (useIndex === 0) return base

  const varied = varyInternalAnchor(base)

  if (varied.toLowerCase() === base.toLowerCase()) return `recommended ${base}`

  return varied
}

function scoreInternalUrl(url, heading) {
  const words = String(heading || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)

  const lower = String(url || '').toLowerCase()

  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0)
}

function reserveInternalPage(candidates, heading, inputs) {
  const store = currentGeneration()
  const settings = store.settings || {}
  const articleKey = [
    store.generationId || '',
    settings.type || '',
    settings.generatedTitle || settings.targetKeyword || '',
    inputs.join('|')
  ].join('::')
  const now = Date.now()
  let state = internalLinkBudgets.get(articleKey)

  if (!state || now - state.at > 20 * 60 * 1000) {
    state = { counts: new Map(), at: now }
    internalLinkBudgets.set(articleKey, state)
  }

  state.at = now

  if (internalLinkBudgets.size > 300) {
    const oldest = [...internalLinkBudgets.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 50)

    oldest.forEach(([key]) => internalLinkBudgets.delete(key))
  }

  const ranked = candidates
    .map(url => ({ url, key: normalizeInternalUrl(url), score: scoreInternalUrl(url, heading) }))
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))

  for (const item of ranked) {
    const used = state.counts.get(item.key) || 0

    if (used >= INTERNAL_LINK_CAP) continue

    state.counts.set(item.key, used + 1)

    return { url: item.url, anchor: anchorForInternalUse(item.url, used) }
  }

  return null
}

async function loadDomainPages(domain) {
  let cleanDomain = String(domain || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .replace(/\/$/, '')

  if (!cleanDomain) return []
  if (!cleanDomain.startsWith('www.')) cleanDomain = `www.${cleanDomain}`

  if (sitemapCache.has(cleanDomain)) return sitemapCache.get(cleanDomain)

  const homeUrl = `https://${cleanDomain}`
  let extractedUrls = []
  const sitemapPaths = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml']

  for (const path of sitemapPaths) {
    try {
      const response = await fetch(`${homeUrl}${path}`, {
        headers: browserHeadersForLinks,
        signal: AbortSignal.timeout(6000)
      })

      if (!response.ok) continue

      const xmlText = await response.text()
      let matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)]

      extractedUrls = matches.map(match => match[1])

      const isSitemapIndex = extractedUrls.some(url => url.endsWith('.xml'))

      if (isSitemapIndex) {
        const subSitemaps = extractedUrls.filter(
          url => url.includes('post-sitemap') || url.includes('page-sitemap') || url.includes('wp-sitemap-posts')
        )

        extractedUrls = []

        for (const subMap of subSitemaps) {
          const subResponse = await fetch(subMap, {
            headers: browserHeadersForLinks,
            signal: AbortSignal.timeout(6000)
          })

          if (subResponse.ok) {
            const subXmlText = await subResponse.text()
            const subMatches = [...subXmlText.matchAll(/<loc>(.*?)<\/loc>/g)]

            extractedUrls.push(...subMatches.map(match => match[1]))
          }
        }
      }

      break
    } catch {
      continue
    }
  }

  extractedUrls = extractedUrls.filter(url => {
    if (!url) return false

    try {
      const path = new URL(url).pathname

      return path.length > 1 && !url.endsWith('.xml') && !url.includes('/wp-content/uploads/')
    } catch {
      return false
    }
  })

  extractedUrls = [...new Set(extractedUrls)].slice(0, 100)
  sitemapCache.set(cleanDomain, extractedUrls)

  return extractedUrls
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function stripModelMediaEmbeds(text) {
  return String(text || '')
    .replace(/<div\b[^>]*data-youtube-video[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, '')
}

export function enforceInternalLink(text, selection) {
  let output = String(text || '')
  const hosts = (selection?.hosts || []).map(host => String(host || '').toLowerCase()).filter(Boolean)

  if (!hosts.length) return output

  const isInternal = url => {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase()

      return hosts.some(item => host === item || host.endsWith(`.${item}`))
    } catch {
      return false
    }
  }

  output = output.replace(/(^|[^!])\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (match, lead, label, url) =>
    isInternal(url) ? `${lead}${label}` : match
  )

  output = output.replace(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi, (match, href, href2, href3, inner) => {
    const url = href || href2 || href3 || ''

    return isInternal(url) ? inner : match
  })

  if (!selection?.url || !selection?.anchor) return output

  const linked = `[${selection.anchor}](${selection.url})`
  const phrase = new RegExp(escapeRegExp(selection.anchor), 'i')
  let wrapped = false

  if (phrase.test(output)) {
    output = output.replace(phrase, match => {
      if (wrapped) return match
      wrapped = true

      return linked
    })
  } else {
    const sentence = `For a closer look, see ${linked}.`
    const parts = output.split(/\n\n/)

    if (parts.length > 1) parts.splice(1, 0, sentence)
    else parts.push(sentence)

    output = parts.join('\n\n')
  }

  return output
}

export async function getLinkInstruction(internalLinks, heading, genAI, usedInternalLinks = []) {
  void genAI
  void usedInternalLinks

  const inputs = (internalLinks || []).map(item => String(item || '').trim()).filter(Boolean)

  if (!inputs.length) return { instruction: '', selectedUrl: null }

  const hosts = [...new Set(inputs.map(internalHost).filter(Boolean))]
  const explicit = inputs.map(explicitInternalPage).filter(Boolean)
  let pages = [...explicit]

  for (const host of hosts.slice(0, 4)) {
    const found = await loadDomainPages(host)

    pages.push(...found)
  }

  pages = [...new Set(pages.filter(Boolean))]

  if (!pages.length) {
    hosts.forEach(host => pages.push(`https://${host}`))
  }

  const reserved = reserveInternalPage(pages, heading, inputs)
  const selection = { url: reserved?.url || null, anchor: reserved?.anchor || '', hosts }
  const store = currentGeneration()

  if (store) store.internalLinkSelection = selection

  if (!reserved) {
    return {
      instruction: `\nCRITICAL INTERNAL LINKING: Do NOT add an internal link in this section. Do not link to ${hosts.join(', ')}. Each specific page can appear at most twice in the article, and this section has no remaining slot.`,
      selectedUrl: null
    }
  }

  return {
    instruction: `\nCRITICAL INTERNAL LINKING: Add exactly one Markdown link in this section and no other link to ${hosts.join(', ')}.\nUse this exact anchor text once: [${reserved.anchor}](${reserved.url})\nDo not repeat the URL. Do not reuse this anchor wording. The same page may be linked at most once more, in another section, with different wording.`,
    selectedUrl: reserved.url
  }
}

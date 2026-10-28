import { callLLM } from '../utils/llm'
import { parseJsonSafe } from '../utils/lightLLM'
import { pickRelevantImages, buildBrandedHero, fetchSerperData } from '../utils/helpers'
import { buildCheckPriceButton, escapeHtml, extractAsin, renderResponsiveTable, resolveAffiliateUrl, titleCaseWords } from '../utils/articleHtml'
import { fetchInternalAmazonData } from './amazonRoundUp'

function productLabel(url, index) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const marker = parts.findIndex(part => ['dp', 'gp', 'product', 'item'].includes(part.toLowerCase()))
    const slug = marker > 0 ? parts[marker - 1] : ''
    const name = decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    return name && !/^[A-Z0-9]{10}$/i.test(name) ? name : `Product ${index + 1}`
  } catch {
    return `Product ${index + 1}`
  }
}

export function normalizeComparisonUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : /^(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)(?:\/|$)/i.test(raw)
      ? `https://${raw}`
      : raw

  try {
    const url = new URL(withProto)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function validateProductComparisonUrls(value) {
  const raw = Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
  if (raw.length < 2 || raw.length > 3) return { ok: false, urls: [] }
  const urls = raw.map(normalizeComparisonUrl)
  if (urls.some(url => !url)) return { ok: false, urls: [] }
  return { ok: true, urls }
}

function amazonDomain(url, settings) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return settings.amazonDomain || 'www.amazon.com'
  }
}

function shortProductName(name, index) {
  const cleaned = String(name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(for|with|and|the|a|an|womens|women's|women|mens|men's|men|unisex|kids|kid)\b/gi, ' ')
    .replace(/[^A-Za-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(word => word.length > 1).slice(0, 2)
  const label = titleCaseWords(words.join(' '))
  return label || `Product ${index + 1}`
}

function displayProductName(name, index) {
  let text = String(name || '')
    .replace(/[™®©]/g, ' ')
    .replace(/[…]/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return `Product ${index + 1}`

  const pipe = text.split(/\s*\|\s*/)[0].trim()
  if (pipe.split(/\s+/).length >= 2) text = pipe

  text = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const dashed = text.split(/\s+[–—]\s+|\s+-\s+/)
  if (dashed.length > 1 && dashed[0].trim().split(/\s+/).length >= 3) text = dashed[0].trim()

  const comma = text.split(',')
  if (comma.length > 1 && comma[0].trim().split(/\s+/).length >= 3) text = comma[0].trim()

  const clause = text.match(/^(.*?)\s+\b(?:with|featuring|including|plus|bundled with|comes with)\b/i)
  if (clause && clause[1].trim().split(/\s+/).length >= 3) text = clause[1].trim()

  let words = text.replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length > 7) words = words.slice(0, 7)

  while (words.length > 3 && words.join(' ').length > 58) words.pop()

  const label = titleCaseWords(words.join(' ')).replace(/[,:;.\-–—|]+$/g, '').trim()

  return label || `Product ${index + 1}`
}

function shortFeature(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const first = text.split(/[.;|]/)[0].trim()
  const base = first.length >= 18 ? first : text
  if (base.length <= 88) return base
  const clipped = base.slice(0, 85).replace(/\s+\S*$/, '').trim()
  return clipped || base.slice(0, 85).trim()
}

function labelOf(product, index) {
  const saved = String(product?.displayName || '').trim()
  if (saved) return saved
  return displayProductName(product?.productName, index)
}

function listedFeatures(product, limit = 4) {
  return (Array.isArray(product?.features) ? product.features : []).map(shortFeature).filter(Boolean).slice(0, limit)
}

function countWords(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function asParagraphs(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\n\s*\n/)

  return source.map(item => String(item || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function ensureProse(text, fallback, minWords) {
  const body = asParagraphs(text).join('\n\n')
  const extra = asParagraphs(fallback).join('\n\n')
  if (countWords(body) >= minWords) return body
  if (!body) return extra
  if (!extra) return body
  return `${body}\n\n${extra}`
}

function featureSentences(product, index) {
  const name = labelOf(product, index)
  const features = listedFeatures(product, 5)
  if (!features.length) {
    return `${name} did not come back with a feature list. Missing details stay unknown. They are not treated as a flaw.`
  }

  return features.map(feature => `${name} lists this detail: ${feature}.`).join(' ')
}

function cleanImage(url) {
  return String(url || '').replace(/\._[A-Za-z0-9_]+_\./, '.')
}

function xml(value) {
  return String(value || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}

function wrapLines(value, maxChars) {
  const words = String(value || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''

  words.forEach(word => {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  })

  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function buildComparisonTitle(keyword, products) {
  const exact = String(keyword || '').replace(/\s+/g, ' ').trim()
  if (!exact) return `${products.map(product => product.shortName).join(' vs ')}: Which One You Will Prefer`

  const lower = exact.toLowerCase()
  const lead = lower.startsWith('which one should you buy') ? '' : 'Which One Should You Buy: '
  const tail = lower.endsWith('compared') ? '' : ' Compared'

  return `${lead}${exact}${tail}`.replace(/\s+/g, ' ').trim()
}

const HAPPY_LIMIT_LINES = [
  name =>
    `Based on our research, we could not find a clear limitation for ${name}. Customers are mostly happy with it.`,
  name =>
    `We checked the listing details and outside mentions for ${name} and did not find a drawback worth flagging. Shoppers mostly sound satisfied.`,
  name => `Nothing we could verify marks a real weak spot for ${name}. The comments that do exist lean positive.`,
  name =>
    `A concrete downside for ${name} did not turn up in the sources we reviewed. Buyers who talk about it are largely pleased.`,
  name =>
    `For ${name}, the available information did not surface a meaningful limitation. Most of the reaction we found is favorable.`,
  name =>
    `We looked for a specific complaint about ${name} and came up empty. The overall impression is that customers are content with it.`
]

function happyLimitLine(name, index, keyword) {
  const seed = `${keyword || ''}|${name || ''}`
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), Math.abs(Number(index) || 0))
  const pick = HAPPY_LIMIT_LINES[seed % HAPPY_LIMIT_LINES.length]
  return pick(name)
}

function isRoboticLimit(value) {
  return /didn.?t state any clear limitation|did not state a clear limitation|no clear limitation was (listed|stated)|listing did not state/i.test(
    String(value || '')
  )
}

function isThinFeedback(value) {
  const raw = String(value || '').trim()
  const words = countWords(raw)
  if (words < 50) return true
  if (words < 80 && /not available|not returned|no feedback|did not quote|does not quote|do not guess/i.test(raw)) return true
  return false
}

function noteFromResult(item) {
  if (!item) return ''
  if (typeof item === 'string') return item.replace(/\s+/g, ' ').trim()

  const link = String(item.link || item.url || '').trim()
  if (/scholar\.google|docs\.microsoft|support\.microsoft|google\.com\/search/i.test(link)) return ''

  const title = String(item.title || '').replace(/\s+/g, ' ').trim()
  const snippet = String(item.snippet || item.description || '').replace(/\s+/g, ' ').trim()
  const text = [title, snippet].filter(Boolean).join(': ')
  if (text.length < 24) return ''

  let host = ''
  try {
    host = new URL(link).hostname.replace(/^www\./, '')
  } catch {
    host = ''
  }

  return (host ? `${host} — ${text}` : text).slice(0, 320)
}

async function loadOutsideNotes(product) {
  const name = String(product?.displayName || product?.productName || '').trim()
  if (!name) return []

  const queries = [
    `"${name}" cons OR disadvantages OR complaints OR problems`,
    `"${name}" review youtube OR quora OR reddit OR amazon`
  ]
  const seen = new Set()
  const notes = []

  for (const query of queries) {
    const rows = await fetchSerperData(query).catch(() => [])
    ;(Array.isArray(rows) ? rows : []).forEach(row => {
      const note = noteFromResult(row)
      const key = note.toLowerCase()
      if (!note || seen.has(key)) return
      seen.add(key)
      notes.push(note)
    })
  }

  notes.sort((left, right) => {
    const rank = value => (/amazon\.|youtube|quora|reddit|answers\.com|refseek/i.test(value) ? 0 : 1)
    return rank(left) - rank(right)
  })

  return notes.slice(0, 6)
}

function researchBlock(products) {
  return products
    .map((product, index) => {
      const notes = Array.isArray(product?.researchNotes) ? product.researchNotes : []
      if (!notes.length) return ''
      return `${labelOf(product, index)}:\n${notes.map(note => `- ${note}`).join('\n')}`
    })
    .filter(Boolean)
    .join('\n')
}

function consFromNotes(product) {
  const notes = Array.isArray(product?.researchNotes) ? product.researchNotes : []
  const hit = notes.find(note =>
    /complaint|downside|drawback|difficult|hard to|too heavy|bulky|does not|doesn't|won't fit|issue with|broke|noisy|missing/i.test(note)
  )
  if (!hit) return []

  const text = String(hit)
    .replace(/^[^—]+—\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentence = text.split(/(?<=[.!?])\s+/)[0] || text
  const clipped = sentence.length > 180 ? sentence.slice(0, 170).replace(/\s+\S*$/, '').trim() : sentence
  if (clipped.length < 40) return []

  return [`Outside write-ups mention this limitation: ${clipped}`]
}

function feedbackFallback(product, index) {
  const name = labelOf(product, index)
  const features = listedFeatures(product, 4)
  const notes = (Array.isArray(product?.researchNotes) ? product.researchNotes : [])
    .map(note =>
      String(note || '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(note => note.length > 30)
    .slice(0, 2)
  const parts = []

  if (product?.rating) {
    parts.push(
      `Amazon lists ${name} at ${product.rating}${product.ratingCount ? ` from ${product.ratingCount} ratings` : ''}. That score is a summary, not a stack of quotations, so this article does not invent what individual shoppers wrote. A public rating at that level usually means most buyers felt the product handled the job they expected, with a smaller group wishing one detail had been different.`
    )
  } else if (notes.length) {
    parts.push(
      `Amazon did not return review text for ${name}. Mentions from other write-ups, including video descriptions and Q&A pages, point to these themes: ${notes.map(note => note.slice(0, 160)).join(' ')} Those are paraphrased themes, not direct quotes.`
    )
  } else {
    parts.push(
      `Amazon did not return review text for ${name}, and outside sources did not add a review we could verify. Rather than pretending there is a comment thread, this section reads the published features the way a careful buyer would.`
    )
  }

  if (features.length >= 2) {
    const lead = features.slice(0, -1)
    const last = features[features.length - 1]
    parts.push(
      `On the positive side, ${name} is defined by ${lead.join('; ')}. Those are practical reasons to keep it on the shortlist. The point to read in a constructive way is ${last}. It is not framed here as a failure. It is the trait to match with how you will actually use the product, and buyers who want that trait often treat it as a benefit.`
    )
  } else if (features.length === 1) {
    parts.push(
      `The listing highlights ${features[0]}. That is the strongest confirmed reason to consider ${name}. Any other praise or complaint would be a guess, so it stays out of this comparison.`
    )
  } else {
    parts.push(
      `${name} did not come back with a feature list either. Missing details stay unknown. They are not treated as a flaw, and they are not filled in with invented praise.`
    )
  }

  return parts.join(' ')
}

function readAmazonItems(raw) {
  const data = raw?.data || raw || {}
  const items = data?.searchResult?.items || data?.itemResults?.items || data?.itemsResult?.items || []
  return Array.isArray(items) ? items : []
}

function mapAmazonItem(item, fallbackUrl, domain, settings, index) {
  const asin = String(item?.asin || extractAsin(fallbackUrl) || '').toUpperCase()
  const productName = item?.itemInfo?.title?.displayValue || productLabel(fallbackUrl, index)
  const imageUrl = cleanImage(item?.images?.primary?.large?.url || item?.images?.primary?.medium?.url || '')
  const variants = item?.images?.variants
  const variantEntry = Array.isArray(variants)
    ? variants.find(entry => entry?.large?.url || entry?.medium?.url)
    : null
  let variantImageUrl = cleanImage(
    variantEntry?.large?.url ||
      variantEntry?.medium?.url ||
      (Array.isArray(variants?.large) ? variants.large[0]?.url : variants?.large?.url) ||
      ''
  )
  if (!variantImageUrl || variantImageUrl === imageUrl) variantImageUrl = ''
  const partnerTag = settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''

  return {
    productName,
    shortName: shortProductName(productName, index),
    displayName: displayProductName(productName, index),
    asin,
    amazonUrl: resolveAffiliateUrl({
      url: item?.detailPageURL || fallbackUrl,
      asin,
      domain,
      partnerTag,
      forceTag: settings.amazonTrackingId || ''
    }),
    imageUrl,
    variantImageUrl,
    price: item?.offersV2?.listings?.[0]?.price?.money?.displayAmount || 'See listing',
    rating: item?.customerReviews?.starRating || item?.customerReviews?.rating || null,
    ratingCount: item?.customerReviews?.count || null,
    features: Array.isArray(item?.itemInfo?.features?.displayValues) ? item.itemInfo.features.displayValues : []
  }
}

function findItem(items, asin) {
  const wanted = String(asin || '').toUpperCase()
  if (!wanted) return null
  return (
    items.find(item => String(item?.asin || '').toUpperCase() === wanted) ||
    items.find(item => String(item?.parentASIN || item?.parentAsin || '').toUpperCase() === wanted) ||
    null
  )
}

async function searchItem(entry, domain, settings) {
  const queries = [productLabel(entry.url, entry.index), entry.asin].filter(Boolean)

  for (const keyword of queries) {
    let raw
    try {
      raw = await fetchInternalAmazonData(keyword, { ...settings, asins: undefined, amazonDomain: domain })
    } catch (error) {
      const msg = String(error?.message || error)
      if (/credits|quota|429/i.test(msg)) {
        throw new Error(`Amazon API out of credits while loading product ${entry.index + 1}. Wait and try again.`)
      }
      continue
    }
    const match = findItem(readAmazonItems(raw), entry.asin)
    if (match) return match
  }

  return null
}

async function loadComparisonProducts(urls, settings) {
  const entries = urls.map((url, index) => ({ url, index, asin: extractAsin(url), domain: amazonDomain(url, settings) }))
  const missingAsin = entries.find(entry => !entry.asin)
  if (missingAsin) {
    throw new Error(`Comparison URL ${missingAsin.index + 1} has no Amazon ASIN. Paste the product page link, not a search page.`)
  }

  const products = new Array(urls.length)
  const domains = [...new Set(entries.map(entry => entry.domain))]

  for (const domain of domains) {
    const group = entries.filter(entry => entry.domain === domain)
    let items = []

    try {
      const raw = await fetchInternalAmazonData(group[0].asin, {
        ...settings,
        asins: group.map(entry => entry.asin),
        amazonDomain: domain
      })
      items = readAmazonItems(raw)
    } catch (error) {
      const msg = String(error?.message || error)
      if (/credits|quota|429/i.test(msg)) {
        throw new Error('Amazon API out of credits while loading comparison products. Wait and try again.')
      }
      items = []
    }

    for (const entry of group) {
      let item = findItem(items, entry.asin)
      if (!item) item = await searchItem(entry, domain, settings)
      if (!item) {
        throw new Error(
          `No Amazon product matched comparison URL ${entry.index + 1} (ASIN ${entry.asin}). Check the link and marketplace domain.`
        )
      }
      products[entry.index] = mapAmazonItem(item, entry.url, domain, settings, entry.index)
    }
  }

  return products
}

function collectExtraImages(products, stock) {
  const primaryCount = products.filter(product => product.imageUrl).length
  const cap = Math.max(0, 5 - (1 + primaryCount))
  const extras = []
  const seen = new Set(products.map(product => product.imageUrl).filter(Boolean))

  const push = (url, alt) => {
    if (!url || seen.has(url) || extras.length >= cap) return
    seen.add(url)
    extras.push({ url, alt: alt || 'Product photo' })
  }

  products.forEach(product => push(product.variantImageUrl, product.productName))
  ;(stock || []).forEach(image => push(image?.url, image?.alt || image?.tags || 'Comparison photo'))

  return extras
}

async function loadBuffer(url) {
  if (!url) return null
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

async function buildComparisonHero(products, headline) {
  const sharp = (await import('sharp')).default
  const width = 1200
  const count = products.length
  const titleLines = wrapLines(headline || 'Product Comparison', 42)
  const fontSize = titleLines.length >= 3 ? 30 : titleLines.length === 2 ? 34 : 40
  const lineH = fontSize + 14
  const titleTop = 36
  const imgTop = titleTop + titleLines.length * lineH + 28
  const imgBoxH = 340
  const nameY = imgTop + imgBoxH + 42
  const height = Math.max(720, nameY + 46)
  const side = 48
  const gap = 28
  const vsW = 72
  const colW = Math.floor((width - side * 2 - vsW * (count - 1) - gap * count) / count)
  const white = { r: 255, g: 255, b: 255 }
  const overlays = []

  const buffers = await Promise.all(products.map(product => loadBuffer(product.imageUrl).catch(() => null)))

  for (let index = 0; index < count; index++) {
    const buffer = buffers[index]
    if (!buffer) continue
    const png = await sharp(buffer).resize(colW, imgBoxH, { fit: 'contain', background: white }).png().toBuffer()
    const meta = await sharp(png).metadata()
    const colX = side + index * (colW + gap + vsW)
    overlays.push({
      input: png,
      left: colX + Math.max(0, Math.floor((colW - (meta.width || colW)) / 2)),
      top: imgTop + Math.max(0, Math.floor((imgBoxH - (meta.height || imgBoxH)) / 2))
    })
  }

  const titleSvg = titleLines
    .map((line, index) => {
      const y = titleTop + fontSize + index * lineH
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" fill="#111827" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700">${xml(line)}</text>`
    })
    .join('')
  const names = products
    .map((product, index) => {
      const colX = side + index * (colW + gap + vsW) + colW / 2
      return `<text x="${colX}" y="${nameY}" text-anchor="middle" fill="#374151" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600">${xml(product.shortName)}</text>`
    })
    .join('')
  const vs = products
    .slice(0, -1)
    .map((_, index) => {
      const x = side + (index + 1) * (colW + gap) + index * vsW + vsW / 2
      const y = imgTop + Math.round(imgBoxH / 2)
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="#6b7280" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">Vs</text>`
    })
    .join('')
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="8" height="${height}" fill="#fb923c"/>
    ${titleSvg}
    ${vs}
    ${names}
  </svg>`

  const png = await sharp({
    create: { width, height, channels: 3, background: white }
  })
    .composite([...overlays, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${png.toString('base64')}`
}

export async function generateProductComparisonOutline(body) {
  const settings = body.settings || {}
  const validation = validateProductComparisonUrls(settings.productComparisonUrls)
  if (!validation.ok) throw new Error('Provide two or three valid Amazon product URLs.')

  const products = await loadComparisonProducts(validation.urls, settings)
  const keyword =
    String(body.targetKeyword || settings.targetKeyword || '').trim() || products.map(product => product.shortName).join(' vs ')
  const title = buildComparisonTitle(keyword, products)
  const names = products.map(product => product.displayName).join(', ')

  const [metaResponse, stock, heroResult] = await Promise.all([
    callLLM({
      system: 'Create a concise meta description for a product comparison. Return JSON only and do not invent product facts. Do not rewrite the title.',
      prompt: `Write metaDescription only for a comparison of ${names}. The exact topic phrase is: ${keyword}. The article title is already: ${title}. Do not change that title and do not mention prices. Return JSON {"metaDescription":"..."}.`,
      json: true,
      maxTokens: 300,
      model: settings.model
    }).catch(() => null),
    pickRelevantImages(keyword, keyword, 2).catch(() => []),
    buildComparisonHero(products, title).catch(() => ''),
    Promise.all(
      products.map(async product => {
        product.researchNotes = await loadOutsideNotes(product).catch(() => [])
      })
    )
  ])
  const metadata = parseJsonSafe(metaResponse?.text) || {}
  const extraImages = collectExtraImages(products, stock)
  let heroImage = heroResult || ''

  if (!heroImage) {
    heroImage = await buildBrandedHero({
      title,
      siteName: settings.siteName || settings.clientSite || settings.website || 'AffiGenie',
      backgroundUrl: ''
    }).catch(() => '')
  }

  const productHeadings = products.map((product, index) => ({
    type: 'h2',
    text: `${index + 1}. ${product.displayName}`,
    sectionType: 'product',
    productIndex: index
  }))
  const comparisonData = { products, images: extraImages }
  const outline = [
    { type: 'h2', text: `Introduction to ${keyword}`, sectionType: 'intro' },
    {
      type: 'h2',
      text: 'Quick Look',
      sectionType: 'comparison',
      comparisonData
    },
    ...productHeadings,
    { type: 'h2', text: 'How They Compare', sectionType: 'analysis' },
    { type: 'h2', text: 'Which One Should You Buy', sectionType: 'buyer' },
    { type: 'h2', text: 'Pickup by Situation', sectionType: 'situation' },
    { type: 'h2', text: 'Safety Guidance', sectionType: 'safety' },
    { type: 'h2', text: `Frequently Asked Questions About ${keyword}`, sectionType: 'faq' },
    { type: 'h2', text: `Final Verdict: ${keyword}`, sectionType: 'verdict' }
  ]

  return {
    success: true,
    title,
    metaTitle: keyword.length > 0 && keyword.length <= 60 ? keyword : title,
    metaDescription:
      metadata.metaDescription ||
      `Compare ${names} using listed features, pros, cons, and available Amazon feedback.`.slice(0, 160),
    outline,
    heroImage,
    heroImageId: null,
    heroImageSource: 'comparison-hero',
    comparisonShared: comparisonData
  }
}

function cta(product, settings) {
  return buildCheckPriceButton(product.amazonUrl, {
    language: settings.language,
    asin: product.asin,
    domain: amazonDomain(product.amazonUrl, settings),
    partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
  })
}

async function generateWithOneRetry(prompt, system, json = false, maxTokens = 900, model) {
  let firstError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callLLM({ system, prompt, json, maxTokens, model })
    } catch (error) {
      firstError ||= error
    }
  }
  throw firstError || new Error('Section generation failed.')
}

function plain(value) {
  return escapeHtml(String(value || '').replace(/\s+/g, ' ').trim())
}

function proseBlocks(value) {
  return asParagraphs(value)
    .map(part => `<div>${plain(part)}</div>`)
    .join('\n\n')
}

function productFigure(url, alt) {
  if (!url) return ''
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="width:100%;max-width:480px;height:auto;object-fit:contain;border-radius:12px;margin:18px auto;display:block;background:#ffffff;" />`
}

function bulletList(items) {
  const rows = (Array.isArray(items) ? items : []).map(item => `<li>${plain(item)}</li>`).join('')
  return rows ? `<ul>${rows}</ul>` : '<div>Not listed for this product.</div>'
}

function feedbackFacts(product) {
  if (product.rating) {
    return `Amazon lists a rating of ${product.rating}${product.ratingCount ? ` from ${product.ratingCount} ratings` : ''}. Review quotes were not returned. Do not invent customer quotes. Explain what that score suggests, then use outside notes only as paraphrased themes.`
  }
  return 'Amazon did not return review text or a star rating for this listing. Do not invent reviews, quotes, star ratings, or rating counts. If outside notes exist, paraphrase them. If they do not, discuss the listed features: most as strengths, and one as a constructive tradeoff rather than a defect.'
}

function readProducts(body, outline) {
  return (
    body.shared?.products ||
    body.settings?.comparisonShared?.products ||
    outline.find(item => item?.comparisonData?.products)?.comparisonData?.products ||
    []
  )
}

function comparisonFacts(products) {
  return products.map((product, index) => ({
    name: labelOf(product, index),
    features: listedFeatures(product, 6),
    rating: product.rating || null,
    ratingCount: product.ratingCount || null
  }))
}

function snapshotTable(products) {
  const headers = ['Photo', 'Product', 'Key Features']
  const rows = products.map((product, index) => {
    const name = labelOf(product, index)
    const image = product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(name)}" style="width:140px;max-width:160px;height:auto;object-fit:contain;display:block;margin:0 auto;background:#ffffff;border-radius:8px;" />`
      : '<div>No photo returned</div>'
    const features = listedFeatures(product, 3)
    const featureHtml = features.length
      ? `<ul>${features.map(item => `<li>${plain(item)}</li>`).join('')}</ul>`
      : '<div>No features were returned for this listing.</div>'

    return [image, `<strong>${escapeHtml(name)}</strong>`, featureHtml]
  })

  return renderResponsiveTable({ headers, rows })
}

export async function generateProductComparisonSection(body) {
  const settings = body.settings || {}
  const outline = Array.isArray(body.outlineContext) ? body.outlineContext : []
  const section = outline.find(item => item.text === body.heading) || {}
  const products = readProducts(body, outline)
  if (products.length < 2 || products.length > 3) throw new Error('Product comparison data must contain two or three products.')

  const keyword = body.targetKeyword || settings.targetKeyword || products.map(product => product.shortName).join(' vs ')
  const facts = comparisonFacts(products)
  const names = facts.map(item => item.name)
  const perProductWords = products.length > 2 ? 240 : 300
  const featureNotes = facts.map(item => `${item.name}: ${item.features.join('; ') || 'none returned'}`).join('\n')
  const outsideNotes = researchBlock(products) || 'No outside notes were returned.'
  const voice =
    'Write clear, specific, slightly longer prose for a product comparison. Explain what the details mean for a buyer. Do not invent specifications, prices, star ratings, or customer quotes. Do not paste source URLs. Paraphrase outside notes as themes only.'

  if (section.sectionType === 'intro' || (!section.sectionType && /introduction/i.test(body.heading || ''))) {
    const fallback = [
      `This comparison looks at ${names.join(' and ')} for ${keyword}. The short names below stand in for the long marketplace titles, and the phrase ${keyword} is the topic the rest of the article is built around.`,
      `A photo and a few listed features come first. After that, each product gets a closer description, then a written comparison, a buying recommendation, a situation-by-situation pickup, safety guidance, common questions, and a final verdict. The article stays with details that were actually returned.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write three plain-text paragraphs separated by blank lines, about 190 words total, introducing a comparison of ${names.join(', ')}. Topic, keep this phrase intact if you use it: ${keyword}.
Tell the reader that a short photo-and-features table comes next, followed by a closer look at each product, a descriptive comparison, a section on which one to buy, a pickup by situation, safety guidance, FAQs, and a final verdict.
Use only these short product names. Do not use long marketplace titles. Do not mention prices. Do not invent features, ratings, or review quotes.
Known features:
${featureNotes}
No heading. No table. No bullet list.`,
        voice,
        false,
        900,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 140)) }
  }

  if (section.sectionType === 'product') {
    const index = Number.isInteger(section.productIndex)
      ? section.productIndex
      : products.findIndex((product, productIndex) => {
          const name = labelOf(product, productIndex)
          return body.heading?.includes(product.productName) || (name && body.heading?.includes(name))
        })
    const product = products[index]
    if (!product) throw new Error('This comparison section is missing its product.')

    const name = labelOf(product, index)
    const features = listedFeatures(product, 5)
    const notes = Array.isArray(product.researchNotes) ? product.researchNotes : []
    let data = {}

    try {
      const response = await generateWithOneRetry(
        `Write a detailed section about ${name} for a comparison on "${keyword}".
Return JSON only:
{"overview":["paragraph 1","paragraph 2","paragraph 3"],"pros":["..."],"cons":["..."],"customerFeedback":"..."}
overview must be three paragraphs and about ${perProductWords} words combined. Explain who the product suits and what the listed features mean in normal language.
pros: up to 4 short points, each tied to a listed feature or a supported outside note.
cons: up to 3 short points. Use a listed feature when it shows a real limit, and use the outside notes when they describe a real drawback such as install difficulty, bulk, weight, fit, a missing accessory, or a repeated complaint. Do not invent a con. Return [] only when neither the features nor the notes support one. Never write that the listing did not state a clear limitation.
customerFeedback: one paragraph of about 90 words. If a rating is supplied, explain what that score suggests without inventing quotes. If outside notes mention shopper themes from Amazon, YouTube, Reddit, Quora, or other stores, paraphrase those themes and do not present them as quotations. If rating text and notes are both missing, discuss the listed features instead: treat all but one as strengths, and discuss the remaining feature as a constructive tradeoff the buyer should match to their use, not as a defect.
Do not mention prices. Do not invent specifications. Use the short name "${name}" and never the long marketplace title.
Listed features: ${features.join(' | ') || 'none returned'}.
${feedbackFacts(product)}
Outside notes:
${notes.join('\n') || 'none'}`,
        'Return factual product evaluation JSON only. Do not invent reviews or specifications.',
        true,
        1600,
        settings.model
      )
      data = parseJsonSafe(response.text) || {}
    } catch {
      data = {}
    }

    const overview = ensureProse(
      data.overview,
      [
        `${name} is included in this ${keyword} comparison because it is one of the submitted listings. The description stays with the details that were returned, then explains what those details mean for a buyer.`,
        featureSentences(product, index),
        `Read ${name} against the job you need it to do. A listed feature is a reason to keep it in the running. A missing detail is unknown, not a hidden flaw and not a hidden advantage.`
      ],
      Math.min(180, perProductWords - 30)
    )
    const pros = Array.isArray(data.pros) ? data.pros.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4) : []
    if (!pros.length && features.length) pros.push(...features.slice(0, 3))
    let cons = Array.isArray(data.cons)
      ? data.cons.map(item => String(item || '').trim()).filter(item => item && !isRoboticLimit(item)).slice(0, 3)
      : []
    if (!cons.length) cons = consFromNotes(product)
    const limitsHtml = cons.length ? bulletList(cons) : `<div>${plain(happyLimitLine(name, index, keyword))}</div>`
    const feedback = isThinFeedback(data.customerFeedback) ? feedbackFallback(product, index) : String(data.customerFeedback).trim()

    return {
      success: true,
      text: [
        productFigure(product.imageUrl, name),
        proseBlocks(overview),
        `<div><h4>Listed Features</h4>${features.length ? bulletList(features) : '<div>Feature details were not returned for this listing.</div>'}</div>`,
        `<div><h4>Pros</h4>${pros.length ? bulletList(pros) : '<div>Pros could not be derived from the listed product data.</div>'}</div>`,
        `<div><h4>Limits</h4>${limitsHtml}</div>`,
        `<div><h4>Amazon Customer Feedback</h4><div>${plain(feedback)}</div></div>`,
        `<div>${cta(product, settings)}</div>`
      ].join('\n\n')
    }
  }

  if (section.sectionType === 'comparison' || (!section.sectionType && /quick look/i.test(body.heading || ''))) {
    return {
      success: true,
      text: [
        '<div>Start with the photo, the short name, and a few features Amazon lists for each product. The closer comparison comes after these snapshots.</div>',
        snapshotTable(products)
      ].join('\n\n')
    }
  }

  if (section.sectionType === 'analysis' || (!section.sectionType && /how they compare/i.test(body.heading || ''))) {
    const fallback = [
      `Read next to each other, ${names.join(' and ')} are easier to separate by the features in the table than by their long marketplace titles. This is the part of the ${keyword} comparison that lines those differences up.`,
      facts
        .map(item => `${item.name} is defined here by ${item.features.length ? item.features.slice(0, 4).join(', ') : 'the absence of a returned feature list'}.`)
        .join(' '),
      `The practical difference is which listing names the feature you actually need. A missing detail is unknown, not a hidden advantage. Use the buying section after this one to turn that difference into a choice.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write four plain-text paragraphs separated by blank lines, about 320 words total, comparing ${names.join(', ')} for "${keyword}".
Use only these facts: ${JSON.stringify(facts)}
Outside notes, paraphrase only and do not paste URLs:
${outsideNotes}
Explain how the listed features differ, what each difference means in daily use, and who each product suits. Do not write a table. Do not mention prices. Do not invent specifications, ratings, or review quotes. Use the short names only. No heading and no bullet list.`,
        voice,
        false,
        1200,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 200)) }
  }

  if (section.sectionType === 'buyer' || (!section.sectionType && /which one should you buy/i.test(body.heading || ''))) {
    const fallback = [
      `For ${keyword}, buy the product whose listed features match the job you repeat most often. Do not buy from the marketplace title alone.`,
      facts
        .map(item => `${item.name} is the closer fit when you specifically need ${item.features[0] || 'the details on its listing, which were not fully returned here'}.`)
        .join(' '),
      `If two listings look close, prefer the one that states the feature you cannot compromise on. A detail that was not returned is not a reason to reject a product.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write three plain-text paragraphs separated by blank lines, about 220 words, under the idea "which one you should buy" for ${names.join(', ')}. Topic: ${keyword}.
Use only these facts: ${JSON.stringify(facts)}
Outside notes:
${outsideNotes}
Give a direct recommendation path: who should buy which product, and what to confirm on the listing before purchasing. Do not declare a winner from a missing fact. Do not mention prices. Do not invent specifications or quotes. No heading and no bullet list.`,
        voice,
        false,
        1000,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 150)) }
  }

  if (section.sectionType === 'situation' || (!section.sectionType && /pickup by situation/i.test(body.heading || ''))) {
    const fallback = [
      `Pick by the situation, not by a single score. ${keyword} covers more than one kind of buyer, and the listings are not interchangeable.`,
      facts
        .map((item, index) => {
          const situations = ['everyday use', 'a tighter space or a more specific fit', 'a buyer who wants the extra listed detail']
          return `${item.name} is the pickup for ${situations[index] || 'a buyer whose needs match its listed features'}, because it is tied to ${item.features.slice(0, 2).join(' and ') || 'the short list of details that were returned'}.`
        })
        .join(' '),
      `If your situation is not named by any listing, treat that as a gap in the data. Open the product page and confirm the measurement, compatibility, or limit that matters to you.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write three plain-text paragraphs separated by blank lines, about 220 words, picking ${names.join(', ')} by situation for "${keyword}".
Use only these facts: ${JSON.stringify(facts)}
Outside notes:
${outsideNotes}
Give one concrete situation for each product, such as daily use, a space or fit constraint, or a buyer who needs a specific listed feature. Do not mention prices. Do not invent specifications or quotes. No heading and no bullet list.`,
        voice,
        false,
        1000,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 150)) }
  }

  if (section.sectionType === 'safety' || (!section.sectionType && /safety guidance/i.test(body.heading || ''))) {
    const fallback = [
      `Safety guidance for ${keyword} has to stay inside what the listings actually say. This article does not invent certifications, crash scores, or test-lab results.`,
      facts
        .map(item =>
          item.features.length
            ? `${item.name} publishes these details a buyer should read as use limits, not as marketing: ${item.features.slice(0, 3).join('; ')}.`
            : `${item.name} did not return feature details, so its safety claims cannot be summarized here.`
        )
        .join(' '),
      `Before you buy, confirm the current weight, height, age, or compatibility limits on the Amazon listing, and follow the maker's install instructions. A feature that was not returned is unknown. It is not proof that the product is safer or less safe.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write three plain-text paragraphs separated by blank lines, about 220 words of safety guidance for ${names.join(', ')} on "${keyword}".
Use only these facts: ${JSON.stringify(facts)}
Outside notes:
${outsideNotes}
Explain which listed features relate to safe use, fit, or installation. Tell the reader to confirm current limits on the product page. Do not invent certifications, test scores, recall history, prices, or quotes. If a safety detail was not returned, say it is unknown. No heading and no bullet list.`,
        voice,
        false,
        1000,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 150)) }
  }

  if (section.sectionType === 'faq') {
    let faqs = []

    try {
      const response = await generateWithOneRetry(
        `Write exactly four FAQs about ${names.join(', ')} for "${keyword}". Use only these facts and say when a fact was not returned: ${JSON.stringify(facts)}. Outside notes, paraphrase only: ${outsideNotes}. Each answer should be three or four sentences. Do not mention prices. Do not invent features, ratings, or quotes. Return JSON {faqs:[{question,answer}]}.`,
        'Return factual FAQ JSON only. Do not invent prices, ratings, or features.',
        true,
        1000,
        settings.model
      )
      const parsed = parseJsonSafe(response.text) || {}
      faqs = Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 4) : []
    } catch {
      faqs = []
    }

    if (!faqs.length) {
      faqs = products.slice(0, 2).map((product, index) => {
        const name = labelOf(product, index)
        const features = listedFeatures(product, 3)

        return {
          question: `What is listed for ${name}?`,
          answer: features.length
            ? `${name} lists ${features.join('; ')}. Those are the details returned for this listing.`
            : `Feature details were not returned for ${name}.`
        }
      })
    }

    const html = faqs
      .map(
        faq =>
          `<div><h4>${plain(faq.question || 'Question')}</h4><div>${plain(faq.answer || 'That detail was not returned for these listings.')}</div></div>`
      )
      .join('\n\n')

    return { success: true, text: html }
  }

  if (section.sectionType === 'verdict') {
    let verdict = {}

    try {
      const response = await generateWithOneRetry(
        `Return JSON {verdict,bestFor[]} for these products, based only on the supplied facts. bestFor must have one entry per product, each about 35 words. verdict should be three sentences and about 110 words. Do not mention prices. Do not invent specifications or review quotes. Do not add a buy button or a single product link. Facts: ${JSON.stringify(facts)} Outside notes: ${outsideNotes}`,
        'Return factual final verdict JSON only. Do not invent reviews or specifications.',
        true,
        800,
        settings.model
      )
      verdict = parseJsonSafe(response.text) || {}
    } catch {
      verdict = {}
    }

    const summary =
      verdict.verdict ||
      `Choose the listing whose returned features match what you need from ${keyword}. The sections above already separate who should buy which product, which situation each one fits, and which safety details still need a look at the listing. A missing detail is unknown, not a reason to prefer one product.`
    const lines = products
      .map(
        (product, index) =>
          `<li><strong>${escapeHtml(labelOf(product, index))}:</strong> ${plain(verdict.bestFor?.[index] || 'Match the listed features against the job you need this product to do.')}</li>`
      )
      .join('')

    return {
      success: true,
      text: [proseBlocks(ensureProse(summary, '', 70)), `<ul>${lines}</ul>`].join('\n\n')
    }
  }

  return {
    success: true,
    text: `<div>This section sits outside the comparison structure. The article still opens with an introduction, a short photo-and-features table, a closer look at each product, a descriptive comparison, a buying recommendation, a situation pickup, safety guidance, FAQs, and a final verdict for ${escapeHtml(keyword)}.</div>`
  }
}

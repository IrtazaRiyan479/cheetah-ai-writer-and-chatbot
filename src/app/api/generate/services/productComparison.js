import { callLLM } from '../utils/llm'
import { parseJsonSafe } from '../utils/lightLLM'
import { pickRelevantImages, buildBrandedHero } from '../utils/helpers'
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

async function buildComparisonHero(products) {
  const sharp = (await import('sharp')).default
  const width = 1200
  const height = 675
  const count = products.length
  const side = 48
  const gap = 28
  const vsW = 72
  const colW = Math.floor((width - side * 2 - vsW * (count - 1) - gap * count) / count)
  const imgTop = 148
  const imgBoxH = 360
  const overlays = []

  const buffers = await Promise.all(products.map(product => loadBuffer(product.imageUrl).catch(() => null)))

  for (let index = 0; index < count; index++) {
    const buffer = buffers[index]
    if (!buffer) continue
    const png = await sharp(buffer)
      .resize(colW, imgBoxH, { fit: 'contain', background: { r: 244, g: 245, b: 247 } })
      .png()
      .toBuffer()
    const meta = await sharp(png).metadata()
    const colX = side + index * (colW + gap + vsW)
    overlays.push({
      input: png,
      left: colX + Math.max(0, Math.floor((colW - (meta.width || colW)) / 2)),
      top: imgTop + Math.max(0, Math.floor((imgBoxH - (meta.height || imgBoxH)) / 2))
    })
  }

  const names = products
    .map((product, index) => {
      const colX = side + index * (colW + gap + vsW) + colW / 2
      return `<text x="${colX}" y="590" text-anchor="middle" fill="#6b7280" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600">${xml(product.shortName)}</text>`
    })
    .join('')
  const vs = products
    .slice(0, -1)
    .map((_, index) => {
      const x = side + (index + 1) * (colW + gap) + index * vsW + vsW / 2
      return `<text x="${x}" y="340" text-anchor="middle" fill="#c5c9d1" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">Vs</text>`
    })
    .join('')
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="8" height="${height}" fill="#fb923c"/>
    <rect x="28" y="26" width="34" height="34" rx="7" fill="#fb923c"/>
    <text x="45" y="50" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">vs</text>
    <text x="600" y="78" text-anchor="middle" fill="#9aa0a6" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700">Which One You Will Prefer</text>
    ${vs}
    ${names}
  </svg>`

  const png = await sharp({
    create: { width, height, channels: 3, background: { r: 244, g: 245, b: 247 } }
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
  const names = products.map(product => product.displayName).join(', ')

  const [metaResponse, stock] = await Promise.all([
    callLLM({
      system: 'Create concise SEO metadata for a product comparison. Return JSON only and do not invent product facts.',
      prompt: `Create title, metaTitle, metaDescription for a comparison of ${names}. Topic: ${keyword}. Use these short product names, not long marketplace titles. Do not mention prices. Return JSON.`,
      json: true,
      maxTokens: 400,
      model: settings.model
    }).catch(() => null),
    pickRelevantImages(keyword, keyword, 2).catch(() => [])
  ])
  const metadata = parseJsonSafe(metaResponse?.text) || {}
  const title = metadata.title || `${products.map(product => product.shortName).join(' vs ')}: Which One You Will Prefer`
  const extraImages = collectExtraImages(products, stock)
  let heroImage = ''

  try {
    heroImage = await buildComparisonHero(products)
  } catch {
    heroImage = ''
  }

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
    { type: 'h2', text: `Frequently Asked Questions About ${keyword}`, sectionType: 'faq' },
    { type: 'h2', text: `Final Verdict: ${keyword}`, sectionType: 'verdict' }
  ]

  return {
    success: true,
    title,
    metaTitle: metadata.metaTitle || title.slice(0, 60),
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
    return `Amazon lists a rating of ${product.rating}${product.ratingCount ? ` from ${product.ratingCount} ratings` : ''}. Review quotes were not returned. Do not invent customer quotes.`
  }
  return 'Amazon customer feedback was not returned for this listing. Say that clearly. Do not invent reviews, quotes, star ratings, or rating counts.'
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
  const perProductWords = products.length > 2 ? 160 : 210
  const featureNotes = facts.map(item => `${item.name}: ${item.features.join('; ') || 'none returned'}`).join('\n')

  if (section.sectionType === 'intro' || (!section.sectionType && /introduction/i.test(body.heading || ''))) {
    const fallback = [
      `This comparison looks at ${names.join(' and ')} for ${keyword}. The short names below stand in for the long marketplace titles.`,
      `A photo and a few listed features come first. After that, each product gets a closer description, then a written comparison, common questions, and a final verdict. The article stays with the details Amazon returned.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write two plain-text paragraphs separated by a blank line, about 150 words total, introducing a comparison of ${names.join(', ')}. Topic: ${keyword}.
Tell the reader that a short photo-and-features table comes next, followed by a closer look at each product, a descriptive comparison, FAQs, and a final verdict.
Use only these short product names. Do not use long marketplace titles. Do not mention prices. Do not invent features, ratings, or review quotes.
Known features:
${featureNotes}
No heading. No table. No bullet list.`,
        'Write only the article introduction as plain text.',
        false,
        700,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 110)) }
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
    let data = {}

    try {
      const response = await generateWithOneRetry(
        `Write a detailed section about ${name} for a comparison on "${keyword}".
Return JSON only:
{"overview":["paragraph 1","paragraph 2"],"pros":["..."],"cons":["..."],"customerFeedback":"..."}
overview must be two paragraphs and about ${perProductWords - 40} words combined. Explain who the product suits and what the listed features mean in normal language.
pros: up to 3 short points, each tied to a listed feature.
cons: up to 2 short points, only when a listed feature shows a real limit. Return [] if you cannot support a con.
customerFeedback: two sentences using only the rating note below. Do not invent quotes.
Do not mention prices. Do not invent specifications. Use the short name "${name}" and never the long marketplace title.
Listed features: ${features.join(' | ') || 'none returned'}.
${feedbackFacts(product)}`,
        'Return factual product evaluation JSON only.',
        true,
        1200,
        settings.model
      )
      data = parseJsonSafe(response.text) || {}
    } catch {
      data = {}
    }

    const overview = ensureProse(
      data.overview,
      [
        `${name} is included in this ${keyword} comparison because it is one of the submitted listings. The description stays with the details Amazon returned.`,
        featureSentences(product, index)
      ],
      Math.min(120, perProductWords - 40)
    )
    const pros = Array.isArray(data.pros) ? data.pros.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3) : []
    const cons = Array.isArray(data.cons) ? data.cons.map(item => String(item || '').trim()).filter(Boolean).slice(0, 2) : []
    const feedback =
      data.customerFeedback ||
      (product.rating
        ? `Amazon lists ${name} at ${product.rating}${product.ratingCount ? ` from ${product.ratingCount} ratings` : ''}. Individual review text was not available, so this article does not quote shoppers.`
        : `Amazon customer feedback was not available for ${name}. This article does not guess a rating or invent review quotes.`)

    return {
      success: true,
      text: [
        productFigure(product.imageUrl, name),
        proseBlocks(overview),
        `<div><h4>Listed Features</h4>${features.length ? bulletList(features) : '<div>Feature details were not returned for this listing.</div>'}</div>`,
        `<div><h4>Pros</h4>${pros.length ? bulletList(pros) : '<div>Pros could not be derived from the listed product data.</div>'}</div>`,
        `<div><h4>Limits</h4>${cons.length ? bulletList(cons) : '<div>The listing did not state a clear limitation.</div>'}</div>`,
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
      `Read next to each other, ${names.join(' and ')} are easier to separate by the features in the table than by their long marketplace titles.`,
      facts
        .map(item => `${item.name} is defined here by ${item.features.length ? item.features.slice(0, 3).join(', ') : 'the absence of a returned feature list'}.`)
        .join(' '),
      `Choose by the feature that matters for ${keyword}. The listing that names that feature clearly is the practical fit. A missing detail is unknown, not a hidden advantage.`
    ].join('\n\n')
    let text = ''

    try {
      const response = await generateWithOneRetry(
        `Write three plain-text paragraphs separated by blank lines, about 220 words total, comparing ${names.join(', ')} for "${keyword}".
Use only these facts: ${JSON.stringify(facts)}
Explain how the listed features differ and who each product suits. Do not write a table. Do not mention prices. Do not invent specifications, ratings, or review quotes. Use the short names only. No heading and no bullet list.`,
        'Write a factual descriptive comparison as plain text.',
        false,
        900,
        settings.model
      )
      text = response?.text?.trim() || ''
    } catch {
      text = ''
    }

    return { success: true, text: proseBlocks(ensureProse(text, fallback, 160)) }
  }

  if (section.sectionType === 'faq') {
    let faqs = []

    try {
      const response = await generateWithOneRetry(
        `Write exactly four FAQs about ${names.join(', ')} for "${keyword}". Use only these facts and say when a fact was not returned: ${JSON.stringify(facts)}. Each answer should be two or three sentences. Do not mention prices. Do not invent features, ratings, or quotes. Return JSON {faqs:[{question,answer}]}.`,
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
        `Return JSON {winnerIndex,verdict,bestFor[]} for these products, based only on the supplied facts. winnerIndex is the zero-based index of the stronger listed option, or 0 if the facts do not support a clear winner. bestFor must have one entry per product, each about 25 words. verdict should be two sentences and about 70 words. Do not mention prices. Do not invent specifications or review quotes. ${JSON.stringify(facts)}`,
        'Return factual final verdict JSON only. Do not invent reviews or specifications.',
        true,
        800,
        settings.model
      )
      verdict = parseJsonSafe(response.text) || {}
    } catch {
      verdict = {}
    }

    const winnerIndex = Math.max(0, Math.min(products.length - 1, Number(verdict.winnerIndex) || 0))
    const summary =
      verdict.verdict ||
      `Choose the listing whose returned features match what you need from ${keyword}. A missing detail is unknown, not a reason to prefer one product.`
    const lines = products
      .map(
        (product, index) =>
          `<li><strong>${escapeHtml(labelOf(product, index))}:</strong> ${plain(verdict.bestFor?.[index] || 'Match the listed features against the job you need this product to do.')}</li>`
      )
      .join('')

    return {
      success: true,
      text: [proseBlocks(ensureProse(summary, '', 40)), `<ul>${lines}</ul>`, `<div>${cta(products[winnerIndex], settings)}</div>`].join('\n\n')
    }
  }

  return {
    success: true,
    text: `<div>This section sits outside the comparison structure. The article still opens with an introduction, a short photo-and-features table, a closer look at each product, a descriptive comparison, FAQs, and a final verdict for ${escapeHtml(keyword)}.</div>`
  }
}

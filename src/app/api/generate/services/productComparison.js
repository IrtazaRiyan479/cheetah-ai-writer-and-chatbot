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
  const names = products.map(product => product.productName).join(', ')

  const [metaResponse, stock] = await Promise.all([
    callLLM({
      system: 'Create concise SEO metadata for a product comparison. Return JSON only and do not invent product facts.',
      prompt: `Create title, metaTitle, metaDescription for a comparison of ${names}. Topic: ${keyword}. Return JSON.`,
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
    text: `${index + 1}. ${product.productName}: Features, Pros, Cons and Amazon Customer Feedback`,
    sectionType: 'product',
    productIndex: index
  }))
  const comparisonData = { products, images: extraImages }
  const outline = [
    { type: 'h2', text: `Introduction to ${keyword}`, sectionType: 'intro' },
    ...productHeadings,
    {
      type: 'h2',
      text: `${products.map(product => product.shortName).join(' vs ')}: Comparison`,
      sectionType: 'comparison',
      comparisonData
    },
    { type: 'h2', text: `Frequently Asked Questions About ${keyword}`, sectionType: 'faq' },
    { type: 'h2', text: `Final Verdict: ${keyword}`, sectionType: 'verdict' }
  ]

  return {
    success: true,
    title,
    metaTitle: metadata.metaTitle || title.slice(0, 60),
    metaDescription: metadata.metaDescription || `Compare ${names} using listed features, price, pros, cons, and available Amazon feedback.`,
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

function readExtras(body, outline) {
  return (
    body.shared?.images ||
    body.settings?.comparisonShared?.images ||
    outline.find(item => item?.comparisonData?.images)?.comparisonData?.images ||
    []
  )
}

export async function generateProductComparisonSection(body) {
  const settings = body.settings || {}
  const outline = Array.isArray(body.outlineContext) ? body.outlineContext : []
  const section = outline.find(item => item.text === body.heading) || {}
  const products = readProducts(body, outline)
  if (products.length < 2 || products.length > 3) throw new Error('Product comparison data must contain two or three products.')

  const keyword = body.targetKeyword || settings.targetKeyword || products.map(product => product.shortName).join(' vs ')
  const extras = readExtras(body, outline)
  const introImage = extras.length > 1 ? extras[0] : null
  const comparisonImage = extras.length > 1 ? extras[1] : extras[0] || null
  const facts = products.map(product => ({
    name: product.productName,
    price: product.price,
    features: product.features,
    rating: product.rating,
    ratingCount: product.ratingCount
  }))

  if (section.sectionType === 'intro' || (!section.sectionType && /introduction/i.test(body.heading || ''))) {
    let text = `This comparison looks at ${products.map(product => product.productName).join(', ')} using the details returned for each Amazon listing.`
    try {
      const response = await generateWithOneRetry(
        `Write a concise introduction for ${keyword}. Products: ${products.map(product => product.productName).join(', ')}. Mention that each product is reviewed on features, pros, cons, and available Amazon feedback before the comparison, FAQ, and final verdict. Do not invent prices, ratings, or features.`,
        'Write only the article introduction as plain text.',
        false,
        500,
        settings.model
      )
      if (response?.text?.trim()) text = response.text.trim()
    } catch {
      text = `This comparison looks at ${products.map(product => product.productName).join(', ')}. Each section covers listed features, pros, cons, and available Amazon customer feedback, followed by a side-by-side comparison, FAQs, and a final verdict.`
    }
    return { success: true, text: `${introImage ? productFigure(introImage.url, introImage.alt || keyword) : ''}<div>${plain(text)}</div>` }
  }

  if (section.sectionType === 'product') {
    const index = Number.isInteger(section.productIndex) ? section.productIndex : products.findIndex(product => body.heading?.includes(product.productName))
    const product = products[index]
    if (!product) throw new Error('This comparison section is missing its product.')

    let data = {}
    try {
      const response = await generateWithOneRetry(
        `Evaluate ${product.productName}. Price: ${product.price}. Listed features: ${product.features.join(' | ') || 'none returned'}. ${feedbackFacts(product)} Return JSON with pros[], cons[], customerFeedback, shortVerdict. Pros and cons must come only from those listed features, the price, and the rating fields. customerFeedback must not invent quotes.`,
        'Return factual product evaluation JSON only.',
        true,
        850,
        settings.model
      )
      data = parseJsonSafe(response.text) || {}
    } catch {
      data = {}
    }

    const pros = Array.isArray(data.pros) && data.pros.length ? data.pros : []
    const cons = Array.isArray(data.cons) && data.cons.length ? data.cons : []
    const feedback = data.customerFeedback || (product.rating ? `Amazon lists this product at ${product.rating}${product.ratingCount ? ` from ${product.ratingCount} ratings` : ''}. Individual review text was not available.` : 'Amazon customer feedback was not available for this listing.')
    const verdict = data.shortVerdict || 'Compare the listed features and price with the other products in this article.'
    const rating = product.rating ? `<div><strong>Rating:</strong> ${plain(product.rating)}${product.ratingCount ? ` (${plain(product.ratingCount)} ratings)` : ''}</div>` : ''

    return {
      success: true,
      text: [
        productFigure(product.imageUrl, product.productName),
        `<div><strong>Price:</strong> ${plain(product.price)}</div>`,
        rating,
        '<h4>Features</h4>',
        bulletList(product.features.slice(0, 6)),
        '<h4>Pros</h4>',
        pros.length ? bulletList(pros) : '<div>Pros could not be derived from the listed product data.</div>',
        '<h4>Cons</h4>',
        cons.length ? bulletList(cons) : '<div>Cons could not be derived from the listed product data.</div>',
        '<h4>Amazon Customer Feedback</h4>',
        `<div>${plain(feedback)}</div>`,
        `<div>${plain(verdict)}</div>`,
        `<div>${cta(product, settings)}</div>`
      ].join('')
    }
  }

  if (section.sectionType === 'comparison') {
    let rows = products.map(product => [
      escapeHtml(product.productName),
      plain(product.price),
      plain(product.features.slice(0, 3).join('; ') || 'Not listed'),
      plain(product.rating || 'Not listed'),
      cta(product, settings)
    ])
    try {
      const response = await generateWithOneRetry(
        `Compare these products using only the supplied facts. Return JSON {rows:[{strengths,tradeoffs}]} with one row per product in the same order. ${JSON.stringify(facts)}`,
        'Return factual comparison JSON only.',
        true,
        900,
        settings.model
      )
      const result = parseJsonSafe(response.text) || {}
      rows = products.map((product, index) => {
        const row = result.rows?.[index] || {}
        return [
          escapeHtml(product.productName),
          plain(product.price),
          plain(product.features.slice(0, 3).join('; ') || 'Not listed'),
          plain(row.strengths || product.rating || 'Not listed'),
          plain(row.tradeoffs || 'See listed features'),
          cta(product, settings)
        ]
      })
    } catch {
      rows = products.map(product => [
        escapeHtml(product.productName),
        plain(product.price),
        plain(product.features.slice(0, 3).join('; ') || 'Not listed'),
        plain(product.rating || 'Not listed'),
        'See the product section for listed features.',
        cta(product, settings)
      ])
    }

    const headers = rows[0]?.length === 6 ? ['Product', 'Price', 'Key Features', 'Strengths', 'Tradeoffs', 'Check Price'] : ['Product', 'Price', 'Key Features', 'Rating', 'Check Price']

    return {
      success: true,
      text: `${comparisonImage ? productFigure(comparisonImage.url, comparisonImage.alt || keyword) : ''}<div>This table uses only the product details returned for each listing.</div>${renderResponsiveTable({ headers, rows })}`
    }
  }

  if (section.sectionType === 'faq') {
    let faqs = []
    try {
      const response = await generateWithOneRetry(
        `Write exactly four FAQs about ${products.map(product => product.productName).join(', ')}. Use only these facts and say when a fact was not returned: ${JSON.stringify(facts)}. Return JSON {faqs:[{question,answer}]}.`,
        'Return factual FAQ JSON only. Do not invent prices, ratings, or features.',
        true,
        900,
        settings.model
      )
      const parsed = parseJsonSafe(response.text) || {}
      faqs = Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 4) : []
    } catch {
      faqs = []
    }

    if (!faqs.length) {
      faqs = products.slice(0, 2).map(product => ({
        question: `What is listed for ${product.productName}?`,
        answer: product.features[0] ? `${product.productName} lists: ${product.features.slice(0, 3).join('; ')}.` : `Feature details were not returned for ${product.productName}.`
      }))
    }

    const html = faqs
      .map(faq => `<h4>${plain(faq.question || 'Question')}</h4><div>${plain(faq.answer || 'That detail was not returned for these listings.')}</div>`)
      .join('')

    return { success: true, text: html }
  }

  if (section.sectionType === 'verdict') {
    let verdict = {}
    try {
      const response = await generateWithOneRetry(
        `Return JSON {winnerIndex,verdict,bestFor[]} for these products, based only on the supplied facts. winnerIndex is the zero-based index of the stronger listed option, or 0 if the facts do not support a winner. bestFor must have one entry per product. ${JSON.stringify(facts)}`,
        'Return factual final verdict JSON only. Do not invent reviews or specifications.',
        true,
        700,
        settings.model
      )
      verdict = parseJsonSafe(response.text) || {}
    } catch {
      verdict = {}
    }

    const winnerIndex = Math.max(0, Math.min(products.length - 1, Number(verdict.winnerIndex) || 0))
    const summary = verdict.verdict || 'Choose the product whose listed features and price match what you need. Missing review text should not be treated as a verdict.'
    const lines = products
      .map((product, index) => `<li><strong>${escapeHtml(product.productName)}:</strong> ${plain(verdict.bestFor?.[index] || 'Review the listed features and price.')}</li>`)
      .join('')

    return {
      success: true,
      text: `<div>${plain(summary)}</div><ul>${lines}</ul><div>${cta(products[winnerIndex], settings)}</div>`
    }
  }

  return {
    success: true,
    text: `<div>This section sits outside the comparison structure. The article still covers each product, a comparison table, FAQs, and a final verdict for ${escapeHtml(keyword)}.</div>`
  }
}

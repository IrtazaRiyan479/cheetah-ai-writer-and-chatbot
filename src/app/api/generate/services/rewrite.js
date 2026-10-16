import {
  getLinkInstruction,
  getExternalLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchArticleData,
  fetchUnsplashImage,
  fetchPexelsImage,
  fetchPixabayImage,
  calculateRelevanceScore,
  fetchPeopleAlsoSearchFor,
  generateFallbackImage,
  getMediaInstruction,
  getRealTimeInstruction,
  fetchSerperOutlineData,
  fetchRawArticleHtml,
  pickRelevantImages
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'
import { buildCheckPriceButton, escapeHtml, extractAsin, renderResponsiveTable, renderTopPickCards, rewriteAcceptsSource, rewriteSourceError, withRequiredCheckPrice } from '../utils/articleHtml'
import { fetchInternalAmazonData, formatAmazonProducts } from './amazonRoundUp'

function firstAmazonUrl(text) {
  const match = String(text || '').match(/https?:\/\/(?:www\.)?(?:amazon\.[^\s)"'<>]+|amzn\.to\/[^\s)"'<>]+)/i)

  return match ? match[0].replace(/[.,;]+$/, '') : ''
}

function amazonRewriteOptions(settings, sourceText, extraText = '') {
  const url = firstAmazonUrl(sourceText) || firstAmazonUrl(extraText)
  const asin = extractAsin(url) || extractAsin(sourceText) || extractAsin(extraText)

  return {
    url,
    asin,
    language: settings.language,
    domain: settings.amazonDomain || 'www.amazon.com',
    partnerTag: process.env.AMAZON_PARTNER_TAG || settings.amazonTrackingId || settings.partnerTag || ''
  }
}

function isAmazonRewriteType(type) {
  return type === 'amazon-roundup-rewrite' || type === 'amazon-review-rewrite'
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/</g, '<')
    .replace(/>/g, '>')
}

function imageRank(url) {
  const value = String(url || '')

  if (/sprite|badge|logo|pixel|spinner|transparent|icon/i.test(value)) return -1
  if (/_SS(?:[1-9]\d?|1[0-4]\d)_|_SX(?:[1-9]\d?|1[0-4]\d)_|_SY(?:[1-9]\d?|1[0-4]\d)_/i.test(value)) return 1

  const size = value.match(/_(?:SL|SX|SY|SS|AC_SX|AC_SY|AC_SL)(\d+)/i)

  return size ? Number(size[1]) : 400
}

function addAmazonImage(found, raw) {
  let url = decodeHtml(raw).trim().replace(/\\u0026/g, '&')

  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:/i.test(url)) return
  if (!/(?:m\.media-amazon\.com|images-amazon\.com|ssl-images-amazon\.com)/i.test(url)) return
  if (imageRank(url) < 80) return
  if (!found.includes(url)) found.push(url)
}

function extractAmazonImages(html) {
  const found = []
  const source = String(html || '')
  const tagRe = /<img\b[^>]*>/gi
  let tag

  while ((tag = tagRe.exec(source))) {
    const el = tag[0]
    const srcset = el.match(/\bsrcset=["']([^"']+)["']/i)

    if (srcset) {
      const best = srcset[1]
        .split(',')
        .map(part => {
          const bits = part.trim().split(/\s+/)
          const width = Number(String(bits[1] || '').replace(/[^\d]/g, '')) || 0

          return { url: bits[0], width }
        })
        .sort((a, b) => b.width - a.width)[0]

      if (best?.url) addAmazonImage(found, best.url)
    }

    const src = el.match(/\b(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/i)

    if (src) addAmazonImage(found, src[1])
  }

  const bare = source.match(/https?:\/\/[^\s"'<>]+(?:m\.media-amazon|images-amazon|ssl-images-amazon)[^\s"'<>]*/gi) || []

  bare.forEach(url => addAmazonImage(found, url))

  return found
}

function extractAsins(text) {
  const ids = []
  const source = String(text || '')
  const re = /(?:dp|gp\/product|gp\/aw\/d|ASIN|product)\/([A-Z0-9]{10})(?=[/?&#\s"'<]|$)|data-asin=["']([A-Z0-9]{10})["']/gi
  let match

  while ((match = re.exec(source))) {
    const asin = String(match[1] || match[2] || '').toUpperCase()

    if (/^[A-Z0-9]{10}$/.test(asin) && !ids.includes(asin)) ids.push(asin)
  }

  return ids
}

function orderProducts(products, asins) {
  const byAsin = new Map((products || []).map(product => [String(product?.asin || '').toUpperCase(), product]))
  const ordered = (asins || []).map(asin => byAsin.get(String(asin).toUpperCase())).filter(Boolean)

  return ordered.length ? ordered : products || []
}

function productImageHtml(product, keyword) {
  const src = String(product?.imageUrl || '').trim()

  if (!/^https?:/i.test(src)) return ''

  const alt = escapeHtml(`${keyword || ''} ${product.productName || 'Product'}`.trim())
  const title = escapeHtml(product.productName || keyword || 'Product')

  return `<div align="center" style="margin: 25px 0;"><img src="${escapeHtml(src)}" alt="${alt}" title="${title}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.05);" /></div>`
}

function stripStockMedia(text) {
  return String(text || '')
    .replace(/<img\b[^>]*src=["'][^"']*(?:images\.pexels\.com|images\.unsplash\.com|pixabay\.com|cdn\.pixabay)[^"']*["'][^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\((https?:\/\/[^)]*(?:pexels|pixabay|unsplash)[^)]*)\)/gi, '')
    .replace(/<iframe\b[^>]*youtube[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/gi, '')
}

function insertAfterFirstBlock(body, snippet) {
  if (!snippet) return body

  const source = String(body || '')
  const marker = snippet.slice(0, 80)

  if (marker && source.includes(marker)) return source

  const parts = source.split(/\n\n+/)

  if (parts.length > 1) return [parts[0], snippet, ...parts.slice(1)].join('\n\n')

  return `${source}\n\n${snippet}`
}

async function loadRewriteProducts(settings, sourceText, rawHtml) {
  const blob = `${rawHtml || ''}\n${sourceText || ''}`
  const limit =
    settings.type === 'amazon-review-rewrite' ? 1 : Math.max(1, Math.min(10, Number(settings.numberOfProducts) || 5))
  const asins = extractAsins(blob).slice(0, 10)
  const scraped = extractAmazonImages(blob)
  const lookupAsins = asins.slice(0, limit)
  let products = []

  try {
    if (lookupAsins.length) {
      const apiData = await fetchInternalAmazonData(settings.targetKeyword || lookupAsins[0], {
        ...settings,
        asins: lookupAsins,
        numberOfProducts: lookupAsins.length
      })

      products = orderProducts(
        formatAmazonProducts(apiData, { ...settings, numberOfProducts: lookupAsins.length }),
        lookupAsins
      )
    } else if (settings.amazonProductUrl || settings.targetKeyword) {
      const keyword =
        settings.type === 'amazon-review-rewrite'
          ? extractAsin(settings.amazonProductUrl) || settings.targetKeyword
          : settings.targetKeyword

      if (keyword) {
        const apiData = await fetchInternalAmazonData(keyword, { ...settings, numberOfProducts: limit })

        products = formatAmazonProducts(apiData, { ...settings, numberOfProducts: limit })
      }
    }
  } catch (error) {
    console.warn('[amazon-rewrite] product image lookup failed:', error?.message || error)
  }

  if (!products.length) {
    const seeds = lookupAsins.length ? lookupAsins : scraped.slice(0, limit).map(() => '')

    products = seeds.slice(0, limit).map((asin, index) => ({
      productName: '',
      asin: asin || '',
      amazonUrl: '',
      imageUrl: scraped[index] || '',
      price: '',
      features: []
    }))
  }

  let imageCursor = 0

  products = products.slice(0, limit).map(product => {
    if (product.imageUrl && imageRank(product.imageUrl) >= 80) return product

    const imageUrl = scraped[imageCursor] || scraped[0] || product.imageUrl || ''

    imageCursor += 1

    return { ...product, imageUrl }
  }).filter(product => product.imageUrl || product.asin || product.productName)

  const productImages = [...new Set([...products.map(product => product.imageUrl), ...scraped].filter(Boolean))]

  return { products, productImages }
}

function attachProductsToOutline(outline, products) {
  if (!Array.isArray(outline)) return outline

  const used = new Set()

  return outline.map(item => {
    const text = String(item?.text || '')
    const clean = text.replace(/^\d+\.\s*/, '').toLowerCase().trim()
    const numbered = /^\d+\.\s+/.test(text)
    const looksProduct = item?.sectionType === 'product' || numbered

    if (!looksProduct) return item

    let product = products.find((entry, index) => {
      if (used.has(index)) return false

      const name = String(entry.productName || '').toLowerCase()

      if (!name || !clean) return false

      return clean.includes(name.slice(0, 48)) || name.includes(clean.slice(0, 48))
    })

    if (!product) {
      const number = text.match(/^(\d+)\./)
      const index = number ? Number(number[1]) - 1 : products.findIndex((_, itemIndex) => !used.has(itemIndex))

      if (products[index] && !used.has(index)) product = products[index]
    }

    if (!product) return { ...item, sectionType: 'product' }

    used.add(products.indexOf(product))

    return {
      ...item,
      sectionType: 'product',
      productData: {
        productName: product.productName,
        amazonUrl: product.amazonUrl,
        imageUrl: product.imageUrl,
        price: product.price,
        asin: product.asin
      }
    }
  })
}

function matchRewriteProduct(heading, outlineContext, products) {
  const outlineItem = (outlineContext || []).find(item => item?.text === heading && item?.productData)
  const fromOutline = outlineItem?.productData

  if (fromOutline?.imageUrl || fromOutline?.asin) return fromOutline

  const clean = String(heading || '').replace(/^\d+\.\s*/, '').toLowerCase().trim()
  const named = (products || []).find(product => {
    const name = String(product.productName || '').toLowerCase()

    if (!name || !clean) return false

    return clean.includes(name.slice(0, 48)) || name.includes(clean.slice(0, 48))
  })

  if (named?.imageUrl) return named

  const number = String(heading || '').match(/^(\d+)\./)

  if (number && products[Number(number[1]) - 1]?.imageUrl) return products[Number(number[1]) - 1]

  let productCursor = 0

  for (const item of outlineContext || []) {
    const isProduct = item?.sectionType === 'product' || item?.productData?.imageUrl || /^\d+\.\s+/.test(item?.text || '')

    if (!isProduct) continue

    if (item.text === heading) return products[productCursor] || item.productData || null

    productCursor += 1
  }

  return null
}

function mergeRewriteProduct(primary, fallback) {
  const next = { ...(fallback || {}) }
  const incoming = primary || {}

  for (const key of ['productName', 'asin', 'amazonUrl', 'imageUrl', 'price']) {
    if (incoming[key]) next[key] = incoming[key]
  }

  if (Array.isArray(incoming.features) && incoming.features.length) next.features = incoming.features
  else if (!Array.isArray(next.features)) next.features = []

  return next
}

function reviewProductFromOutline(outlineContext) {
  const items = Array.isArray(outlineContext) ? outlineContext : []
  const withData = items.find(
    item =>
      item?.productData &&
      (item.productData.imageUrl || item.productData.asin || item.productData.amazonUrl || item.productData.productName)
  )

  return withData?.productData || null
}

function groupRewriteOutline(outline) {
  const groups = []

  for (const item of Array.isArray(outline) ? outline : []) {
    if (!item || typeof item !== 'object') continue

    const type = item.type || 'h2'

    if (type === 'h3' && groups.length) {
      groups[groups.length - 1].children.push({ ...item, type: 'h3' })
    } else {
      groups.push({ item: { ...item, type: 'h2' }, children: [] })
    }
  }

  return groups
}

function flattenRewriteGroups(groups) {
  return groups.flatMap(group => [group.item, ...group.children])
}

function classifyReviewRewriteSection(text, index) {
  const value = String(text || '')

  if (index === 0) return 'intro'
  if (/faq|frequently asked/i.test(value)) return 'faq'
  if (/pros|cons/i.test(value)) return 'pros_cons'
  if (/conclusion|verdict|final thoughts|final verdict|wrap-up|wrapping up/i.test(value)) return 'conclusion'

  return 'features'
}

function normalizeAmazonReviewRewriteOutline(outline, settings, product) {
  const keyword = settings.targetKeyword || product?.productName || ''
  let groups = groupRewriteOutline(outline).map((group, index) => {
    let sectionType = classifyReviewRewriteSection(group.item.text, index)

    if (sectionType === 'faq' && !settings.includeFaq) sectionType = 'features'

    return { ...group, item: { ...group.item, sectionType } }
  })

  const ensureKeyword = text => {
    const value = String(text || '').trim()

    if (!keyword || value.toLowerCase().includes(String(keyword).toLowerCase())) return value || keyword

    return value ? `${value}: ${keyword}` : keyword
  }

  if (!groups.length || groups[0].item.sectionType !== 'intro') {
    groups.unshift({
      item: { type: 'h2', text: ensureKeyword(`Introduction to ${keyword || 'This Product'}`), sectionType: 'intro' },
      children: []
    })
  } else {
    groups[0] = { ...groups[0], item: { ...groups[0].item, sectionType: 'intro', text: ensureKeyword(groups[0].item.text) } }
  }

  groups = groups.map((group, index) => {
    if (index === 0) return group

    const sectionType = group.item.sectionType

    if (sectionType === 'pros_cons' || sectionType === 'conclusion' || sectionType === 'faq') return group

    return { ...group, item: { ...group.item, sectionType: 'features' } }
  })

  const featureDefaults = [
    `Key Features of ${keyword || 'This Product'}`,
    `Real-World Performance of ${keyword || 'This Product'}`
  ]
  let featureCount = groups.filter(group => group.item.sectionType === 'features').length
  let insertAt = 1

  while (featureCount < 2) {
    groups.splice(insertAt, 0, {
      item: { type: 'h2', text: featureDefaults[featureCount] || `Feature ${featureCount + 1}`, sectionType: 'features' },
      children: []
    })
    featureCount += 1
    insertAt += 1
  }

  const keepOne = (sectionType, fallbackText) => {
    const matches = groups.filter(group => group.item.sectionType === sectionType)

    if (!matches.length) {
      const faqIndex = groups.findIndex(group => group.item.sectionType === 'faq')
      const conclusionIndex = groups.findIndex(group => group.item.sectionType === 'conclusion')
      const at =
        sectionType === 'pros_cons'
          ? conclusionIndex >= 0
            ? conclusionIndex
            : faqIndex >= 0
              ? faqIndex
              : groups.length
          : sectionType === 'conclusion'
            ? faqIndex >= 0
              ? faqIndex
              : groups.length
            : groups.length

      groups.splice(at, 0, { item: { type: 'h2', text: fallbackText, sectionType }, children: [] })

      return
    }

    let seen = false

    groups = groups.map(group => {
      if (group.item.sectionType !== sectionType) return group
      if (!seen) {
        seen = true

        return group
      }

      return { ...group, item: { ...group.item, sectionType: 'features' } }
    })
  }

  keepOne('pros_cons', `Pros and Cons of ${keyword || 'This Product'}`)
  keepOne('conclusion', ensureKeyword(`Final Verdict on ${keyword || 'This Product'}`))

  if (settings.includeFaq) keepOne('faq', 'Frequently Asked Questions')
  else {
    groups = groups.map(group =>
      group.item.sectionType === 'faq' ? { ...group, item: { ...group.item, sectionType: 'features' } } : group
    )
  }

  const order = { intro: 0, features: 1, pros_cons: 2, conclusion: 3, faq: 4 }

  groups.sort((a, b) => (order[a.item.sectionType] ?? 1) - (order[b.item.sectionType] ?? 1))

  const conclusion = groups.find(group => group.item.sectionType === 'conclusion')

  if (conclusion) conclusion.item.text = ensureKeyword(conclusion.item.text)

  if (groups[0] && product) {
    groups[0].item.productData = {
      productName: product.productName || '',
      amazonUrl: product.amazonUrl || '',
      imageUrl: product.imageUrl || '',
      price: product.price || '',
      asin: product.asin || '',
      features: Array.isArray(product.features) ? product.features : []
    }
  }

  return flattenRewriteGroups(groups)
}

function amazonReviewRewriteOutlineDirective(settings, product, faqInstruction, relatedInstruction) {
  const condensed = Boolean(settings.condensedMode || settings.enableCondensedMode)
  const keyword = settings.targetKeyword || product?.productName || 'this product'
  const featureNote = product?.features?.length
    ? `Ground feature headings in these listing features when the source covers them: ${product.features.slice(0, 8).join(' | ')}.`
    : 'Ground feature headings in the source article.'

  return `LENGTH CONTROL: Ignore generic blog length presets. Use the Amazon Single Product Review layout.
    TASK:
    1. Read the SOURCE ARTICLE and keep its facts, product, and affiliate URL. Rewrite the structure. Do not copy sentences.
    2. ${faqInstruction || (settings.includeFaq ? 'Include one FAQ H2.' : 'Do not include an FAQ section.')}
    3. ${relatedInstruction || 'Do not add unrelated topics.'}
    4. AMAZON SINGLE PRODUCT REVIEW LAYOUT (required, same order as a new Amazon Single Product Review):
       - Every outline object needs "sectionType": "intro", "features", "pros_cons", "conclusion"${settings.includeFaq ? ', or "faq"' : ''}.
       - 1) The first item is an H2 with sectionType "intro" and its text contains "${keyword}".
       - 2) Next, 2 or 3 H2s with sectionType "features". ${condensed ? 'Do not add H3s.' : 'Add descriptive H3s under those feature H2s, taken from the source.'}
       - 3) One H2 with sectionType "pros_cons".
       - 4) One H2 with sectionType "conclusion" whose text contains "${keyword}".
       - 5) ${settings.includeFaq ? 'The last H2 is exactly "Frequently Asked Questions" with sectionType "faq".' : 'Do not add an FAQ heading.'}
       ${condensed ? '- CONDENSED MODE: essential H2s only. No filler.' : '- FULL REVIEW MODE: deep single-product review. Cover specifications, real-world performance, and durability when the source supports them. Target the same depth as a full Amazon single-product review without inventing a second product.'}
       ${settings.enableFirstHandExperience ? '- FIRST-HAND EXPERIENCE: headings must reflect personal testing, such as "My Experience With..." or "How I Tested It".' : ''}
       - ${featureNote}
       - Product: ${product?.productName || keyword}. Price: ${product?.price || 'from the source'}. Affiliate URL: ${product?.amazonUrl || 'preserve the source URL'}.
       - Do not create a product roundup, numbered multi-product list, competitor roundup table, or Top Pick section.
       - The product image and Check Price button are inserted by the system. Do not request stock photos in the outline.`
}

function amazonReviewLinkOptions(settings, product) {
  return {
    language: settings.language,
    asin: product?.asin,
    domain: settings.amazonDomain || 'www.amazon.com',
    partnerTag: settings.amazonTrackingId || settings.partnerTag || process.env.AMAZON_PARTNER_TAG || 'babiescarrier-20'
  }
}

function amazonReviewImageHtml(product, keyword) {
  const src = String(product?.imageUrl || '').trim()

  if (!/^https?:/i.test(src)) return ''

  const alt = escapeHtml(product?.productName || keyword || 'Product')

  return `<div align="center" style="margin:20px 0;"><img src="${escapeHtml(src)}" alt="${alt}" style="max-width:420px;width:100%;height:auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></div>`
}

function resolveAmazonReviewSectionType(heading, sectionIndex, outlineContext) {
  const outlineItem = (Array.isArray(outlineContext) ? outlineContext : []).find(item => item?.text === heading)
  let sectionType = outlineItem?.sectionType || ''

  if (!sectionType) {
    if (Number(sectionIndex) === 0 || /^introduction\b/i.test(heading || '')) sectionType = 'intro'
    else if (/pros|cons/i.test(heading || '')) sectionType = 'pros_cons'
    else if (/faq|frequently asked/i.test(heading || '')) sectionType = 'faq'
    else if (/conclusion|verdict|final/i.test(heading || '')) sectionType = 'conclusion'
    else sectionType = 'features'
  }

  if (sectionType === 'standard' || sectionType === 'product') {
    sectionType = Number(sectionIndex) === 0 ? 'intro' : 'features'
  }

  return sectionType
}

function amazonReviewRewriteSectionDirective({
  sectionType,
  heading,
  product,
  priceButton,
  productImageHtml,
  settings,
  subheadings,
  targetKeyword
}) {
  const condensed = Boolean(settings.condensedMode || settings.enableCondensedMode)
  const activeKeyword = targetKeyword || product?.productName || 'this product'
  const cta = priceButton
    ? `<div class="affigenie-cta" style="display:block;width:100%;max-width:100%;text-align:center;margin:25px 0;">\n${priceButton}\n</div>`
    : ''
  const productContext = product
    ? `PRODUCT CONTEXT (do not invent a different product, price, or name):
      - Product Name: ${product.productName || activeKeyword}
      - Price: ${product.price || 'Check Amazon'}
      - Core Features: ${product.features?.length ? product.features.join(' | ') : 'Use only features present in the source article.'}
      - Affiliate URL: ${product.amazonUrl || ''}`
    : ''
  const shared = `
    AMAZON SINGLE PRODUCT REVIEW LAYOUT for sectionType "${sectionType}":
    Rewrite this part of the source in the same layout used by Amazon Single Product Review. One product only.
    No roundup table, no Top Pick cards, and no list of competing products.
    ${condensed ? 'CONDENSED MODE: paragraphs of 1-3 sentences. No fluff.' : 'Write detailed paragraphs. Do not leave the space under the heading blank.'}
    ${settings.enableFirstHandExperience ? 'Write in first person as someone who tested this product. Use only experiences supported by the source.' : 'Write as an objective product reviewer. Do not invent hands-on tests that are not in the source.'}
    Do NOT repeat the heading "${heading}" in the body.
    ${productContext}
  `

  if (sectionType === 'intro') {
    return `${shared}
      TASK: Write the introduction of this single-product review, rewritten from the source.
      STRICT LAYOUT:
      1. Write 2-3 intro paragraphs.
      2. Then insert this product image HTML exactly:
      ${productImageHtml || '[no product image]'}
      3. ${cta ? `Then insert this EXACT CTA HTML. Do not change the link or the label:\n${cta}` : 'Do not invent a purchase button.'}
    `
  }

  if (sectionType === 'pros_cons') {
    return `${shared}
      TASK: Rewrite the pros and cons of this single product.
      STRICT LAYOUT: Use one Markdown table with exactly two columns, "Pros" and "Cons". Do not use H3 headings and do not use a multi-product table.
    `
  }

  if (sectionType === 'conclusion') {
    return `${shared}
      TASK: Write the final verdict, rewritten from the source.
      ${cta ? `STRICT LAYOUT: End with this EXACT HTML block. Do not change the link or the label:\n${cta}` : ''}
    `
  }

  if (sectionType === 'faq') {
    return `${shared}
      TASK: Rewrite 3 to 5 questions about this product as an FAQ.
      ${subheadings?.length ? `Use these questions as H3s:\n${subheadings.join('\n')}` : ''}
      STRICT LAYOUT: After the answers, add FAQPage JSON-LD inside a <script type="application/ld+json"> tag. Do not wrap that script in a markdown code fence.
    `
  }

  return `${shared}
    TASK: Rewrite this feature analysis from the source. Start with paragraphs only.
    ${subheadings?.length ? `Cover these subheadings exactly as H3s:\n${subheadings.map(item => `### ${item}`).join('\n')}` : 'Use H3s only for subpoints already in the outline.'}
  `
}

export function detectSourceArticleType(htmlOrText = '') {
  const source = String(htmlOrText || '')
  const marker =
    source.match(/data-affigenie-type=["']([a-z0-9-]+)["']/i) ||
    source.match(/affigenie-article-type:([a-z0-9-]+)/i)

  return marker?.[1] ? marker[1].toLowerCase() : ''
}

function assertRewriteSource(writerType, detectedType) {
  if (rewriteAcceptsSource(writerType, detectedType)) return

  const error = new Error(rewriteSourceError(writerType))

  error.code = 'ARTICLE_TYPE'
  throw error
}

function lengthInstruction(articleLength, customSectionCount) {
  const map = {
    shorter: 'Keep the rewritten article short: about 2-3 H2 sections total.',
    short: 'Keep the rewritten article short: about 3-5 H2 sections total.',
    medium: 'Aim for a medium article: about 5-7 H2 sections total.',
    long: 'Write a long-form rewrite: about 7-10 H2 sections total.',
    longer: 'Write a longer rewrite: about 10-12 H2 sections total.',
    custom: `Use exactly ${Math.max(2, Math.min(20, Number(customSectionCount) || 6))} H2 sections in the outline.`,
    default: 'Match the source article depth; prefer 5-8 H2 sections unless the source is clearly shorter or longer.'
  }
  return map[articleLength] || map.default
}

export async function generateRewriteOutline(body, genAI) {
  const { prompt, settings } = body

  const {
    model,
    targetKeyword,
    language,
    country,
    automaticExternalLinks,
    includeFaq,
    includeKeyTakeaways,
    articleUrlToRewrite
  } = settings

  const [articleData, rawHtml] = await Promise.all([
    fetchArticleData(articleUrlToRewrite),
    fetchRawArticleHtml(articleUrlToRewrite)
  ])

  if (!articleData.success) {
    throw new Error('Failed to fetch the target article. Please check the URL and try again.')
  }

  const sourceText = articleData.text || ''
  const detectedType = detectSourceArticleType(`${rawHtml}\n${sourceText}`)

  assertRewriteSource(settings.type, detectedType)

  const amazonRewrite = isAmazonRewriteType(settings.type)
  const loadedProducts = amazonRewrite
    ? await loadRewriteProducts(settings, sourceText, rawHtml)
    : { products: [], productImages: [] }
  const rewriteProducts = loadedProducts.products || []
  const productListString = rewriteProducts
    .map(
      (product, index) =>
        `${index + 1}. ${product.productName || product.asin || 'Amazon product'}\n   URL: ${product.amazonUrl || ''}\n   Image: ${product.imageUrl || ''}`
    )
    .join('\n\n')

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const reviewKeyword = targetKeyword || rewriteProducts[0]?.productName || 'main topic'
  const reviewSchemaNote =
    settings.type === 'amazon-review-rewrite'
      ? ` Each outline object MUST also include "sectionType" set to "intro", "features", "pros_cons", "conclusion"${includeFaq ? ', or "faq"' : ''}. This rewrite MUST use the Amazon Single Product Review layout, not a roundup or a generic blog outline.`
      : ''
  const outlineKeyword = settings.type === 'amazon-review-rewrite' ? reviewKeyword : targetKeyword || 'main topic'

  const closingRule =
    settings.type === 'amazon-review-rewrite' && includeFaq
      ? `- The conclusion H2 must contain the exact target keyword: "${outlineKeyword}". The final H2 must be "Frequently Asked Questions".`
      : `- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${outlineKeyword}" in its "text" field.`

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline based on the provided SOURCE ARTICLE. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, rewritten H1 Title) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title", "outline": [{ "type": "h2", "text": "Heading text", "sectionType": "intro" }] }${reviewSchemaNote}\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${outlineKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${outlineKeyword}" in its "text" field.\n${closingRule}`
  })

  let fetchedExternalLinks = []
  let faqInstruction = ''
  let relatedInstruction = ''
  let takeawaysInstruction = ''

  if (automaticExternalLinks || includeFaq) {
    const outlineData = await fetchSerperOutlineData(targetKeyword)

    if (automaticExternalLinks) {
      fetchedExternalLinks = outlineData.authorityLinks
    }

    if (includeFaq) {
      if (outlineData.faqs.length > 0) {
        faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled exactly "Frequently Asked Questions". Under this H2, you MUST nest exactly these questions directly from Google as H3 subheadings:\n${outlineData.faqs
          .slice(0, 5)
          .map(q => `- ${q}`)
          .join('\n')}`
      } else {
        faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled "Frequently Asked Questions" and nest 3-5 highly relevant questions as H3 subheadings.`
      }
    }

    if (outlineData.related.length > 0) {
      relatedInstruction = `\nSEO OPTIMIZATION: Naturally incorporate topics from these related Google searches into your H2 and H3 headings where relevant: ${outlineData.related.slice(0, 5).join(', ')}.`
    }
  }

  if (includeKeyTakeaways) {
    takeawaysInstruction = `\nCRITICAL REQUIREMENT - KEY TAKEAWAYS: The second H2 heading (immediately after the Introduction) MUST be titled exactly "Key Takeaways". Do NOT nest any H3 subheadings under it.`
  }

  const keywordInstruction = targetKeyword
    ? `Ensure the outline is optimized for the target keyword: "${targetKeyword}".`
    : `Extract the main topic/keyword from the source article and optimize the outline around it.`

  const outlinePrompt = `
    SOURCE ARTICLE URL: ${articleUrlToRewrite}
    ${keywordInstruction}
    Include FAQ: ${includeFaq ? 'Yes' : 'No'}
    Include Key Takeaways: ${includeKeyTakeaways ? 'Yes' : 'No'}

    SOURCE ARTICLE CONTENT (MARKDOWN FORMAT):
    ${sourceText ? sourceText.substring(0, 180000) : 'No content provided.'}

    ${
      settings.type === 'amazon-review-rewrite'
        ? amazonReviewRewriteOutlineDirective(settings, rewriteProducts[0], faqInstruction, relatedInstruction)
        : `LENGTH CONTROL: ${lengthInstruction(settings.articleLength, settings.customSectionCount)}

    TASK:
    1. Extract the core concepts, topics, and structure of the SOURCE ARTICLE CONTENT below. Ground every heading in that content.
    2. Create a comprehensive, REWRITTEN outline (H2s and H3s) that covers the same information but in a fresh, engaging structure.
    3. ${faqInstruction}
    4. ${takeawaysInstruction}
    5. ${relatedInstruction}
    ${
      settings.type === 'amazon-roundup-rewrite'
        ? `6. Reshape this into an Amazon product ROUNDUP. sectionType must be "intro", then one "product" H2 per product below, then "conclusion". Number each product heading ("1. Product Name"). Put productName, amazonUrl, and imageUrl from this list on each product item. Use these original Amazon product images only. Never use Pexels, Pixabay, or Unsplash.\n${productListString || 'No product list was resolved; keep the products named in the source.'}`
        : '6. This is a standard blog rewrite. Keep a normal blog structure grounded in the source.'
    }`
    }
    Return ONLY valid JSON.
  `

  let responseText = null
  let lastOutlineError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await outlineModel.generateContent(outlinePrompt)

      responseText = result.response.text()
      JSON.parse(responseText) // validate early
      break
    } catch (err) {
      lastOutlineError = err
      const msg = String(err?.message || err)

      const isCapacity =
        /429|rate.?limit|quota|resource.?exhausted|503|high demand|unavailable|overloaded|try again later/i.test(msg)

      if (isCapacity) {
        console.warn('[Outline] Gemini quota/high demand — using Groq/Mistral')

        const alt = await callLightLLM({
          system: 'Return only valid JSON with keys metaTitle, metaDescription, title, outline. No markdown.',
          prompt:
            outlinePrompt +
            '\n\nReturn JSON: {"metaTitle":"","metaDescription":"","title":"","outline":[{"type":"h2","text":""}]}',
          json: true,
          max_tokens: 1600
        })

        if (alt?.text) {
          responseText = alt.text
          break
        }

        throw new Error('RATE_LIMIT: Gemini and Groq could not produce an outline. Wait ~60s and try again.')
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt))
        continue
      }

      throw new Error(`OUTLINE_PARSE_FAILED: Could not produce a valid outline after ${attempt} attempts. ${msg}`)
    }
  }

  if (!responseText) {
    throw lastOutlineError || new Error('OUTLINE_PARSE_FAILED')
  }

  let heroImageUrl = ''
  let heroImageId = null
  let heroImageSource = null

  if (!amazonRewrite) {
    const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
      fetchUnsplashImage(targetKeyword),
      fetchPexelsImage(targetKeyword),
      fetchPixabayImage(targetKeyword)
    ])

    let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url)
    let fallbackToAiImageTag = false
    let scoredCandidates = []

    if (candidates.length > 0) {
      scoredCandidates = candidates.map(c => ({
        ...c,
        score: calculateRelevanceScore(c.alt || '', targetKeyword, targetKeyword)
      }))

      scoredCandidates.sort((a, b) => b.score - a.score)

      if (scoredCandidates[0].score >= 2.0) {
        heroImageUrl = scoredCandidates[0].url
        heroImageId = scoredCandidates[0].id ?? null
        heroImageSource = scoredCandidates[0].source || null
        console.log(`[Hero Image] Selected ${scoredCandidates[0].source} (Score: ${scoredCandidates[0].score})`)
      } else {
        console.log(
          `[Hero Image] Top image score (${scoredCandidates[0].score}) below 2.0. Invoking AI generation logic.`
        )
        fallbackToAiImageTag = true
      }
    } else {
      fallbackToAiImageTag = true
    }

    if (fallbackToAiImageTag) {
      const safetyBackup = scoredCandidates.length > 0 ? scoredCandidates[0].url : ''

      try {
        const fallbackImage = await generateFallbackImage(`High quality, realistic photograph of ${targetKeyword}`)

        if (fallbackImage && fallbackImage.url) {
          heroImageUrl = fallbackImage.url
        }
      } catch (error) {
        heroImageUrl = safetyBackup
        console.log(`[Hero Image] AI Fallback failed to generate a URL.`)
      }

      console.log(`[Hero Image] AI Generation Result: ${heroImageUrl ? 'Success' : 'Failed - Using Safety Backup'}`)
    }
  }

  try {
    const jsonResult = JSON.parse(responseText)

    if (amazonRewrite) {
      heroImageUrl = loadedProducts.productImages?.[0] || rewriteProducts.find(product => product.imageUrl)?.imageUrl || ''
      heroImageId = null
      heroImageSource = heroImageUrl ? 'amazon' : null
      console.log(`[Hero Image] Amazon rewrite product photo: ${heroImageUrl ? 'found' : 'missing'}`)
    }

    if (settings.type === 'amazon-roundup-rewrite' && Array.isArray(jsonResult.outline)) {
      const h2s = jsonResult.outline.filter(item => !item?.type || item.type === 'h2')
      const hasProduct = jsonResult.outline.some(
        item => item?.sectionType === 'product' || /^\d+\.\s+/.test(item?.text || '')
      )

      if (!hasProduct && rewriteProducts.length && h2s.length > 2) {
        rewriteProducts.forEach((product, index) => {
          const item = h2s[index + 1]

          if (!item || index >= h2s.length - 2) return

          item.sectionType = 'product'
          if (product.productName && !/^\d+\./.test(item.text || '')) {
            item.text = `${index + 1}. ${product.productName}`
          }
        })
      }

      jsonResult.outline = attachProductsToOutline(jsonResult.outline, rewriteProducts)
    }

    if (settings.type === 'amazon-review-rewrite') {
      jsonResult.outline = normalizeAmazonReviewRewriteOutline(jsonResult.outline, settings, rewriteProducts[0])
    }

    return {
      success: true,
      outline: jsonResult.outline,
      title: jsonResult.title,
      heroImage: heroImageUrl,
      heroImageId,
      heroImageSource,
      productImages: amazonRewrite ? loadedProducts.productImages || [] : undefined,
      metaTitle: jsonResult.metaTitle,
      metaDescription: jsonResult.metaDescription,
      externalLinks: fetchedExternalLinks,
      sourceArticleType: detectedType
    }
  } catch (error) {
    console.error('Failed to parse Rewrite outline JSON', error)

    return { success: false, error: 'Invalid JSON from AI' }
  }
}

export async function generateRewriteSection(body, genAI) {
  const {
    outlineContext,
    heading,
    subheadings,
    sectionIndex,
    uploadedMedia,
    settings = {},
    externalLinks,
    internalLinks,
    usedImageUrls = [],
    usedInternalLinks = [],
    usedExternalLinks = []
  } = body

  const {
    model,
    targetKeyword,
    articleTitle,
    toneOfVoice,
    customToneOfVoice,
    pointOfView,
    useRealTimeSearchData,
    realTimeDataSource,
    deepSearch,
    improveReadability,
    seoOptimization,
    manualKeywords,
    aiImagesAndVideos,
    language,
    country,
    articleUrlToRewrite
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const [articleData, rawHtml] = await Promise.all([
    fetchArticleData(articleUrlToRewrite),
    fetchRawArticleHtml(articleUrlToRewrite)
  ])
  const sourceText = articleData.text || ''

  if (!articleData.success && !String(rawHtml || '').trim()) {
    throw new Error('Failed to fetch the target article. Please check the URL and try again.')
  }

  assertRewriteSource(settings.type, detectSourceArticleType(`${rawHtml}\n${sourceText}`))

  let reviewProduct = null
  let reviewSectionType = ''
  let reviewImageHtml = ''
  let reviewPriceButton = ''

  if (settings.type === 'amazon-review-rewrite') {
    reviewSectionType = resolveAmazonReviewSectionType(heading, sectionIndex, outlineContext)
    reviewProduct = reviewProductFromOutline(outlineContext)

    if (!reviewProduct?.imageUrl || !reviewProduct?.amazonUrl || !reviewProduct?.productName) {
      const loaded = await loadRewriteProducts(settings, sourceText, rawHtml)

      reviewProduct = mergeRewriteProduct(reviewProduct, loaded.products?.[0])
    }

    reviewImageHtml = amazonReviewImageHtml(reviewProduct, targetKeyword)
    reviewPriceButton = buildCheckPriceButton(reviewProduct?.amazonUrl, amazonReviewLinkOptions(settings, reviewProduct))
  }

  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-pro-preview'
  })

  let realTimeInstruction = await getRealTimeInstruction(
    useRealTimeSearchData,
    realTimeDataSource,
    articleTitle,
    targetKeyword,
    heading
  )
  let extLinkInstruction = settings.automaticExternalLinks
    ? getExternalLinkInstruction(externalLinks, usedExternalLinks)
    : '\nCRITICAL FORMATTING: Do NOT include or generate any external URLs or links in this section under any circumstances.'
  let { instruction: linkInstruction, selectedUrl: internalLinkUrl } = await getLinkInstruction(
    internalLinks,
    heading,
    genAI,
    usedInternalLinks
  )
  let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword)
  let mediaInstruction = ''
  let assignedMediaElement = null
  let mediaUrl = null

  if (!isAmazonRewriteType(settings.type)) {
    const media = await getMediaInstruction(
      uploadedMedia,
      sectionIndex,
      aiImagesAndVideos,
      articleTitle,
      targetKeyword,
      heading,
      genAI,
      usedImageUrls,
      settings
    )

    mediaInstruction = media.mediaInstruction
    assignedMediaElement = media.assignedMediaElement
    mediaUrl = media.mediaUrl
  }
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)
  let povInstruction = getPovInstruction(pointOfView)
  let readabilityInstruction = getReadabilityInstruction(improveReadability)

  const rewriteType = settings.type || 'rewrite'
  const typeLayout =
    rewriteType === 'amazon-review-rewrite'
      ? `SINGLE-PRODUCT REVIEW LAYOUT: Match Amazon Single Product Review. One product only. Intro has the product image and Check Price button, feature sections follow, pros and cons are one two-column table, and the conclusion ends with the Check Price button.`
      : rewriteType === 'amazon-roundup-rewrite'
        ? `ROUNDUP LAYOUT: This section may cover one product in a multi-product roundup. Keep product-focused structure. Do not add Pexels, Pixabay, Unsplash, or YouTube media. The original Amazon product image is inserted by the system.`
        : `STANDARD BLOG REWRITE: Follow a natural blog structure grounded in the source.`

  let sectionStructureRequirements =
    rewriteType === 'amazon-review-rewrite'
      ? `
    CRITICAL STRUCTURE REQUIREMENTS (AMAZON SINGLE PRODUCT REVIEW REWRITE):
    1. Write only the section for "${heading}" using the Amazon Single Product Review layout in the layout block below.
    2. DO NOT copy the source text verbatim. Rewrite it and keep facts from the SOURCE ARTICLE CONTENT.
    3. If the source lacks a detail, omit it instead of inventing product claims.
    4. The layout block at the end of this prompt overrides generic blog formatting.
  `
      : `
    CRITICAL STRUCTURE REQUIREMENTS (REWRITE MODE):
    1. Write a comprehensive section directly underneath the main heading: "${heading}".
    ${subheadings && subheadings.length > 0 ? `2. Cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : '2. Do not invent unrelated subtopics.'}
    3. DO NOT copy the source text verbatim. Rewrite concepts in your own words while preserving facts from the SOURCE ARTICLE CONTENT.
    4. ${typeLayout}
    5. Prefer details that appear in the source. If the source lacks a detail, say so briefly instead of inventing product claims.
  `

  if (rewriteType === 'amazon-review-rewrite' && settings.enableFirstHandExperience) {
    povInstruction = `POINT OF VIEW: You MUST write in the First-Person ("I", "me", "my"). Speak directly to the reader as someone who currently owns, uses, and has rigorously tested this product. Only claim experiences that the source article supports.`
  }

  const activeSEOKeyword = targetKeyword || articleTitle || heading
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword)
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]
    - ${baseSystemInstruction}

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `

  const sectionPrompt = `
    Article Title Context: ${articleTitle || targetKeyword}
    Full Article Outline Context: ${JSON.stringify(outlineContext)}

    SOURCE ARTICLE CONTENT (MARKDOWN FORMAT):
    ${sourceText ? sourceText.substring(0, 180000) : 'No content provided.'}

    TASK: Write a comprehensive, uniquely rewritten section focusing ONLY on the main heading: "${heading}".
    Extract the relevant facts and data for this heading from the SOURCE ARTICLE, but write the section completely from scratch.

    ${sectionStructureRequirements}
    ${extLinkInstruction}
    ${linkInstruction}
    ${seoInstruction}
    ${toneInstruction}
    ${mediaInstruction}
    ${povInstruction}
    ${readabilityInstruction}
    ${keywordSEOInstructions}
    ${realTimeInstruction}
    ${
      settings.type === 'amazon-review-rewrite'
        ? amazonReviewRewriteSectionDirective({
            sectionType: reviewSectionType,
            heading,
            product: reviewProduct,
            priceButton: reviewPriceButton,
            productImageHtml: reviewImageHtml,
            settings,
            subheadings,
            targetKeyword
          })
        : isAmazonRewriteType(settings.type)
          ? `Preserve every Amazon affiliate tag from the source. Never invent a new tag. If this section recommends a product, end with this exact button HTML (or omit the button if the HTML is empty): ${buildCheckPriceButton(amazonRewriteOptions(settings, sourceText).url, amazonRewriteOptions(settings, sourceText))}`
          : ''
    }
  `

  let result = null

  try {
    result = await sectionModel.generateContent(sectionPrompt)
  } catch (error) {
    const msg = (error?.message || String(error) || '').toLowerCase()

    const shouldFallback =
      /429|quota|rate.?limit|resource.?exhausted|503|high demand|unavailable|overloaded|try again later|fetch failed/i.test(
        msg
      )

    if (!shouldFallback) throw error

    console.warn('[Section] Gemini quota hit — writing this section with Groq/Mistral')

    const alt = await callLightLLM({
      system: 'You are an expert SEO article writer. Return only the section body in markdown. No preamble, no JSON.',
      prompt: sectionPrompt.slice(0, 6000),
      max_tokens: 1400,
      waitOn429: false
    })

    if (!alt?.text) {
      // Do NOT throw — worker must continue other sections
      console.error('[Section] All providers exhausted. Skipping this heading.')

      return {
        success: false,
        skipped: true,
        heading,
        error: 'RATE_LIMIT',
        message: 'Gemini, Groq, and Mistral are all rate-limited. Wait ~60s and regenerate this section.'
      }
    }

    result = { response: { text: () => alt.text } }
  }

  let text = result.response.text()

  if (isAmazonRewriteType(settings.type)) {
    text = stripStockMedia(text)
    assignedMediaElement = null
    mediaUrl = null

    if (settings.type === 'amazon-review-rewrite') {
      const sectionType = reviewSectionType || resolveAmazonReviewSectionType(heading, sectionIndex, outlineContext)

      if (
        sectionType === 'intro' &&
        reviewImageHtml &&
        reviewProduct?.imageUrl &&
        !text.includes(String(reviewProduct.imageUrl))
      ) {
        text = insertAfterFirstBlock(text, reviewImageHtml)
      }

      if (sectionType === 'intro' || sectionType === 'conclusion') {
        text = withRequiredCheckPrice(text, {
          url: reviewProduct?.amazonUrl,
          asin: reviewProduct?.asin,
          language: settings.language,
          domain: settings.amazonDomain || 'www.amazon.com',
          partnerTag: settings.amazonTrackingId || settings.partnerTag || process.env.AMAZON_PARTNER_TAG || 'babiescarrier-20'
        })
      }

      const slot = Number(sectionIndex)

      if ((slot === 2 || slot === 3) && sectionType !== 'intro') {
        const extras = await pickRelevantImages(
          heading || articleTitle || targetKeyword,
          targetKeyword || reviewProduct?.productName || heading,
          4
        )
        const chosen = (extras || []).find(image => image?.url && image.url !== reviewProduct?.imageUrl)

        if (chosen?.url) {
          const alt = escapeHtml(chosen.alt || heading || 'Product')
          const figure = `<div align="center" style="margin:20px 0;"><img src="${escapeHtml(chosen.url)}" alt="${alt}" style="max-width:420px;width:100%;height:auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></div>`

          text = `${text}\n\n${figure}`
        }
      }
    } else {
    const outlineProducts = (Array.isArray(outlineContext) ? outlineContext : [])
      .map(item => item?.productData)
      .filter(product => product && (product.imageUrl || product.asin || product.productName))
    let products = outlineProducts.some(product => product.imageUrl) ? outlineProducts : []

    if (!products.length) {
      const loaded = await loadRewriteProducts(settings, sourceText, rawHtml)

      products = loaded.products || []
    }

    const outlineItem = (Array.isArray(outlineContext) ? outlineContext : []).find(item => item?.text === heading)
    const sectionType = outlineItem?.sectionType || (Number(sectionIndex) === 0 ? 'intro' : '')
    const isIntro = sectionType === 'intro' || Number(sectionIndex) === 0

    if (settings.type === 'amazon-roundup-rewrite' && isIntro && products.length) {
      const linkOptions = {
        language: settings.language,
        domain: settings.amazonDomain || 'www.amazon.com',
        partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
      }
      const layout =
        settings.roundupLayout === 'top-pick'
          ? renderTopPickCards(products, linkOptions)
          : renderResponsiveTable({
              headers: ['Image', 'Product', 'Link'],
              rows: products.slice(0, 3).map(product => {
                const safeTitle = escapeHtml(
                  String(product.productName || product.asin || 'Amazon product').replace(/[\r\n]+/g, ' ')
                )
                const safeImageUrl = escapeHtml(String(product.imageUrl || ''))
                const altText = escapeHtml(`${targetKeyword || ''} ${product.productName || ''}`.trim())
                const button = buildCheckPriceButton(product.amazonUrl, { ...linkOptions, asin: product.asin })

                return [
                  safeImageUrl
                    ? `<img src="${safeImageUrl}" alt="${altText}" title="${safeTitle}" style="width:80px;height:80px;max-width:100%;object-fit:contain;border-radius:8px;" />`
                    : '',
                  safeTitle,
                  button
                ]
              })
            })

      if (settings.roundupLayout === 'top-pick') {
        text = text.replace(/<table\b[\s\S]*?<\/table>/gi, '')
        if (!/affigenie-product-cards/i.test(text)) text += `\n\n${layout}`
      } else if (layout && !/<table[\s>]/i.test(text)) {
        text += `\n\n${layout}`
      }
    }

    const productForImage =
      sectionType === 'product' || matchRewriteProduct(heading, outlineContext, products)
        ? matchRewriteProduct(heading, outlineContext, products)
        : null
    const imageHtml = productImageHtml(productForImage, targetKeyword)

    if (imageHtml && !text.includes(String(productForImage.imageUrl))) {
      text = insertAfterFirstBlock(text, imageHtml)
    }

    const buttonTarget = productForImage?.amazonUrl
      ? {
          url: productForImage.amazonUrl,
          asin: productForImage.asin,
          language: settings.language,
          domain: settings.amazonDomain || 'www.amazon.com',
          partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
        }
      : amazonRewriteOptions(settings, sourceText, text)

    text = withRequiredCheckPrice(text, buttonTarget)
    }
  }

  return {
    success: true,
    text,
    mediaHtml: assignedMediaElement,
    mediaUrl: mediaUrl,
    internalLinkUrl: internalLinkUrl
  }
}

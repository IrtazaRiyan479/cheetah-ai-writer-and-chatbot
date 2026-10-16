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
  fetchRawArticleHtml
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

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline based on the provided SOURCE ARTICLE. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, rewritten H1 Title) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title", "outline": [{ "type": "h2", "text": "Heading text" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword || 'main topic'}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword || 'main topic'}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword || 'main topic'}" in its "text" field.`
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

    LENGTH CONTROL: ${lengthInstruction(settings.articleLength, settings.customSectionCount)}

    TASK:
    1. Extract the core concepts, topics, and structure of the SOURCE ARTICLE CONTENT below. Ground every heading in that content.
    2. Create a comprehensive, REWRITTEN outline (H2s and H3s) that covers the same information but in a fresh, engaging structure.
    3. ${faqInstruction}
    4. ${takeawaysInstruction}
    5. ${relatedInstruction}
    ${
      settings.type === 'amazon-roundup-rewrite'
        ? `6. Reshape this into an Amazon product ROUNDUP. sectionType must be "intro", then one "product" H2 per product below, then "conclusion". Number each product heading ("1. Product Name"). Put productName, amazonUrl, and imageUrl from this list on each product item. Use these original Amazon product images only. Never use Pexels, Pixabay, or Unsplash.\n${productListString || 'No product list was resolved; keep the products named in the source.'}`
        : settings.type === 'amazon-review-rewrite'
          ? `6. Reshape this into an Amazon SINGLE-PRODUCT review only. sectionType must be intro, features, pros_cons, conclusion, or faq, in that order. Preserve the affiliate URL exactly. The product image is inserted by the system from Amazon; do not request stock photos. Product: ${rewriteProducts[0]?.productName || targetKeyword || ''}.`
          : '6. This is a standard blog rewrite. Keep a normal blog structure grounded in the source.'
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

    if (settings.type === 'amazon-review-rewrite' && Array.isArray(jsonResult.outline)) {
      const allowed = new Set(['intro', 'features', 'pros_cons', 'conclusion', 'faq', 'standard'])
      const reviewProduct = rewriteProducts[0]

      jsonResult.outline = jsonResult.outline.map((item, index) => {
        const next = { ...item }
        if (!next.sectionType) {
          if (index === 0) next.sectionType = 'intro'
          else if (/feature/i.test(next.text || '')) next.sectionType = 'features'
          else if (/pros|cons/i.test(next.text || '')) next.sectionType = 'pros_cons'
          else if (/faq|question/i.test(next.text || '')) next.sectionType = 'faq'
          else if (/conclusion|verdict|final/i.test(next.text || '')) next.sectionType = 'conclusion'
          else next.sectionType = 'standard'
        }
        if (!allowed.has(next.sectionType) || next.sectionType === 'product') {
          next.sectionType = index === 0 ? 'intro' : 'standard'
        }
        if (index === 0 && reviewProduct) next.productData = reviewProduct
        return next
      })
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
      ? `SINGLE-PRODUCT REVIEW LAYOUT: Write only about one product. Do not list multiple competing products, roundup tables, or "top picks". Do not add Pexels, Pixabay, Unsplash, or YouTube media. The original Amazon product image is inserted by the system.`
      : rewriteType === 'amazon-roundup-rewrite'
        ? `ROUNDUP LAYOUT: This section may cover one product in a multi-product roundup. Keep product-focused structure. Do not add Pexels, Pixabay, Unsplash, or YouTube media. The original Amazon product image is inserted by the system.`
        : `STANDARD BLOG REWRITE: Follow a natural blog structure grounded in the source.`

  let sectionStructureRequirements = `
    CRITICAL STRUCTURE REQUIREMENTS (REWRITE MODE):
    1. Write a comprehensive section directly underneath the main heading: "${heading}".
    ${subheadings && subheadings.length > 0 ? `2. Cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : '2. Do not invent unrelated subtopics.'}
    3. DO NOT copy the source text verbatim. Rewrite concepts in your own words while preserving facts from the SOURCE ARTICLE CONTENT.
    4. ${typeLayout}
    5. Prefer details that appear in the source. If the source lacks a detail, say so briefly instead of inventing product claims.
  `

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
      isAmazonRewriteType(settings.type)
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
      settings.type === 'amazon-review-rewrite'
        ? isIntro
          ? products[0]
          : null
        : sectionType === 'product' || matchRewriteProduct(heading, outlineContext, products)
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

  return {
    success: true,
    text,
    mediaHtml: assignedMediaElement,
    mediaUrl: mediaUrl,
    internalLinkUrl: internalLinkUrl
  }
}

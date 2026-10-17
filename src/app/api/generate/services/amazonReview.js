import {
  fetchSerperOutlineData,
  getLinkInstruction,
  getExternalLinkInstruction,
  getRealTimeInstruction,
  getReadabilityInstruction,
  getMediaInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchPeopleAlsoSearchFor,
  pickRelevantImages
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'
import { buildCheckPriceButton, resolveAffiliateUrl, withRequiredCheckPrice } from '../utils/articleHtml'

function extractASIN(url) {
  if (!url) return null

  const match =
    url.match(/(?:dp|o|v|item|ASIN|product)\/([a-zA-Z0-9]{10})/i) || url.match(/\/([a-zA-Z0-9]{10})(?:[/?]|$)/i)

  return match ? match[1] : null
}

async function fetchInternalAmazonData(keyword, settings) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const response = await fetch(`${baseUrl}/api/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: settings.partnerTag || 'babiescarrier-20'
    })
  })

  if (!response.ok) throw new Error(`Failed to fetch Amazon data. Status: ${response.status}`)

  return await response.json()
}

function formatAmazonProducts(apiData, settings) {
  const rawData = apiData?.data?.searchResult?.items || []

  if (!rawData.length) return []

  const domain = settings.amazonDomain || 'www.amazon.com'
  const partnerTag = settings.partnerTag || process.env.AMAZON_PARTNER_TAG || 'babiescarrier-20'

  return rawData.map(item => {
    const asin = item.asin || ''

    return {
      productName: item.itemInfo?.title?.displayValue || 'Amazon Product',
      asin,
      amazonUrl: resolveAffiliateUrl({
        url: item.detailPageURL,
        asin,
        domain,
        partnerTag,
        forceTag: settings.amazonTrackingId || ''
      }),
      imageUrl: item.images?.primary?.large?.url || '',
      price: item.offersV2?.listings?.[0]?.price?.displayAmount || 'Check Amazon',
      features: item.itemInfo?.features?.displayValues || []
    }
  })
}

export async function generateAmazonReviewOutline(body, genAI) {
  const { prompt, settings } = body

  const {
    model,
    targetKeyword,
    amazonProductUrl,
    language,
    country,
    enableFirstHandExperience,
    includeFaq,
    automaticExternalLinks
  } = settings

  const condensedMode = Boolean(settings.condensedMode || settings.enableCondensedMode)
  const sourceArticleText = String(body.sourceArticleText || '').trim()
  const isRewriteMode = Boolean(sourceArticleText) || settings.type === 'amazon-review-rewrite'

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const prefetched = body.prefetchedProduct && typeof body.prefetchedProduct === 'object' ? body.prefetchedProduct : null
  const preferredAsin = prefetched?.asin || extractASIN(amazonProductUrl) || ''
  let product = null

  try {
    const searchStr = preferredAsin || targetKeyword || prefetched?.productName || 'amazon product'
    const apiData = await fetchInternalAmazonData(searchStr, settings)
    const formattedProducts = formatAmazonProducts(apiData, settings)
    const matched = preferredAsin
      ? formattedProducts.find(item => String(item.asin || '').toUpperCase() === String(preferredAsin).toUpperCase())
      : formattedProducts[0]

    if (matched) product = matched
  } catch (error) {
    if (!isRewriteMode) throw error
    console.warn('[amazon-review-rewrite] product lookup failed:', error?.message || error)
  }

  if (!product && prefetched && (prefetched.asin || prefetched.productName || prefetched.amazonUrl)) {
    product = prefetched
  }

  if (!product) {
    if (!isRewriteMode) {
      throw new Error('Could not fetch product details from Amazon. Please check the URL.')
    }

    product = {
      productName: targetKeyword || 'Amazon Product',
      asin: preferredAsin || '',
      amazonUrl: amazonProductUrl || '',
      imageUrl: '',
      price: '',
      features: []
    }
  } else if (prefetched) {
    product = {
      ...prefetched,
      ...product,
      asin: preferredAsin || product.asin || prefetched.asin || '',
      productName: product.productName || prefetched.productName || targetKeyword || '',
      amazonUrl: product.amazonUrl || prefetched.amazonUrl || amazonProductUrl || '',
      imageUrl: product.imageUrl || prefetched.imageUrl || '',
      price: product.price || prefetched.price || '',
      features: product.features?.length ? product.features : prefetched.features || []
    }
  }

  const activeKeyword = targetKeyword || product.productName || 'Amazon product'

  let fetchedExternalLinks = []
  let faqInstruction = ''
  let relatedInstruction = ''

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

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${activeKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${activeKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${activeKeyword}" in its "text" field.`
  })

  let outlineStructure = ``

  if (condensedMode) {
    outlineStructure += `
      - CONDENSED MODE IS ENABLED: Create a highly concise, punchy outline.
      - Limit the structure to essential H2s only.
      - Do NOT use H3 subheadings unless absolutely critical.
    `
  } else {
    outlineStructure += `
      - FULL REVIEW MODE: Create a comprehensive, deep-dive outline.
      - Include logical H2s (e.g., Overview, Unboxing, Performance, Pros & Cons, Alternatives).
      - Use highly descriptive H3 subheadings under the main H2 sections to break up the text.
    `
  }

  if (enableFirstHandExperience) {
    outlineStructure += `
      - FIRST-HAND EXPERIENCE IS ENABLED: The headings MUST reflect personal testing and usage (e.g., "My Experience With...", "How I Tested It").
    `
  }

  const outlinePrompt = `Create an Amazon Single-Product Review Outline for: ${prompt || targetKeyword}\n\nIMPORTANT STRUCTURE RULES:\n${outlineStructure}
  CRITICAL STRUCTURE & SCHEMA REQUIREMENTS:
    You are writing an outline for a single product review.
    Product Name / Target Keyword: ${activeKeyword}

    You must format the outline array exactly like this:
    Schema: { "type": "h2", "text": "Heading Text", "sectionType": "the_type" }

    Rules for "sectionType": MUST be one of: "intro", "features", "pros_cons", "conclusion"${includeFaq ? ', or "faq"' : ''}.

    CRITICAL WORD COUNT & DEPTH RULES:
  - Total Target Word Count: 3500+ words.
  - You MUST generate at least 20 H2/H3 sections.
  - Each section MUST be dense with information, analysis, and data.
  - Include specific sections for: "In-depth Technical Specifications", "Real-world Performance Testing", "Comparative Analysis vs Competitors", and "Long-term Durability Report".

    LAYOUT ORDER:
    1. The first item MUST be an "intro" (type: h2).
    2. Next, create 2 or 3 feature-focused headings (type: h2).
    3. Include a "pros_cons" section (type: h2).
    4. Include a "conclusion" (type: h2).
    5. ${faqInstruction}}
    6- ${relatedInstruction}

    ${
      isRewriteMode
        ? `REWRITE MODE (Amazon Single Product Review layout — same as a new Amazon Single Product Review):
    - Current writer settings are authoritative. Obey condensed mode (${condensedMode ? 'on' : 'off'}), first-hand experience (${enableFirstHandExperience ? 'on' : 'off'}), FAQ (${includeFaq ? 'on' : 'off'}), language (${langName}), and country (${countryName}).
    - Do NOT copy the old article's tone, length, point of view, FAQ choice, condensed mode, or heading plan when they differ from these settings.
    - Source text is reference only. Rewrite in a fresh voice. Do not copy sentences.
    - Prefer this ASIN if present: ${product.asin || 'unknown'}. Prefer this product name: ${product.productName || activeKeyword}. Prefer this source title when it still fits the current keyword: ${body.sourceTitle || 'none'}.
    - If the ASIN, product name, or title cannot be recovered, still return a complete outline for "${activeKeyword}".

    SOURCE ARTICLE (reference):
    ${sourceArticleText.substring(0, 120000)}`
        : ''
    }`

  let parsedData = null
  let lastOutlineError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await outlineModel.generateContent(outlinePrompt)

      parsedData = JSON.parse(result.response.text())

      if (!parsedData?.outline || !Array.isArray(parsedData.outline) || parsedData.outline.length === 0) {
        throw new Error('Outline JSON missing outline array')
      }

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
            '\n\nReturn JSON: {"metaTitle":"","metaDescription":"","title":"","outline":[{"type":"h2","text":"","sectionType":"intro"}]}',
          json: true,
          max_tokens: 1600
        })

        const parsed = parseJsonSafe(alt?.text)

        if (parsed?.outline?.length) {
          parsedData = parsed
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

  if (!parsedData) {
    throw lastOutlineError || new Error('OUTLINE_PARSE_FAILED')
  }

  if (parsedData.outline && parsedData.outline.length > 0) {
    parsedData.outline[0].productData = product
  }

  let heroImage = ''
  let heroImageId = null
  let heroImageSource = null

  if (isRewriteMode) {
    const banned = Array.isArray(body.excludedHeroUrls) ? body.excludedHeroUrls.map(String) : []
    const photos = await pickRelevantImages(activeKeyword, targetKeyword || activeKeyword, 6).catch(() => [])
    const fresh = (photos || []).filter(item => {
      const candidate = String(item?.url || '')

      if (!candidate || /amazon|media-amazon/i.test(candidate)) return false

      return !banned.some(url => {
        const blocked = String(url || '')

        if (!blocked) return false
        if (candidate === blocked || blocked.includes(candidate) || candidate.includes(blocked)) return true

        const pexelsId = candidate.match(/pexels\.com\/photos\/(\d+)/i)?.[1]
        const unsplashId = candidate.match(/images\.unsplash\.com\/(?:photo-)?([^/?]+)/i)?.[1]
        const id = pexelsId || unsplashId

        return Boolean(id && id.length > 3 && blocked.includes(id))
      })
    })
    const heroPick = fresh[1] || fresh[0] || null

    if (heroPick?.url) {
      heroImage = heroPick.url
      heroImageId = heroPick.id ?? null
      heroImageSource = heroPick.source || 'pexels'
    }
  }

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription,
    heroImage,
    heroImageId,
    heroImageSource,
    externalLinks: fetchedExternalLinks,
    productImages: []
  }
}

export async function generateAmazonReviewSection(sectionData, genAI) {
  const {
    heading,
    section,
    subheadings,
    sectionIndex,
    outlineContext,
    settings,
    amazonProductData,
    externalLinks,
    internalLinks,
    usedInternalLinks = [],
    usedExternalLinks = []
  } = sectionData

  const {
    model,
    targetKeyword,
    articleTitle,
    enableFirstHandExperience,
    toneOfVoice,
    customToneOfVoice,
    pointOfView,
    improveReadability
  } = settings

  const condensedMode = Boolean(settings.condensedMode || settings.enableCondensedMode)
  const sourceArticleText = String(sectionData.sourceArticleText || settings.fetchedSourceArticle || '').trim()
  const langObj = languages ? languages[settings.language] : null
  const langName = langObj ? langObj.name : settings.language || 'English'
  const countryObj = countries ? countries.find(c => c.code === settings.country) : null
  const countryName = countryObj ? countryObj.name : settings.country || 'United States'

  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    ...(sourceArticleText
      ? {
          systemInstruction: `${getBaseSystemInstruction(langName, countryName)}

REWRITE RULE: Current writer settings override the source article. Do not reuse the old article's tone, length, point of view, FAQ choice, or condensed mode. Use the source only to keep the same ASIN, product name, title, and verifiable facts. If those cannot be recovered, still write this section.`
        }
      : {})
  })

  let realTimeInstruction = await getRealTimeInstruction(
    settings.realTimeDataSource,
    articleTitle,
    heading,
    targetKeyword
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
  let seoInstruction = await getSeoInstruction(targetKeyword)
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)

  const introSection = outlineContext.find(s => s.productData)
  const product = introSection ? introSection.productData : null

  const activeHeadingText = heading || section?.text || 'Section'
  let activeSectionType = section?.sectionType || section?.type

  if (!activeSectionType && Array.isArray(outlineContext)) {
    const matched = outlineContext.find(s => s.text === activeHeadingText || activeHeadingText.includes(s.text))

    if (matched) activeSectionType = matched.sectionType
  }

  activeSectionType = activeSectionType || 'standard'

  const activeKeyword = targetKeyword || (product ? product.productName : 'this product')

  const condensedInstruction = condensedMode
    ? 'CRITICAL REQUIREMENT (CONDENSED MODE): This article must be highly concise. Keep all paragraphs extremely short (1 to 3 sentences maximum). Eliminate all fluff, repetitive filler words, and long-winded introductions. Get straight to the point immediately.'
    : 'Write detailed, comprehensive paragraphs to fully explore the topic.'

  const experienceInstruction = enableFirstHandExperience
    ? 'PERSPECTIVE: Write as if you personally own, use, and have extensively tested this exact product. Share hands-on observations.'
    : 'PERSPECTIVE: Write objectively as an expert product reviewer relying on factual data.'

  let povInstruction = enableFirstHandExperience
    ? `POINT OF VIEW: You MUST write in the First-Person ("I", "me", "my"). Speak directly to the reader as someone who currently owns, uses, and has rigorously tested this product.`
    : getPovInstruction(pointOfView)

  let readabilityInstruction = getReadabilityInstruction(improveReadability)

  let amazonContext = ''

  if (amazonProductData) {
    amazonContext = `
      REAL PRODUCT DATA CONTEXT:
      Title: ${amazonProductData.title}
      Price: ${amazonProductData.price}
      Include these exact factual details naturally in the text where relevant.
    `
  }

  let sectionStructureRequirements = `
    CRITICAL STRUCTURE REQUIREMENTS (AMAZON SINGLE PRODUCT REVIEW):
    1. You are writing content strictly for the heading: "${heading}".
    2. DEPTH: Write minimum 500-800 words for this section. Expand on every point. Use extensive, detailed explanations. Do not provide brief answers.
    3. Use descriptive H3 subheadings (###) to break up the dense content.
    4. Write an engaging paragraph directly under the main heading before diving into any subheadings. Do not leave the space under the H2 blank.
    5. Ensure the total article length (across all sections) will reach 3500+ words.
    ${condensedMode ? '3. Keep paragraphs extremely short (2-3 sentences max). Get straight to the point. No fluff.' : ''}
    ${subheadings && subheadings.length > 0 ? `4. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
    ${enableFirstHandExperience ? '5. Write as if you are sharing your personal, hands-on experience. Detail specific things you noticed while "testing" or "using" it.' : '5. Write as an objective, highly knowledgeable product reviewer.'}
  `

  const activeSEOKeyword = targetKeyword || articleTitle || heading
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword)
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 Google Keyword and 1 Bing Keyword from the provided lists into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `

  let sectionPrompt = `
    Article Topic: Single Product Review for "${activeKeyword}"
    Current Heading: "${activeHeadingText}"
    Full Article Outline for Context: ${JSON.stringify(outlineContext)}

    TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

    ${keywordSEOInstructions}
    ${condensedInstruction}
    ${experienceInstruction}
    ${amazonContext}
    ${sectionStructureRequirements}
    ${realTimeInstruction}
    ${linkInstruction}
    ${extLinkInstruction}
    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
    ${
      sourceArticleText
        ? `REWRITE SOURCE (reference only — write a new section with the CURRENT settings above, not the old article's settings):
Prefer ASIN ${product?.asin || 'from the outline'} and the product/title already in this outline. If a source detail is missing, keep writing.
${sourceArticleText.substring(0, 80000)}`
        : ''
    }
  `

  if (product) {
    sectionPrompt += `
      PRODUCT CONTEXT (FACTUAL DATA - DO NOT INVENT PRICING OR NAMES):
      - Product Name: ${product.productName}
      - Price: ${product.price}
      - Core Technical Features: ${product.features && product.features.length ? product.features.join(' | ') : 'N/A'}
    `
  }

  const priceButton = buildCheckPriceButton(product?.amazonUrl, {
    language: settings.language,
    asin: product?.asin,
    domain: settings.amazonDomain || 'www.amazon.com',
    partnerTag: settings.amazonTrackingId || settings.partnerTag || process.env.AMAZON_PARTNER_TAG || 'babiescarrier-20'
  })

  const productImageHtml = product?.imageUrl
    ? `<div align="center" style="margin:20px 0;"><img src="${product.imageUrl}" alt="${String(product.productName || targetKeyword || 'Product').replace(/"/g, '')}" style="max-width:420px;width:100%;height:auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></div>`
    : ''

  if (activeSectionType === 'intro' && priceButton) {
    sectionPrompt += `
      TASK: Write a highly engaging introduction for this single-product review.
      CRITICAL: Do NOT repeat the article H1/H2 heading in the body.

      STRICT LAYOUT REQUIREMENT:
      1. Write 2-3 intro paragraphs.
      2. Then insert this product image HTML exactly (if present):
      ${productImageHtml || '[no product image]'}
      3. Then insert this EXACT CTA HTML (do not change the link or label):
      <div class="affigenie-cta" style="display:block;width:100%;max-width:100%;text-align:center;margin:25px 0;">
        ${priceButton}
      </div>
    `
  } else if (activeSectionType === 'intro') {
    sectionPrompt += `
      TASK: Write a highly engaging introduction for this single-product review.
      CRITICAL: Do NOT repeat the article heading in the body.
      ${productImageHtml ? `After the intro paragraphs, insert this product image HTML exactly:\n${productImageHtml}` : ''}
    `
  } else if (activeSectionType === 'pros_cons') {
    sectionPrompt += `
      TASK: Write a Pros and Cons section for this product.
      STRICT REQUIREMENT: Use a strictly formatted Markdown table with "Pros" and "Cons" columns.
      Do NOT repeat the section heading in the body.
    `
  } else if (activeSectionType === 'conclusion') {
    sectionPrompt += `
      TASK: Write a compelling conclusion and final verdict.
      Do NOT repeat the section heading in the body.
      ${
        priceButton
          ? `STRICT LAYOUT REQUIREMENT (Final CTA):
      At the very end of your conclusion, insert this EXACT HTML block. Do not change the link or the label:

      <div class="affigenie-cta" style="display:block;width:100%;max-width:100%;text-align:center;margin:25px 0;">
        ${priceButton}
      </div>`
          : ''
      }
    `
  } else if (activeSectionType === 'faq') {
    sectionPrompt += `
      TASK: Write a comprehensive FAQ section containing 3 to 5 commonly asked questions regarding this product.
      Do NOT repeat the FAQ heading in the body.

      STRICT REQUIREMENT (Schema Markup):
      You MUST wrap the questions and answers in valid JSON-LD FAQPage schema markup. Place the schema inside a <script type="application/ld+json"> tag at the very end of the section. Do NOT use markdown code blocks around the script tag.
    `
  } else {
    sectionPrompt += `
      TASK: Write a comprehensive section analyzing this specific aspect of the product.
      CRITICAL: Do NOT output the section heading again — start with paragraphs only.
    `
  }

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

  const insertAfterFirstBlock = (body, snippet) => {
    if (!snippet || body.includes(snippet.slice(0, 80))) return body
    const parts = String(body || '').split(/\n\n+/)
    if (parts.length > 1) return [parts[0], snippet, ...parts.slice(1)].join('\n\n')
    return `${body}\n\n${snippet}`
  }

  if (activeSectionType === 'intro' && productImageHtml) {
    text = insertAfterFirstBlock(text, productImageHtml)
  }

  const slot = Number(sectionIndex)
  if ((slot === 2 || slot === 3) && activeSectionType !== 'intro') {
    const extras = await pickRelevantImages(heading || articleTitle || targetKeyword, targetKeyword || product?.productName || heading, 4)
    const chosen = (extras || []).find(image => image?.url && image.url !== product?.imageUrl)
    if (chosen?.url) {
      const alt = String(chosen.alt || heading || 'Product').replace(/"/g, '')
      const figure = `<div align="center" style="margin:20px 0;"><img src="${chosen.url}" alt="${alt}" style="max-width:420px;width:100%;height:auto;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);" /></div>`
      text = `${text}\n\n${figure}`
    }
  }

  if (priceButton && (activeSectionType === 'intro' || activeSectionType === 'conclusion')) {
    text = withRequiredCheckPrice(text, {
      url: product?.amazonUrl,
      asin: product?.asin,
      language: settings.language,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: settings.amazonTrackingId || settings.partnerTag || process.env.AMAZON_PARTNER_TAG || 'babiescarrier-20'
    })
  }

  return {
    success: true,
    text,
    mediaHtml: null,
    internalLinkUrl: internalLinkUrl
  }
}

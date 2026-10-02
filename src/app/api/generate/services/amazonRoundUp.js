import {
  getLinkInstruction,
  getExternalLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchUnsplashImage,
  fetchPexelsImage,
  fetchPixabayImage,
  calculateRelevanceScore,
  fetchPeopleAlsoSearchFor,
  generateFallbackImage,
  fetchSerperOutlineData
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'
import {
  buildCheckPriceButton,
  escapeHtml,
  renderResponsiveTable,
  renderTopPickCards,
  resolveAffiliateUrl,
  withRequiredCheckPrice
} from '../utils/articleHtml'

export async function fetchInternalAmazonData(keyword, settings) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const response = await fetch(`${baseUrl}/api/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: process.env.AMAZON_PARTNER_TAG
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorDetails = errorText

    try {
      const parsed = JSON.parse(errorText)

      errorDetails = parsed.details ? JSON.stringify(parsed.details) : errorText
    } catch (e) {}

    console.error('Amazon Route Failed:', errorDetails)
    throw new Error(`Amazon API 400: ${errorDetails}`)
  }

  return await response.json()
}

export function formatAmazonProducts(apiData, settings) {
  const rawData = apiData?.data?.searchResult?.items || []
  const numberOfProducts = settings.numberOfProducts || 5
  const limitedProducts = rawData.slice(0, numberOfProducts)

  const domain = settings.amazonDomain || 'www.amazon.com'
  const partnerTag = process.env.AMAZON_PARTNER_TAG || ''

  return limitedProducts.map(item => {
    const title = item?.itemInfo?.title?.displayValue || 'Amazon Product'
    const asin = item?.asin || ''
    let imageUrl = item?.images?.primary?.large?.url || ''

    imageUrl = imageUrl.replace(/\._[A-Za-z0-9_]+_\./, '.')
    const price = item?.offersV2?.listings?.[0]?.price?.money?.displayAmount || 'See listing'
    const features = item?.itemInfo?.features?.displayValues || []

    return {
      productName: title,
      asin,
      amazonUrl: resolveAffiliateUrl({
        url: item?.detailPageURL,
        asin,
        domain,
        partnerTag,
        forceTag: settings.amazonTrackingId || ''
      }),
      imageUrl: imageUrl,
      price: price,
      rating: item?.customerReviews?.starRating || item?.customerReviews?.rating || null,
      features: features
    }
  })
}

export async function generateAmazonRoundupOutline(body, genAI) {
  const { settings, targetKeyword } = body
  const { model, language, country, includeFaq, automaticExternalLinks } = settings

  const amazonApiData = await fetchInternalAmazonData(targetKeyword, settings)
  const formattedProducts = formatAmazonProducts(amazonApiData, settings)

  if (formattedProducts.length === 0) {
    throw new Error('No Amazon products found for this keyword. Please check the keyword or Amazon API limit.')
  }

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const productListString = formattedProducts
    .map(
      (p, index) =>
        `${index + 1}. ${p.productName}\n   URL: ${p.amazonUrl}\n   Image: ${p.imageUrl}\n   Price: ${p.price}`
    )
    .join('\n\n')

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
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging Amazon Roundup article outline for the keyword: "${targetKeyword}". You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy H1 Title) and "outline" (A flat JSON array of objects).\n\nFor standard sections (intro, buying_guide, faq), use this schema:\n{ "type": "h2", "text": "Section Title", "sectionType": "intro" }\n\nFor "product" sections, you MUST include the rich product data provided to you using this schema:\n{\n  "type": "h2",\n  "text": "[Product Name]",\n  "sectionType": "product",\n  "productData": {\n    "productName": "Exact Amazon Title",\n    "amazonUrl": "https://amazon.com/dp/...",\n    "imageUrl": "https://m.media-amazon.com/images/...",\n    "price": "$19.99"\n  }\n}\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object (intro) MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object (conclusion or faq) MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  })

  const outlinePrompt = `
    CRITICAL STRUCTURE & SCHEMA REQUIREMENTS:
    You must format the outline array exactly like this to support the frontend editor:
    Schema: { "type": "h2", "text": "Heading Text", "sectionType": "the_type" }

    Rules for "type": MUST strictly be "h2" or "h3".
    Rules for "text": The actual string of the heading.
    Rules for "sectionType": MUST be one of: "intro", "product", "buying_guide", "conclusion", or "faq".

    LAYOUT ORDER:
    1. The first item MUST be an "intro" (type: h2).
    2. Next, you MUST create a "product" (type: h2) for EXACTLY these products using this precise data. You MUST explicitly number the product titles in the "text" field (e.g., "1. Product Name", "2. Product Name"):
    ${productListString}
    3. Include a "buying_guide" (type: h2) after the product reviews.
    4. Include a "conclusion" (type: h2).
    5. ${faqInstruction}
    6. ${relatedInstruction}
  `

  let parsedData = null
  let lastOutlineError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await outlineModel.generateContent(outlinePrompt)
      const raw = result.response.text()

      parsedData = JSON.parse(raw)

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

  const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
    fetchUnsplashImage(targetKeyword),
    fetchPexelsImage(targetKeyword),
    fetchPixabayImage(targetKeyword)
  ])

  let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url)
  let heroImageUrl = ''
  let heroImageId = null
  let heroImageSource = null
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

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription,
    externalLinks: fetchedExternalLinks,
    heroImage: heroImageUrl,
    heroImageId,
    heroImageSource
  }
}

export async function generateAmazonRoundupSection(body, genAI) {
  const {
    heading,
    text,
    section = {},
    articleTitle,
    outlineContext,
    settings = {},
    targetKeyword,
    internalLinks,
    externalLinks,
    usedExternalLinks = [],
    usedInternalLinks = []
  } = body

  const { model, enableFirstHandExperience, improveReadability, pointOfView, toneOfVoice } = settings

  const amazonApiData = body.shared?.amazon || (await fetchInternalAmazonData(targetKeyword || articleTitle, settings))
  const formattedProducts = formatAmazonProducts(amazonApiData, settings)

  const activeHeadingText = heading || text || section.text || section.heading || 'Section'
  let activeSectionType = section.sectionType || section.type

  if (!activeSectionType && Array.isArray(outlineContext)) {
    const matchedSection = outlineContext.find(s => s.text === activeHeadingText || activeHeadingText.includes(s.text))

    if (matchedSection) {
      activeSectionType = matchedSection.sectionType
    }
  }

  activeSectionType = activeSectionType || 'standard'

  const sectionModel = genAI.getGenerativeModel({ model: model || 'gemini-3.1-flash-lite' })

  const toneInstruction = getToneInstruction(toneOfVoice)
  const povInstruction = getPovInstruction(pointOfView)
  const readabilityInstruction = getReadabilityInstruction(improveReadability)
  const seoInstruction = await getSeoInstruction(targetKeyword)

  let { instruction: linkInstruction, selectedUrl: internalLinkUrl } = await getLinkInstruction(
    internalLinks,
    heading,
    genAI,
    usedInternalLinks
  )
  let extLinkInstruction = ''

  if (activeSectionType === 'intro' || activeSectionType === 'buying_guide') {
    extLinkInstruction = settings.automaticExternalLinks
      ? getExternalLinkInstruction(externalLinks, usedExternalLinks)
      : '\nCRITICAL FORMATTING: Do NOT include or generate any external URLs or links in this section under any circumstances.'
  }

  const experienceInstruction = enableFirstHandExperience
    ? "CRITICAL: Write this review using strong first-hand experience. Use phrases like 'When I tested this...', 'In my hands-on experience...', and 'What I noticed right away...'. Speak as an expert who has physically unboxed and used the item."
    : 'Write this review from an objective, expert standpoint based on specifications, features, and market consensus.'

  const activeSEOKeyword = targetKeyword || articleTitle || heading
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword)
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `

  let topPicksTable = ''
  let matchedProduct = null

  let sectionPrompt = `
    Article Title Context: ${articleTitle || targetKeyword}
    Full Article Outline Context: ${JSON.stringify(outlineContext)}
    Current Heading: ${activeHeadingText}

    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
    ${linkInstruction}
    ${extLinkInstruction}
    ${keywordSEOInstructions}
  `

  if (activeSectionType === 'intro') {
    const top3 = formattedProducts.slice(0, 3)

    const linkOptions = {
      language: settings.language,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
    }

    topPicksTable = settings.roundupLayout === 'top-pick'
      ? renderTopPickCards(formattedProducts, linkOptions)
      : renderResponsiveTable({
          headers: ['Image', 'Product', 'Link'],
          rows: top3.map(p => {
            const safeTitle = escapeHtml(String(p.productName || '').replace(/[\r\n]+/g, ' '))
            const safeImageUrl = escapeHtml(String(p.imageUrl || '').replace(/_/g, '%5F'))
            const altText = escapeHtml(`${targetKeyword || ''} ${p.productName || ''}`.trim())
            const button = buildCheckPriceButton(p.amazonUrl, { ...linkOptions, asin: p.asin })
            return [`<img src="${safeImageUrl}" alt="${altText}" title="${safeTitle}" style="width:80px;height:80px;max-width:100%;object-fit:contain;border-radius:8px;" />`, safeTitle, button]
          })
        })

    sectionPrompt += settings.roundupLayout === 'top-pick'
      ? `TASK: Write an engaging introduction for "${targetKeyword}". Follow it with these ranked product cards; do not add a product table:\n${topPicksTable}`
      : `TASK: Write a strong, engaging introduction for the keyword "${targetKeyword}". Immediately following your introductory paragraphs, include this Product Table:\n### Our Top 3 Picks\n${topPicksTable}`
  } else if (activeSectionType === 'product') {
    const cleanHeading = activeHeadingText
      .replace(/^\d+\.\s*/, '')
      .toLowerCase()
      .trim()

    const product =
      formattedProducts.find(p => {
        const pName = p.productName.toLowerCase()

        return cleanHeading.includes(pName) || pName.includes(cleanHeading)
      }) || formattedProducts[0]

    matchedProduct = product

    sectionPrompt += `
      TASK: Write a comprehensive product review for "${product.productName}".
      CRITICAL: Start writing directly from the review body paragraphs. Do NOT output a heading or title for the product, as the editor handles this automatically.
      ${experienceInstruction}

      PRODUCT CONTEXT (DO NOT INVENT PRICING):
      - Title: ${product.productName}
      - Price: ${product.price}

      STRICT LAYOUT REQUIREMENT:
      Format this section EXACTLY in this order:
      1. **Review:** 2-3 engaging paragraphs reviewing the product.
      2. **HTML Image:** Insert this EXACT HTML centered:
         <div align="center" style="margin: 25px 0;">
            <img src="${product.imageUrl}" alt="${targetKeyword} ${product.productName}" title="${product.productName}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.05);" />
          </div>
      3. **Features:** A bulleted list of 3-4 key features.
      4. **Pros & Cons Table:** A strictly formatted Markdown table with exactly two columns titled "Pros" and "Cons".
      5. **Real Buyer Opinions:** A brief summary of what real buyers think. CRITICAL: You must synthesize this summary directly from the "Official Features" provided above. Frame the feedback around how buyers react to those specific attributes (e.g., if a feature highlights 'lightweight design', mention how users praise its portability).
      6. **CTA Button:** Insert this EXACT HTML. Do not change the link or the label:
         <div class="affigenie-cta" style="display:block;width:100%;max-width:100%;text-align:center;margin:25px 0;">
           ${buildCheckPriceButton(product.amazonUrl, {
             language: settings.language,
             asin: product.asin,
             domain: settings.amazonDomain || 'www.amazon.com',
             partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
           })}
         </div>
    `
  } else if (activeSectionType === 'faq') {
    sectionPrompt += `
      TASK: Write a comprehensive FAQ section containing 4 to 6 commonly asked questions regarding "${targetKeyword}".

      STRICT REQUIREMENT (Schema Markup):
      You MUST wrap the questions and answers in valid JSON-LD FAQPage schema markup. Place the schema inside a <script type="application/ld+json"> tag at the very end of the section. Do NOT use markdown code blocks around the script tag.
    `
  } else {
    sectionPrompt += `
      TASK: Write a comprehensive section for "${activeHeadingText}". Ensure the formatting is clean, engaging, and directly answers the user's intent.
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

  if (activeSectionType === 'intro' && typeof topPicksTable === 'string' && topPicksTable) {
    if (settings.roundupLayout === 'top-pick') {
      text = text.replace(/<table\b[\s\S]*?<\/table>/gi, '')
      if (!/affigenie-product-cards/i.test(text)) text += `\n\n${topPicksTable}`
    } else if (!/<table[\s>]/i.test(text)) {
      text += `\n\n${topPicksTable}`
    }
  }

  if (activeSectionType === 'product' && matchedProduct?.amazonUrl) {
    text = withRequiredCheckPrice(text, {
      url: matchedProduct.amazonUrl,
      asin: matchedProduct.asin,
      language: settings.language,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''
    })
  }

  return { success: true, text, mediaHtml: null, internalLinkUrl: internalLinkUrl }
}

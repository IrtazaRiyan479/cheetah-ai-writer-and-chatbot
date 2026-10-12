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
  fetchSerperOutlineData
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'
import { buildCheckPriceButton, extractAsin, withRequiredCheckPrice } from '../utils/articleHtml'

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

const ARTICLE_TYPE_MARKER = 'affigenie-article-type'

export function detectSourceArticleType(htmlOrText = '') {
  const source = String(htmlOrText || '')
  const marker = source.match(/data-affigenie-type=["']([^"']+)["']/i) || source.match(/affigenie-article-type:([a-z0-9-]+)/i)
  if (marker?.[1]) return marker[1].toLowerCase()

  const amazonLinks = (source.match(/https?:\/\/(?:www\.)?(?:amazon\.[^\s)"'<>]+|amzn\.to\/[^\s)"'<>]+)/gi) || []).length
  const hasProsCons = /\bpros\b[\s\S]{0,40}\bcons\b/i.test(source)
  const hasTopPick = /top pick|our top \d|product table/i.test(source)
  const productHeadings = (source.match(/<h2[^>]*>\s*\d+\./gi) || []).length

  if (amazonLinks >= 3 || hasTopPick || productHeadings >= 3) return 'amazon-roundup'
  if (amazonLinks >= 1 && hasProsCons) return 'amazon-review'
  return 'standard'
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

  const articleData = await fetchArticleData(articleUrlToRewrite)

  if (!articleData.success) {
    throw new Error('Failed to fetch the target article. Please check the URL and try again.')
  }

  const sourceText = articleData.text || ''
  const detectedType = detectSourceArticleType(sourceText)
  if (settings.type === 'amazon-roundup-rewrite' && detectedType === 'amazon-review') {
    throw new Error('This URL looks like a single-product Amazon review. Use "Amazon review rewrite" instead of "Amazon roundup rewrite".')
  }
  if (settings.type === 'amazon-review-rewrite' && detectedType === 'amazon-roundup') {
    throw new Error('This URL looks like an Amazon roundup. Use "Amazon roundup rewrite" instead of "Amazon review rewrite".')
  }

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
        ? '6. Reshape this into an Amazon product ROUNDUP (multiple products). Use sectionType "intro", then one "product" H2 per product found in the source, then "conclusion". Put productName and the exact affiliate amazonUrl on each product item. Never strip affiliate tags. Do NOT produce a single-product review layout.'
        : settings.type === 'amazon-review-rewrite'
          ? '6. Reshape this into an Amazon SINGLE-PRODUCT review only. sectionType must be intro, features, pros_cons, conclusion, or faq, in that order. Preserve the affiliate URL exactly. Do NOT create multiple product H2 sections or a roundup table.'
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

  try {
    const jsonResult = JSON.parse(responseText)

    // Amazon rewrite hero: prefer a product image found in the source article
    if (isAmazonRewriteType(settings.type) && !heroImageUrl) {
      const imgMatch = sourceText.match(/https?:\/\/[^\s)"']+(?:ssl-images-amazon|images-amazon|m\.media-amazon)[^\s)"']+/i)
      if (imgMatch?.[0]) {
        heroImageUrl = imgMatch[0]
        heroImageSource = 'source-amazon'
      }
    }

    // For single-product review rewrite, force a single-product outline shape if the model drifted
    if (settings.type === 'amazon-review-rewrite' && Array.isArray(jsonResult.outline)) {
      const allowed = new Set(['intro', 'features', 'pros_cons', 'conclusion', 'faq', 'standard'])
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

  const articleData = await fetchArticleData(articleUrlToRewrite)
  const sourceText = articleData.text || ''

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
  let { mediaInstruction, assignedMediaElement, mediaUrl } = await getMediaInstruction(
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
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)
  let povInstruction = getPovInstruction(pointOfView)
  let readabilityInstruction = getReadabilityInstruction(improveReadability)

  const rewriteType = settings.type || 'rewrite'
  const typeLayout =
    rewriteType === 'amazon-review-rewrite'
      ? `SINGLE-PRODUCT REVIEW LAYOUT: Write only about one product. Do not list multiple competing products, roundup tables, or "top picks". Prefer review body, features, pros/cons, and verdict.`
      : rewriteType === 'amazon-roundup-rewrite'
        ? `ROUNDUP LAYOUT: This section may cover one product in a multi-product roundup. Keep product-focused structure. Do not collapse into a single long product review for unrelated items.`
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

  if (settings.type === 'amazon-review-rewrite') {
    text = text
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
      .replace(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/\S+/gi, '')
    assignedMediaElement = ''
    mediaUrl = null
    if (Number(sectionIndex) === 1) {
      const img = String(sourceText || '').match(/https?:\/\/[^\s)"']+(?:ssl-images-amazon|images-amazon|m\.media-amazon)[^\s)"']+/i)
      if (img?.[0] && !text.includes(img[0])) {
        text += `\n\n<figure style="margin:24px 0;text-align:center;"><img src="${img[0]}" alt="${String(targetKeyword || 'Product').replace(/"/g, '')}" style="max-width:480px;width:100%;height:auto;border-radius:12px;" /></figure>`
      }
    }
  }

  if (isAmazonRewriteType(settings.type)) {
    text = withRequiredCheckPrice(text, amazonRewriteOptions(settings, sourceText, text))
  }

  return {
    success: true,
    text,
    mediaHtml: assignedMediaElement,
    mediaUrl: mediaUrl,
    internalLinkUrl: internalLinkUrl
  }
}

import { GoogleGenAI } from '@google/genai'

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
  fetchUnsplashImage,
  fetchPexelsImage,
  fetchPixabayImage,
  calculateRelevanceScore,
  generateFallbackImage
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'

export async function generateStandardBlogOutline(body, genAI) {
  const { prompt, settings } = body

  const {
    model,
    targetKeyword,
    language,
    country,
    articleLength,
    customArticleLength,
    automaticExternalLinks,
    includeFaq,
    includeKeyTakeaways
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging, SEO-optimized article outline. You MUST return a strictly formatted JSON object with four keys: "metaTitle", "metaDescription", "title", and "outline".\n\nSchema MUST strictly follow this exact structure:\n{\n  "metaTitle": "An SEO-optimized title tag (max 60 characters)",\n  "metaDescription": "A compelling SEO meta description (max 160 characters)",\n  "title": "A catchy, click-worthy H1 Title",\n  "outline": [\n    { "type": "h2", "text": "..." },\n    { "type": "h3", "text": "..." }\n  ]\n}\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  })

  let lengthInstruction = ''

  if (articleLength === 'default') lengthInstruction = 'Generate exactly 6 main H2 headings.'
  else if (articleLength === 'shorter') lengthInstruction = 'Generate exactly 3 main H2 headings.'
  else if (articleLength === 'short') lengthInstruction = 'Generate exactly 5 main H2 headings.'
  else if (articleLength === 'medium') lengthInstruction = 'Generate exactly 7 main H2 headings.'
  else if (articleLength === 'long') lengthInstruction = 'Generate exactly 9 main H2 headings.'
  else if (articleLength === 'longer') lengthInstruction = 'Generate exactly 12 main H2 headings.'
  else if (articleLength === 'custom')
    lengthInstruction = `Generate EXACTLY ${customArticleLength || 9} main H2 headings.`

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

  let structureInstruction = `
    IMPORTANT STRUCTURE RULES:
    1. The FIRST H2 heading MUST be an Introduction.
    ${takeawaysInstruction}
    2. The LAST H2 heading MUST be a Conclusion.
    ${faqInstruction}
    3. For ALL OTHER H2 headings, nest 2 to 3 relevant H3 subheadings.
    ${relatedInstruction}
  `

  const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`

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

      const isRateLimit =
        /429|rate.?limit|quota|resource.?exhausted|503|high demand|unavailable|overloaded|try again later/i.test(msg)

      if (isRateLimit) {
        console.warn('[Outline] Gemini quota — using Groq/Mistral')

        const alt = await callLightLLM({
          system: 'Return only valid JSON with keys metaTitle, metaDescription, title, outline.',
          prompt:
            outlinePrompt +
            '\n\nReturn JSON: {"metaTitle":"","metaDescription":"","title":"","outline":[{"type":"h2","text":""}]}',
          json: true,
          max_tokens: 1200
        })

        const parsed = parseJsonSafe(alt?.text)

        if (parsed?.outline?.length) {
          parsedData = parsed
          break
        }

        throw new Error('RATE_LIMIT: Gemini and Groq could not produce an outline. Wait ~60s.')
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
  let fallbackToAiImageTag = false
  let scoredCandidates = []

  if (candidates.length > 0) {
    scoredCandidates = candidates.map(c => ({
      ...c,
      score: calculateRelevanceScore(c.alt || '', targetKeyword, targetKeyword)
    }))

    scoredCandidates.sort((a, b) => b.score - a.score)

    const best = scoredCandidates[0]
    const MIN_HERO = 3.5

    if (best && best.score >= MIN_HERO) {
      heroImageUrl = best.url
      console.log(
        `[Hero Image] Selected ${best.source} score=${best.score.toFixed(2)} alt="${(best.alt || '').slice(0, 60)}"`
      )
    } else {
      console.log(`[Hero Image] Best score ${best ? best.score.toFixed(2) : 0} < ${MIN_HERO}. Using AI fallback.`)
      fallbackToAiImageTag = true
    }
  } else {
    fallbackToAiImageTag = true
  }

  if (fallbackToAiImageTag) {
    const safetyBackup = scoredCandidates.length > 0 ? scoredCandidates[0].url : ''

    try {
      const fallbackImage = await generateFallbackImage(
        `High quality photorealistic landscape photograph of ${targetKeyword}, subject clearly visible, no text, no watermark`
      )

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
    externalLinks: fetchedExternalLinks,
    heroImage: heroImageUrl,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription
  }
}

export async function generateStandardBlogSection(body, genAI) {
  const {
    outlineContext,
    heading,
    subheadings,
    sectionIndex,
    uploadedMedia,
    externalLinks,
    internalLinks,
    usedImageUrls = [],
    usedExternalLinks = [],
    usedInternalLinks = [],
    settings = {}
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
    country,
    language
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const modelConfig = {
    model: model || 'gemini-3.1-flash-lite',
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search'

  const lowerHeading = String(heading || '').toLowerCase()

  const skipTools =
    lowerHeading.includes('faq') ||
    lowerHeading.includes('frequently asked') ||
    lowerHeading.includes('conclusion') ||
    lowerHeading.includes('final verdict')

  if (useRealTimeSearchData && isWebSearch && !deepSearch && !skipTools) {
    modelConfig.tools = [{ googleSearch: {} }]
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig)

  const [
    realTimeInstruction,
    seoInstruction,
    { mediaInstruction, assignedMediaElement, mediaUrl },
    lsiData,
    { instruction: linkInstruction, selectedUrl: internalLinkUrl }
  ] = await Promise.all([
    getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading),
    getSeoInstruction(seoOptimization, manualKeywords, targetKeyword),
    getMediaInstruction(
      uploadedMedia,
      sectionIndex,
      aiImagesAndVideos,
      articleTitle,
      targetKeyword,
      heading,
      genAI,
      usedImageUrls,
      settings
    ),
    fetchPeopleAlsoSearchFor(targetKeyword),
    getLinkInstruction(internalLinks, heading, genAI, usedInternalLinks)
  ])

  let extLinkInstruction = settings.automaticExternalLinks
    ? getExternalLinkInstruction(externalLinks, usedExternalLinks)
    : '\nCRITICAL FORMATTING: Do NOT include or generate any external URLs or links in this section under any circumstances.'
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)
  let povInstruction = getPovInstruction(pointOfView)
  let readabilityInstruction = getReadabilityInstruction(improveReadability)
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`

  let sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (STANDARD MODE):
          1. You MUST first write a strong introductory paragraph directly under the main heading "${heading}". Do not leave it blank!
          ${subheadings && subheadings.length > 0 ? `2. After the intro, cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
        `

  const sectionPrompt = `
        Article Title/Context: ${articleTitle || targetKeyword}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

        CRITICAL SEO & FORMATTING REQUIREMENTS:
        - Target Keyword: "${targetKeyword}"
        - LSI / People Also Search For Keywords: [${lsiString}]

        1. KEYWORD PLACEMENT & BOLDING: You MUST include the exact Target Keyword naturally in this section. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. You MUST format the target keyword in bold (**${targetKeyword}**) every time it is used.
        2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section.
        3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).

        ${sectionStructureRequirements}
        ${realTimeInstruction}
        ${extLinkInstruction}
        ${linkInstruction}
        ${seoInstruction}
        ${mediaInstruction}
        ${toneInstruction}
        ${povInstruction}
        ${readabilityInstruction}
      `

  if (deepSearch) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_FREE_API_KEY })

    const interaction = await ai.interactions.create({
      agent: 'deep-research-preview-04-2026',
      input: `${baseSystemInstruction}\n\nYou are an expert researcher. Conduct a deep web search based on the following instructions. \n\nCRITICAL RULE: DO NOT output your research notes, search queries, or internal reasoning. Your FINAL output MUST strictly be the final, ready-to-publish Markdown text adhering exactly to the layout requirements provided below.\n\n---\n\n${sectionPrompt}`,
      background: true
    })

    return {
      success: true,
      isDeepSearch: true,
      interactionId: interaction.id,
      mediaHtml: assignedMediaElement,
      mediaUrl: mediaUrl,
      internalLinkUrl: internalLinkUrl
    }
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

  return {
    success: true,
    text: result.response.text(),
    mediaHtml: assignedMediaElement,
    mediaUrl: mediaUrl,
    internalLinkUrl: internalLinkUrl
  }
}

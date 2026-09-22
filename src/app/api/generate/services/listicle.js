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
  fetchUnsplashImage,
  fetchPexelsImage,
  fetchPixabayImage,
  calculateRelevanceScore,
  fetchPeopleAlsoSearchFor,
  generateFallbackImage
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'

export async function generateListicleOutline(body, genAI) {
  const { settings } = body

  const {
    model,
    targetKeyword,
    language,
    country,
    automaticExternalLinks,
    includeFaq,
    enableAutoLength,
    totalListItems,
    listNumberingFormat,
    useDescendingOrder,
    enableSupplementalInformation
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  })

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

  const itemCount = enableAutoLength ? 10 : parseInt(totalListItems) || 10
  const format = listNumberingFormat || '1.'

  let numberingArray = []

  for (let i = 1; i <= itemCount; i++) {
    numberingArray.push(format === 'none' ? '' : format.replace('1', i))
  }

  if (useDescendingOrder) numberingArray.reverse()

  const explicitNumberingStr =
    format === 'none'
      ? 'Do not use numbering.'
      : `Use EXACTLY these prefixes in this order for your list items: ${numberingArray.join(', ')}`

  let lengthInstruction = `CRITICAL REQUIREMENT: Generate exactly ${itemCount} list items.`
  let structureInstruction = `
          === STRICT LISTICLE STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next ${itemCount} H2 headings MUST be the core list items/products.
             - ${explicitNumberingStr}
             ${!enableAutoLength ? '- CRITICAL: Do NOT nest any H3 subheadings under these list items.' : ''}
          3. ${enableAutoLength ? 'After the list items, add exactly TWO additional H2 informational sections (e.g., "Buying Guide"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${enableSupplementalInformation ? 'At the very end, add an H2 heading titled "Supplemental Information" with nested H3 subheadings.' : ''}
          5. ${includeFaq ? faqInstruction : ''}
          6. ${relatedInstruction}
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
      const isRateLimit = /429|rate.?limit|quota|resource.?exhausted/i.test(msg)

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

      const alt = await callLightLLM({
        system: 'Reply with valid JSON only. No markdown.',
        json: true,
        max_tokens: 1200,
        waitOn429: true,
        prompt: outlinePrompt // same prompt you send Gemini
      })

      const parsed = parseJsonSafe(alt?.text)

      if (parsed?.outline || Array.isArray(parsed)) {
        // normalize to your outline shape and return success
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

    if (scoredCandidates[0].score >= 2.0) {
      heroImageUrl = scoredCandidates[0].url
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
    externalLinks: fetchedExternalLinks,
    heroImage: heroImageUrl,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription
  }
}

export async function generateListicleSection(body, genAI) {
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
    listItemPrompt,
    language,
    country
  } = settings

  const isCoreListItem = !subheadings || subheadings.length === 0
  const listPromptInject = isCoreListItem && listItemPrompt ? `\nSPECIAL LIST ITEM REQUIREMENT: ${listItemPrompt}` : ''

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const modelConfig = {
    model: deepSearch ? 'deep-research-preview-04-2026' : model || 'gemini-3.5-flash',
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search'

  if (useRealTimeSearchData && isWebSearch) {
    modelConfig.tools = [
      {
        googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.3 } }
      }
    ]
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig)

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
  let sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (LISTICLE MODE):
          1. You are writing content strictly for the heading: "${heading}".
          2. Do NOT add an introduction paragraph before your subheadings if you have subheadings. Go straight to the content.
          ${subheadings && subheadings.length > 0 ? `3. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : '3. Do NOT add any H3 subheadings. Write the content directly under the main heading.'}
          ${listPromptInject}
        `

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

  const sectionPrompt = `
        Article Title/Context: ${articleTitle || targetKeyword}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".
        ${sectionStructureRequirements}
        ${realTimeInstruction}
        ${extLinkInstruction}
        ${linkInstruction}
        ${seoInstruction}
        ${mediaInstruction}
        ${toneInstruction}
        ${povInstruction}
        ${readabilityInstruction}
        ${keywordSEOInstructions}
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
      max_tokens: 1400
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

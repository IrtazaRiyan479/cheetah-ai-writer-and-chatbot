import {
  getLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchPeopleAlsoSearchFor
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'
import { fetchYoutubeVideoData, youtubeSectionPlan } from '../utils/youtubeCaptions'

function h2Count(outline) {
  return (Array.isArray(outline) ? outline : []).filter(item => String(item?.type || '').toLowerCase() === 'h2').length
}

function h3Count(outline) {
  return (Array.isArray(outline) ? outline : []).filter(item => String(item?.type || '').toLowerCase() === 'h3').length
}

/** Coerce model quirks: h1 -> h2, missing type -> h2, drop empty rows. */
function normalizeOutline(outline) {
  if (!Array.isArray(outline)) return []

  return outline
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const text = String(item.text || item.title || item.heading || '').trim()

      if (!text) return null
      let type = String(item.type || 'h2').toLowerCase()

      if (type === 'h1' || type === 'heading' || type === 'title') type = 'h2'
      if (type !== 'h2' && type !== 'h3') type = 'h2'

      return { ...item, type, text }
    })
    .filter(Boolean)
}

function sourceUnderstandingInstruction(source) {
  const automatic = /asr|gemini|timedtext|youtube-transcript/i.test(String(source || ''))

  if (automatic) {
    return 'The source text is automatic speech recognition, not a finished article. It mishears names, numbers, and mixed languages. Use it only to understand what the video says. Recover the intended meaning. Do not copy broken lines, filler, or repeated caption text into the article.'
  }

  return 'The source text is the video subtitles. Use it to understand what was said, then write the article from that understanding. Do not paste the subtitle lines as the article.'
}

function captionRewriteInstruction(enabled, where) {
  if (enabled) {
    return where === 'outline'
      ? 'VIDEO ORDER: The article follows the video from start to finish. Turn what was said into clean prose, in the same order, with the same facts, names, and numbers. Do not add outside information. Do not shrink a long video into a short recap. Do not paste captions.'
      : 'VIDEO ORDER: Rewrite only what was said under this heading into clean article prose. Keep the video order, facts, names, and numbers. Do not add outside information, do not recap the whole video, and do not paste caption lines.'
  }

  return where === 'outline'
    ? 'FRESH POST: Write a standalone blog from your understanding of the video. You may reorder it for readability, but cover the video from start to finish and keep the article about as long as the video. Do not treat the source text as a script to paraphrase line by line.'
    : 'FRESH POST: Write this section as standalone blog prose from what the video actually says. Cover only this heading. Do not add facts that are not in the video, do not recap the whole video, and do not paste caption lines.'
}

export async function generateYoutubeBlogOutline(body, genAI) {
  const { prompt, settings } = body
  const { model, targetKeyword, language, country, youtubeUrl, enableCaptionRewriting } = settings
  const cachedTranscript = String(settings.fetchedTranscript || '').trim()

  const videoData =
    cachedTranscript.length > 40
      ? {
          success: true,
          title: settings.fetchedVideoTitle || '',
          thumbnail: settings.youtubeThumbnail || '',
          transcript: cachedTranscript,
          durationSeconds: Number(settings.youtubeDurationSeconds) || 0,
          videoId: settings.youtubeVideoId || ''
        }
      : await fetchYoutubeVideoData(youtubeUrl)

  if (!videoData.success) {
    throw new Error(
      videoData.error || 'Could not fetch captions. The video might be private, age-restricted, or missing subtitles.'
    )
  }

  const transcript = videoData.transcript || videoData.text || ''
  const transcriptSource = videoData.source || settings.youtubeTranscriptSource || ''
  const videoTitle = videoData.title || settings.fetchedVideoTitle || 'YouTube Video'
  const durationSeconds = Number(videoData.durationSeconds || settings.youtubeDurationSeconds) || 0
  const plan = youtubeSectionPlan(durationSeconds, transcript)

  const thumbnail =
    videoData.thumbnail ||
    settings.youtubeThumbnail ||
    (videoData.videoId ? `https://i.ytimg.com/vi/${videoData.videoId}/hqdefault.jpg` : '')

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- Produce ${plan.minH2} to ${plan.maxH2} H2 sections. Never fewer than ${plan.minH2}.`
  })

  const outlinePrompt = `
    Target Keyword/Topic: ${targetKeyword || prompt}
    Original Video Title: ${videoTitle}
    Video length: ${plan.minutes} minutes (${durationSeconds || 'unknown'} seconds), about ${plan.sourceWords} spoken words.

    Video source (${transcriptSource || 'subtitles'}):
    ${transcript.substring(0, 200000)}

    ${sourceUnderstandingInstruction(transcriptSource)}

    TASK: Create a comprehensive blog post outline from what the video actually says.
    CRITICAL EXECUTION INSTRUCTIONS:
    1. Understand the video from the source text, then outline that understanding. The source is evidence of what was said, not the article itself.
    2. Do not invent facts, names, or numbers the video did not give. If a line is garbled, use the surrounding meaning instead of copying it.
    3. Cross-Lingual Adaptation: If the source is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
    4. Granular Detail Extraction: Mine the source for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.
    ${captionRewriteInstruction(enableCaptionRewriting, 'outline')}

    CRITICAL STRUCTURE REQUIREMENTS:
    1. Length: The finished article must be about ${plan.targetWords} words so it matches the video. A long video must become a long article. A short video must still be divided into ${plan.minH2} to ${plan.maxH2} H2 sections, even when each section is short. Never return fewer than ${plan.minH2} H2 objects.
    2. Depth / sub-headings — REQUIRED for every outline:
       - Use type "h2" for main sections and type "h3" for sub-headings under those sections.
       - You MUST include H3 sub-headings. Target about ${Math.max(2, Math.floor(plan.minH2 / 2))} to ${Math.max(plan.minH2, plan.maxH2)} total H3 items across the outline.
       - At least half of the H2 sections (except a short conclusion H2) must be followed immediately by 1 to ${Math.max(1, plan.h3max)} H3 objects.
       - Correct flat order example: {"type":"h2","text":"..."}, {"type":"h3","text":"..."}, {"type":"h3","text":"..."}, {"type":"h2","text":"..."}, {"type":"h3","text":"..."}, {"type":"h2","text":"..."}
       - Never output type "h1" inside the outline array. The H1 is only the top-level "title" field.
       - Do not put all headings as h2. Mixing h2 + h3 is mandatory.
    3. Coverage: The H2s together must walk through the transcript from beginning to end, including the ending of a long video.
    4. Flatness: Keep the JSON array flat (no nesting). H3 items sit after their parent H2 in sequence.
  `

  let parsedData = null
  let best = null
  let lastOutlineError = null

  const acceptCandidate = candidate => {
    if (candidate && Array.isArray(candidate.outline)) {
      candidate = { ...candidate, outline: normalizeOutline(candidate.outline) }
    }

    const count = h2Count(candidate?.outline)
    const subCount = h3Count(candidate?.outline)

    if (
      !best ||
      count > h2Count(best.outline) ||
      (count === h2Count(best.outline) && subCount > h3Count(best.outline))
    ) {
      best = candidate
    }

    if (count < plan.minH2) {
      throw new Error(`Outline had ${count} H2 sections; need at least ${plan.minH2}`)
    }

    const minH3 = Math.max(2, Math.floor(count / 2))

    if (subCount < minH3) {
      throw new Error(
        `Outline had only ${subCount} H3 sub-headings (need at least ${minH3}); pure H2 lists are rejected`
      )
    }

    parsedData = candidate
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await outlineModel.generateContent(outlinePrompt)

      acceptCandidate(JSON.parse(result.response.text()))
      break
    } catch (err) {
      lastOutlineError = err
      const msg = String(err?.message || err)

      const isCapacity =
        /429|rate.?limit|quota|resource.?exhausted|503|high demand|unavailable|overloaded|try again later/i.test(msg)

      if (isCapacity) {
        console.warn('[Outline] Gemini quota/high demand — using Groq/Mistral')

        const alt = await callLightLLM({
          system: `Return only valid JSON with keys metaTitle, metaDescription, title, outline. Include ${plan.minH2} to ${plan.maxH2} H2 items AND multiple H3 sub-headings (type h3 after their parent h2). Never return only h2. No markdown.`,
          prompt:
            outlinePrompt +
            `\n\nReturn JSON: {"metaTitle":"","metaDescription":"","title":"","outline":[{"type":"h2","text":""},{"type":"h3","text":""}]}\nThe outline must contain at least ${plan.minH2} objects with type h2. For videos over 8 minutes include multiple type h3 sub-headings after their parent h2.`,
          json: true,
          max_tokens: Math.min(4000, 900 + plan.maxH2 * 180)
        })

        const parsed = parseJsonSafe(alt?.text)

        if (parsed?.outline?.length) {
          try {
            acceptCandidate(parsed)
            break
          } catch (countError) {
            lastOutlineError = countError
          }
        }

        throw new Error('RATE_LIMIT: Gemini and Groq could not produce an outline. Wait ~60s and try again.')
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt))
        continue
      }
    }
  }

  if (!parsedData && best && h2Count(best.outline) > 0) parsedData = best

  if (!parsedData) {
    throw new Error(
      `OUTLINE_PARSE_FAILED: Could not produce a valid outline. ${lastOutlineError?.message || ''}`.trim()
    )
  }

  console.info('[Outline] youtube-blog structure', {
    minutes: plan.minutes,
    h2: h2Count(parsedData.outline),
    h3: h3Count(parsedData.outline),
    types: (parsedData.outline || []).map(item => item?.type),
    texts: (parsedData.outline || []).map(item => String(item?.text || '').slice(0, 40))
  })

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    fetchedTranscript: transcript,
    fetchedVideoTitle: videoTitle,
    youtubeDurationSeconds: durationSeconds,
    youtubeThumbnail: thumbnail,
    youtubeVideoId: videoData.videoId || settings.youtubeVideoId || '',
    youtubeTranscriptSource: transcriptSource,
    heroImage: thumbnail,
    heroImageId: videoData.videoId || settings.youtubeVideoId || null,
    heroImageSource: 'youtube-thumbnail',
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription
  }
}

export async function generateYoutubeBlogSection(body, genAI) {
  const {
    outlineContext,
    heading,
    subheadings,
    fetchedTranscript,
    fetchedVideoTitle,
    settings = {},
    externalLinks,
    internalLinks,
    usedInternalLinks = [],
    sectionIndex = 0,
    totalSections = 0
  } = body

  let transcriptText = fetchedTranscript || settings.fetchedTranscript || ''
  let videoTitle = fetchedVideoTitle || settings.fetchedVideoTitle || ''
  let durationSeconds = Number(settings.youtubeDurationSeconds) || 0
  let transcriptSource = settings.youtubeTranscriptSource || ''

  if (transcriptText.trim().length < 40 && settings.youtubeUrl) {
    const videoData = await fetchYoutubeVideoData(settings.youtubeUrl)

    if (videoData?.transcript) transcriptText = videoData.transcript
    if (videoData?.source) transcriptSource = videoData.source
    if (!videoTitle && videoData?.title) videoTitle = videoData.title
    if (!durationSeconds && videoData?.durationSeconds) durationSeconds = videoData.durationSeconds

    if (transcriptText.trim().length < 40) {
      throw new Error(videoData?.error || 'Could not fetch captions for this video.')
    }
  }

  const {
    model,
    targetKeyword,
    toneOfVoice,
    customToneOfVoice,
    pointOfView,
    useRealTimeSearchData,
    realTimeDataSource,
    seoOptimization,
    manualKeywords,
    improveReadability,
    enableCaptionRewriting,
    deepSearch,
    language,
    country
  } = settings

  const plan = youtubeSectionPlan(durationSeconds, transcriptText)
  const sectionTotal = Number(totalSections) || h2Count(outlineContext) || plan.minH2
  const sectionWords = Math.max(40, Math.round(plan.targetWords / sectionTotal))

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const modelConfig = {
    model: deepSearch ? 'deep-research-preview-04-2026' : model || 'gemini-2.5-pro',
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

  let { instruction: linkInstruction, selectedUrl: internalLinkUrl } = await getLinkInstruction(
    internalLinks,
    heading,
    genAI,
    usedInternalLinks
  )
  let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword)

  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)
  let povInstruction = getPovInstruction(pointOfView)
  let readabilityInstruction = getReadabilityInstruction(improveReadability)

  let sectionStructureRequirements = `
          CRITICAL STRUCTURE & FORMATTING REQUIREMENTS:
          1. DO NOT output the H2 heading "${heading}" as text in your response. Start immediately with a strong, engaging introductory paragraph for this section.
          ${subheadings && subheadings.length > 0 ? `2. You MUST cover the following subheadings exactly as Markdown H3s (### [Title]):\n${subheadings.join('\n')}` : '2. Write the content directly without adding any new H3 subheadings.'}
          3. Format beautifully: Use bolding (**text**) for key terms, use bulleted lists for data, and keep paragraphs short (2-4 sentences max) for high web readability.
          4. This is section ${Number(sectionIndex) + 1} of ${sectionTotal}. Write about ${sectionWords} words for this section. The full article is about ${plan.targetWords} words because the video is ${plan.minutes} minutes (${plan.sourceWords} spoken words). Do not summarize the entire video in this section.
        `

  const activeSEOKeyword = targetKeyword || settings.generatedTitle || heading
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
        Article Topic Context: ${targetKeyword}
        Original Video Title: ${videoTitle || 'YouTube Video'}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        SOURCE VIDEO (${transcriptSource || 'subtitles'}):
        ${transcriptText ? transcriptText.substring(0, 200000) : 'No transcript provided.'}

        ${sourceUnderstandingInstruction(transcriptSource)}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".
        CRITICAL EXECUTION INSTRUCTIONS:
        1. Understand the video from the source text, then write this section from that understanding. The source is evidence of what was said, not the article itself.
        2. Do not invent facts, names, or numbers the video did not give. If a line is garbled, use the surrounding meaning instead of copying it.
        3. Cross-Lingual Adaptation: If the source is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
        4. Granular Detail Extraction: Mine the source for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.
        5. Length match: This video is ${plan.minutes} minutes. A long video must produce a long article across all sections. This section should be about ${sectionWords} words and must use only the material that belongs under "${heading}".

        ${captionRewriteInstruction(enableCaptionRewriting, 'section')}
        ${keywordSEOInstructions}
        ${sectionStructureRequirements}
        ${linkInstruction}
        ${seoInstruction}
        ${toneInstruction}
        ${povInstruction}
        ${readabilityInstruction}
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
      prompt: sectionPrompt.slice(0, 12000),
      max_tokens: Math.min(2200, Math.max(500, sectionWords * 2)),
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

  return { success: true, text: result.response.text(), internalLinkUrl: internalLinkUrl }
}

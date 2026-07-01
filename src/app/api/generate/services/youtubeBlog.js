import {
  getLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchYoutubeVideoData,
  fetchUnsplashImage, fetchPexelsImage, fetchPixabayImage, calculateRelevanceScore
 ,fetchPeopleAlsoSearchFor, generateFallbackImage } from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateYoutubeBlogOutline(body, genAI) {
  const { prompt, settings } = body;
  const {
    model, targetKeyword, language, country, youtubeUrl, enableCaptionRewriting } = settings;

  const videoData = await fetchYoutubeVideoData(youtubeUrl);
  if (!videoData.success) {
    throw new Error('Failed to fetch YouTube transcript. The video might be private or lacking captions.');
  }

  const transcript = videoData.transcript || videoData.text || '';
  const videoTitle = videoData.title || 'YouTube Video';

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
  systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  });

  // 2. Handle "Enable Rewriting" Logic based on the UI toggle name
  const rewriteInstruction = enableCaptionRewriting
    ? `REWRITING ENABLED: Use the video transcript as your core inspiration, but creatively restructure it into a standalone, highly engaging blog post. You do not need to follow the video's exact chronological order. Add logical headings that make it a better reading experience.`
    : `STRICT ADHERENCE: Closely follow the chronological flow, exact arguments, and structure of the video. Your outline should act as a direct text adaptation of the video's timeline.`;

  const outlinePrompt = `
    Target Keyword/Topic: ${targetKeyword || prompt}
    Original Video Title: ${videoTitle}

    Video Transcript for Context:
    ${transcript.substring(0, 200000)}

    TASK: Create a comprehensive blog post outline based STRICTLY on the content of the provided transcript.
    CRITICAL EXECUTION INSTRUCTIONS:
    1. Strict Source Grounding: Your content MUST be strictly grounded in the provided source video transcript. Extract facts, numbers, and context entirely from the transcript. Do not invent outside information.
    2. Cross-Lingual Adaptation: If the source transcript is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
    3. Granular Detail Extraction: Mine the transcript for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.
    ${rewriteInstruction}

    CRITICAL STRUCTURE REQUIREMENTS:
    1. Length: You MUST generate between 8 and 12 main H2 sections.
    2. Depth: For every H2, you MUST include 2 to 3 related H3 subheadings in the array to provide depth.
    3. Flatness: Keep the JSON array flat (no nesting).
  `;

  const result = await outlineModel.generateContent(outlinePrompt);
  const parsedData = JSON.parse(result.response.text());

  const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
      fetchUnsplashImage(targetKeyword),
      fetchPexelsImage(targetKeyword),
      fetchPixabayImage(targetKeyword)
    ]);

    let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url);
    let heroImageUrl = '';
    let fallbackToAiImageTag = false;
    let scoredCandidates;

    if (candidates.length > 0) {
      scoredCandidates = candidates.map(c => ({
        ...c,
        score: calculateRelevanceScore(c.alt || '', targetKeyword, targetKeyword)
      }));

      scoredCandidates.sort((a, b) => b.score - a.score);

      if (scoredCandidates[0].score >= 2.0) {
        heroImageUrl = scoredCandidates[0].url;
        console.log(`[Hero Image] Selected ${scoredCandidates[0].source} (Score: ${scoredCandidates[0].score})`);
      } else {
        console.log(`[Hero Image] Top image score (${scoredCandidates[0].score}) below 2.0. Invoking AI generation logic.`);
        fallbackToAiImageTag = true;
      }
    } else {
      fallbackToAiImageTag = true;
    }

    if (fallbackToAiImageTag) {
      const safetyBackup = scoredCandidates.length > 0 ? scoredCandidates[0].url : '';
      try { const fallbackImage =  await generateFallbackImage(`High quality, realistic photograph of ${targetKeyword}`);
    if (fallbackImage && fallbackImage.url) {
      heroImageUrl = fallbackImage.url;
      console.log(`[Hero Image] AI Fallback successful: ${heroImageUrl}`);
    } } catch(error) {
      heroImageUrl = safetyBackup;
      console.log(`[Hero Image] AI Fallback failed to generate a URL.`);
    }

      console.log(`[Hero Image] AI Generation Result: ${heroImageUrl ? 'Success' : 'Failed - Using Safety Backup'}`);
    }

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    fetchedTranscript: transcript,
    fetchedVideoTitle: videoTitle,
    heroImage: heroImageUrl,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription
  };
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
  } = body;

  let transcriptText = fetchedTranscript || '';

  const {
    model, targetKeyword, toneOfVoice, customToneOfVoice,
    pointOfView, useRealTimeSearchData, realTimeDataSource,
    seoOptimization, manualKeywords, improveReadability, enableCaptionRewriting, deepSearch, language, country
  } = settings;


  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const modelConfig = {
    model: deepSearch ? 'deep-research-preview-04-2026' : (model || 'gemini-2.5-pro'),
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search';
  if (useRealTimeSearchData && isWebSearch) {
    modelConfig.tools = [{
      googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } }
    }];
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig);

  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);

  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
  let povInstruction = getPovInstruction(pointOfView);
  let readabilityInstruction = getReadabilityInstruction(improveReadability);

let sectionStructureRequirements = `
          CRITICAL STRUCTURE & FORMATTING REQUIREMENTS:
          1. DO NOT output the H2 heading "${heading}" as text in your response. Start immediately with a strong, engaging introductory paragraph for this section.
          ${subheadings && subheadings.length > 0 ? `2. You MUST cover the following subheadings exactly as Markdown H3s (### [Title]):\n${subheadings.join('\n')}` : '2. Write the content directly without adding any new H3 subheadings.'}
          3. Format beautifully: Use bolding (**text**) for key terms, use bulleted lists for data, and keep paragraphs short (2-4 sentences max) for high web readability.
        `;

  const rewriteInstruction = enableCaptionRewriting
    ? `Approach this section as an expert author writing an original piece inspired by the video content. Add depth where necessary.`
    : `Extract and summarize the information exactly as it was presented in the video for this specific section. Do not add outside information.`;

  const activeSEOKeyword = targetKeyword || articleTitle || heading; // Fallback safely
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword);
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`;

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `;



  const sectionPrompt = `
        Article Topic Context: ${targetKeyword}
        Original Video Title: ${fetchedVideoTitle || 'YouTube Video'}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        SOURCE VIDEO TRANSCRIPT:
        ${transcriptText ? transcriptText.substring(0, 200000) : 'No transcript provided.'}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".
        CRITICAL EXECUTION INSTRUCTIONS:
        1. Strict Source Grounding: Your content MUST be strictly grounded in the provided source video transcript. Extract facts, numbers, and context entirely from the transcript. Do not invent outside information.
        2. Cross-Lingual Adaptation: If the source transcript is in a different language than the Target Output Language (${langName}), translate the core meaning and details accurately. Ensure the final output reads natively in ${langName}.
        3. Granular Detail Extraction: Mine the transcript for specific entities (names, prices, locations, material descriptions, direct quotes). Use these to make the section highly authentic.

        ${rewriteInstruction}
        ${keywordSEOInstructions}
        ${sectionStructureRequirements}
        ${linkInstruction}
        ${seoInstruction}
        ${toneInstruction}
        ${povInstruction}
        ${readabilityInstruction}
      `;

  let result;
  let retries = 5;
  let delay = 2000;

  for (let i = 0; i < retries; i++) {
    try {
      result = await sectionModel.generateContent(sectionPrompt);
      break;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }

      const errorMessage = error.message ? error.message.toLowerCase() : '';

      const is503 = error.status === 503 || errorMessage.includes('503');

      const isFetchFailed = errorMessage.includes('fetch failed') ||
                            errorMessage.includes('econnreset') ||
                            errorMessage.includes('etimedout');

      if (is503 || isFetchFailed) {
        console.warn(`[Gemini API] Transient Error (${is503 ? '503' : 'Fetch Failed'}). Retrying in ${delay / 1000} seconds... (Attempt ${i + 1} of ${retries})`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }

  return { success: true, text: result.response.text()};
}

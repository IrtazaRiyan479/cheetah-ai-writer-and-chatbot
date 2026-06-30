import {fetchSerperOutlineData, getLinkInstruction, getExternalLinkInstruction, getRealTimeInstruction, getReadabilityInstruction, getMediaInstruction, getSeoInstruction, getPovInstruction, getToneInstruction, getBaseSystemInstruction, fetchPeopleAlsoSearchFor, fetchUnsplashImage, fetchPexelsImage, fetchPixabayImage, calculateRelevanceScore, generateFallbackImage } from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { GoogleGenAI } from '@google/genai';

export async function generateStandardBlogOutline(body, genAI) {
  const { prompt, settings } = body;
    const {model, targetKeyword, language, country, articleLength, customArticleLength, automaticExternalLinks, includeFaq, includeKeyTakeaways
    } = settings;

    const langObj = languages ? languages[language] : null;
    const langName = langObj ? langObj.name : (language || 'English');
    const countryObj = countries ? countries.find(c => c.code === country) : null;
    const countryName = countryObj ? countryObj.name : (country || 'United States');
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
   systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging, SEO-optimized article outline. You MUST return a strictly formatted JSON object with four keys: "metaTitle", "metaDescription", "title", and "outline".\n\nSchema MUST strictly follow this exact structure:\n{\n  "metaTitle": "An SEO-optimized title tag (max 60 characters)",\n  "metaDescription": "A compelling SEO meta description (max 160 characters)",\n  "title": "A catchy, click-worthy H1 Title",\n  "outline": [\n    { "type": "h2", "text": "..." },\n    { "type": "h3", "text": "..." }\n  ]\n}\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  });


  let lengthInstruction = '';
  if (articleLength === 'default') lengthInstruction = 'Generate exactly 6 main H2 headings.';
  else if (articleLength === 'shorter') lengthInstruction = 'Generate exactly 3 main H2 headings.';
  else if (articleLength === 'short') lengthInstruction = 'Generate exactly 5 main H2 headings.';
  else if (articleLength === 'medium') lengthInstruction = 'Generate exactly 7 main H2 headings.';
  else if (articleLength === 'long') lengthInstruction = 'Generate exactly 9 main H2 headings.';
  else if (articleLength === 'longer') lengthInstruction = 'Generate exactly 12 main H2 headings.';
  else if (articleLength === 'custom') lengthInstruction = `Generate EXACTLY ${customArticleLength || 9} main H2 headings.`;

    let fetchedExternalLinks = [];
  let faqInstruction = '';
  let relatedInstruction = '';
  let takeawaysInstruction = '';

  if (automaticExternalLinks || includeFaq) {
    const outlineData = await fetchSerperOutlineData(targetKeyword);

    if (automaticExternalLinks) {
      fetchedExternalLinks = outlineData.authorityLinks;
    }

    if (includeFaq) {
        if (outlineData.faqs.length > 0) {
          faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled exactly "Frequently Asked Questions". Under this H2, you MUST nest exactly these questions directly from Google as H3 subheadings:\n${outlineData.faqs.slice(0, 5).map(q => `- ${q}`).join('\n')}`;
        } else {
          faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled "Frequently Asked Questions" and nest 3-5 highly relevant questions as H3 subheadings.`;
        }
    }

    if (outlineData.related.length > 0) {
        relatedInstruction = `\nSEO OPTIMIZATION: Naturally incorporate topics from these related Google searches into your H2 and H3 headings where relevant: ${outlineData.related.slice(0, 5).join(', ')}.`;
    }
  }


  if (includeKeyTakeaways) {
      takeawaysInstruction = `\nCRITICAL REQUIREMENT - KEY TAKEAWAYS: The second H2 heading (immediately after the Introduction) MUST be titled exactly "Key Takeaways". Do NOT nest any H3 subheadings under it.`;
  }

  let structureInstruction = `
    IMPORTANT STRUCTURE RULES:
    1. The FIRST H2 heading MUST be an Introduction.
    ${takeawaysInstruction}
    2. The LAST H2 heading MUST be a Conclusion.
    ${faqInstruction}
    3. For ALL OTHER H2 headings, nest 2 to 3 relevant H3 subheadings.
    ${relatedInstruction}
  `;

  const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`
  const result = await outlineModel.generateContent(outlinePrompt)
  const parsedData = JSON.parse(result.response.text());

  const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
    fetchUnsplashImage(targetKeyword),
    fetchPexelsImage(targetKeyword),
    fetchPixabayImage(targetKeyword)
  ]);

  let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url);
  let heroImageUrl = '';
  let fallbackToAiImageTag = false;

  if (candidates.length > 0) {
    const scoredCandidates = candidates.map(c => ({
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
    const fallbackImage = await generateFallbackImage(`High quality, realistic photograph of ${targetKeyword}`);
    if (fallbackImage && fallbackImage.url) {
      heroImageUrl = fallbackImage.url;
      console.log(`[Hero Image] AI Fallback successful: ${heroImageUrl}`);
    } else {
      heroImageUrl = safetyBackup;
      console.log(`[Hero Image] AI Fallback failed to generate a URL.`);
    }

    console.log(`[Hero Image] AI Generation Result: ${heroImageUrl ? 'Success' : 'Failed - Using Safety Backup'}`);
  }

  return {
        success: true,
        title: parsedData.title,
        outline: parsedData.outline,
        externalLinks: fetchedExternalLinks,
        heroImage: heroImageUrl,
        metaTitle: parsedData.metaTitle,
        metaDescription: parsedData.metaDescription,
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
    settings = {}
  } = body;

  const { model, targetKeyword, articleTitle, toneOfVoice, customToneOfVoice, pointOfView, useRealTimeSearchData, realTimeDataSource, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, country, language } = settings;

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const modelConfig = {
    model: model || 'gemini-3.1-flash-lite',
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search';
  if (useRealTimeSearchData && isWebSearch && !deepSearch) {
    modelConfig.tools = [{
      googleSearch: {}
    }];
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig);

  const [
    realTimeInstruction,
    seoInstruction,
    { mediaInstruction, assignedMediaElement, mediaUrl },
    lsiData
  ] = await Promise.all([
    getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading),
    getSeoInstruction(seoOptimization, manualKeywords, targetKeyword),
    getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI, usedImageUrls),
    fetchPeopleAlsoSearchFor(targetKeyword)
  ]);
  let extLinkInstruction = getExternalLinkInstruction(externalLinks);
  let linkInstruction = getLinkInstruction(internalLinks);
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
  let povInstruction = getPovInstruction(pointOfView);
  let readabilityInstruction = getReadabilityInstruction(improveReadability);
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`;

  let sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (STANDARD MODE):
          1. You MUST first write a strong introductory paragraph directly under the main heading "${heading}". Do not leave it blank!
          ${subheadings && subheadings.length > 0 ? `2. After the intro, cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
        `;

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
      `;

  if (deepSearch) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const interaction = await ai.interactions.create({
      agent: 'deep-research-preview-04-2026',
      input: `${baseSystemInstruction}\n\nYou are an expert researcher. Conduct a deep web search based on the following instructions. \n\nCRITICAL RULE: DO NOT output your research notes, search queries, or internal reasoning. Your FINAL output MUST strictly be the final, ready-to-publish Markdown text adhering exactly to the layout requirements provided below.\n\n---\n\n${sectionPrompt}`,
      background: true
    });

    return {
      success: true,
      isDeepSearch: true,
      interactionId: interaction.id,
      mediaHtml: assignedMediaElement,
      mediaUrl: mediaUrl
    };
  }

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

  return {
    success: true,
    text: result.response.text(),
    mediaHtml: assignedMediaElement,
    mediaUrl: mediaUrl
  };
}

import {
  getLinkInstruction,
  getExternalLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchArticleData,
  fetchUnsplashImage, fetchPexelsImage, fetchPixabayImage, calculateRelevanceScore
 ,fetchPeopleAlsoSearchFor, generateFallbackImage, getMediaInstruction, getRealTimeInstruction } from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateRewriteOutline(body, genAI) {
  const { prompt, settings } = body;
  const {model, targetKeyword, language, country,
         automaticExternalLinks, includeFaq, improveReadability, includeKeyTakeaways
    } = settings;

  const articleData = await fetchArticleData(articleUrlToRewrite);
  if (!articleData.success) {
    throw new Error('Failed to fetch the target article. Please check the URL and try again.');
  }

  const sourceText = articleData.text || '';

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
   systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline based on the provided SOURCE ARTICLE. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, rewritten H1 Title) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title", "outline": [{ "type": "h2", "text": "Heading text" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword || 'main topic'}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword || 'main topic'}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword || 'main topic'}" in its "text" field.`
  });

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

            // --- KEY TAKEAWAYS INSTRUCTION ---
            if (includeKeyTakeaways) {
                takeawaysInstruction = `\nCRITICAL REQUIREMENT - KEY TAKEAWAYS: The second H2 heading (immediately after the Introduction) MUST be titled exactly "Key Takeaways". Do NOT nest any H3 subheadings under it.`;
            }

  const keywordInstruction = targetKeyword
    ? `Ensure the outline is optimized for the target keyword: "${targetKeyword}".`
    : `Extract the main topic/keyword from the source article and optimize the outline around it.`;

  const outlinePrompt = `
    SOURCE ARTICLE URL: ${articleUrlToRewrite}
    ${keywordInstruction}
    Include FAQ: ${includeFaq ? 'Yes' : 'No'}
    Include Key Takeaways: ${includeKeyTakeaways ? 'Yes' : 'No'}

    SOURCE ARTICLE CONTENT (MARKDOWN FORMAT):
    ${sourceText ? sourceText.substring(0, 150000) : 'No content provided.'}

    TASK:
    1. Extract the core concepts, topics, and structure of the source article.
    2. Create a comprehensive, REWRITTEN outline (H2s and H3s) that covers the same information but in a fresh, engaging structure.
    3. ${faqInstruction}
    4. ${takeawaysInstruction}
    5. ${relatedInstruction}
    Return ONLY valid JSON.
  `;

  const result = await outlineModel.generateContent(outlinePrompt);
  const responseText = result.response.text();

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

  try {
    const jsonResult = JSON.parse(responseText);
    return { success: true, outline: jsonResult.outline, title: jsonResult.title, heroImage: heroImageUrl, metaTitle: jsonResult.metaTitle,
    metaDescription: jsonResult.metaDescription, externalLinks: fetchedExternalLinks, };
  } catch (error) {
    console.error("Failed to parse Rewrite outline JSON", error);
    return { success: false, error: "Invalid JSON from AI" };
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
    usedExternalLinks = []
    } = body;

        const {model, targetKeyword, articleTitle, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, listItemPrompt, language, country} = settings;

   const langObj = languages ? languages[language] : null;
    const langName = langObj ? langObj.name : (language || 'English');
    const countryObj = countries ? countries.find(c => c.code === country) : null;
    const countryName = countryObj ? countryObj.name : (country || 'United States');
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const articleData = await fetchArticleData(articleUrlToRewrite);
  const sourceText = articleData.text || '';

  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-pro-preview',
  });

  let realTimeInstruction = await getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading);
    let extLinkInstruction = getExternalLinkInstruction(externalLinks);
    let linkInstruction = getLinkInstruction(internalLinks);
    let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);
    let { mediaInstruction, assignedMediaElement, mediaUrl } = await getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI, usedImageUrls);
    let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
    let povInstruction = getPovInstruction(pointOfView);
    let readabilityInstruction = getReadabilityInstruction(improveReadability);

  let sectionStructureRequirements = `
    CRITICAL STRUCTURE REQUIREMENTS (REWRITE MODE):
    1. Write a comprehensive section directly underneath the main heading: "${heading}".
    ${subheadings && subheadings.length > 0 ? `2. Cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
    3. DO NOT copy the source text verbatim. You must rewrite the concepts in your own words, ensuring 100% uniqueness while maintaining the factual accuracy of the original content.
  `;

  const activeSEOKeyword = targetKeyword || articleTitle || heading;
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword);
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`;

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]
    - ${baseSystemInstruction}

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `;



  const sectionPrompt = `
    Article Title Context: ${articleTitle || targetKeyword}
    Full Article Outline Context: ${JSON.stringify(outlineContext)}

    SOURCE ARTICLE CONTENT (MARKDOWN FORMAT):
    ${sourceText ? sourceText.substring(0, 150000) : 'No content provided.'}

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

  return { success: true, text: result.response.text(), mediaHtml: assignedMediaElement, mediaUrl: mediaUrl };
}

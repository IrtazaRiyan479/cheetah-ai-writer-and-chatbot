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
} from '../utils/helpers' // Adjust relative path if needed
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateRewriteOutline(body, genAI) {
  const { prompt, settings } = body;
  const {
    model, targetKeyword, language, country, articleUrlToRewrite, includeFaq, includeKeyTakeaways
  } = settings;

  // 1. Fetch the Target Article
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
    model: model || 'gemini-3.1-flash-lite', // Using a fast model for the outline
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline based on the provided SOURCE ARTICLE. You MUST return a JSON object with two keys: "title" (A catchy, rewritten H1 Title) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title", "outline": [{ "type": "h2", "text": "Heading text" }] }`
  });

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
    3. If 'Include Key Takeaways' is Yes, add an H2 for it at the beginning.
    4. If 'Include FAQ' is Yes, add an H2 for it at the end with relevant H3 questions.
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

if (candidates.length > 0) {
  const scoredCandidates = candidates.map(c => ({
    ...c,
    score: calculateRelevanceScore(c.alt || '', targetKeyword, targetKeyword)
  }));

  scoredCandidates.sort((a, b) => b.score - a.score);

  heroImageUrl = scoredCandidates[0].url;
  console.log(`[Hero Image] Selected ${scoredCandidates[0].source} (Score: ${scoredCandidates[0].score})`);
}

  try {
    const jsonResult = JSON.parse(responseText);
    return { success: true, outline: jsonResult.outline, title: jsonResult.title, heroImage: heroImageUrl };
  } catch (error) {
    console.error("Failed to parse Rewrite outline JSON", error);
    return { success: false, error: "Invalid JSON from AI" };
  }
}


export async function generateRewriteSection(body, genAI) {
  const { prompt, settings, externalLinks,
    internalLinks, } = body;
  const {
    model, targetKeyword, language, country, articleUrlToRewrite,
    heading, subheadings, sectionIndex, outlineContext, articleTitle,
    toneOfVoice, customToneOfVoice, pointOfView, improveReadability
  } = settings;

  // Re-fetch the article text (In a production app, you might want to cache this in state/DB to avoid re-fetching)
  const articleData = await fetchArticleData(articleUrlToRewrite);
  const sourceText = articleData.text || '';

  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-pro', // Pro is recommended for high-quality rewriting
  });

  // Load Instructions
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
  let povInstruction = getPovInstruction(pointOfView);
  let readabilityInstruction = getReadabilityInstruction(improveReadability);
  let extLinkInstruction = getExternalLinkInstruction(externalLinks);
  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = await getSeoInstruction(targetKeyword);

  let sectionStructureRequirements = `
    CRITICAL STRUCTURE REQUIREMENTS (REWRITE MODE):
    1. Write a comprehensive section directly underneath the main heading: "${heading}".
    ${subheadings && subheadings.length > 0 ? `2. Cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
    3. DO NOT copy the source text verbatim. You must rewrite the concepts in your own words, ensuring 100% uniqueness while maintaining the factual accuracy of the original content.
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

  return { success: true, text: result.response.text(), mediaHtml: null };
}

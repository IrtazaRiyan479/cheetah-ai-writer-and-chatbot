import {fetchSerperOutlineData, getLinkInstruction, getExternalLinkInstruction, getRealTimeInstruction, getReadabilityInstruction, getMediaInstruction, getSeoInstruction, getPovInstruction, getToneInstruction, getBaseSystemInstruction} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

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
    generationConfig: { responseMimeType: "application/json",  },

    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with two keys: "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }`
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
      fetchedExternalLinks = outlineData.organic.map(res => res.link).filter(link => link);
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

  let structureInstruction = `
    IMPORTANT STRUCTURE RULES:
    1. The FIRST H2 heading MUST be an Introduction.
    ${takeawaysInstruction}
    2. The LAST H2 heading MUST be a Conclusion.
    ${faqInstruction}
    3. For ALL OTHER H2 headings, nest 2 to 3 relevant H3 subheadings.
  `;

  const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`
  const result = await outlineModel.generateContent(outlinePrompt)
  const parsedData = JSON.parse(result.response.text());

  console.log('Generated Outline:', parsedData.outline[2].subheadings);
  return {
        success: true,
        title: parsedData.title,
        outline: parsedData.outline,
        externalLinks: fetchedExternalLinks
      }
}

export async function generateStandardBlogSection(body, genAI) {
    const {
      outlineContext,
      heading,
      subheadings,
      sectionIndex,
      uploadedMedia,
      settings = {} } = body;

const { model, targetKeyword, articleTitle, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, externalLinks, internalLinks, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, country, language } = settings;

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

  let realTimeInstruction = getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading);
  let extLinkInstruction = getExternalLinkInstruction(externalLinks);
  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);
  let { mediaInstruction, assignedMediaElement } = await getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI);
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
  let povInstruction = getPovInstruction(pointOfView);
  let readabilityInstruction = getReadabilityInstruction(improveReadability);

  let sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (STANDARD MODE):
          1. You MUST first write a strong introductory paragraph directly under the main heading "${heading}". Do not leave it blank!
          ${subheadings && subheadings.length > 0 ? `2. After the intro, cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
        `;

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
      `

      const result = await sectionModel.generateContent(sectionPrompt)
      return { success: true, text: result.response.text(), mediaHtml: assignedMediaElement}
}

import {fetchSerperOutlineData, getLinkInstruction, getExternalLinkInstruction, getRealTimeInstruction, getReadabilityInstruction, getMediaInstruction, getSeoInstruction, getPovInstruction, getToneInstruction, getBaseSystemInstruction} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateListicleOutline(body, genAI) {
  const { settings } = body;
              const {model, targetKeyword, language, country,
         automaticExternalLinks, includeFaq, enableAutoLength, totalListItems, listNumberingFormat, useDescendingOrder, enableSupplementalInformation
    } = settings;

      const langObj = languages ? languages[language] : null;
    const langName = langObj ? langObj.name : (language || 'English');
    const countryObj = countries ? countries.find(c => c.code === country) : null;
    const countryName = countryObj ? countryObj.name : (country || 'United States');
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);
  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
   systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with two keys: "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }`
  });

        let fetchedExternalLinks = [];
  let faqInstruction = '';
  let relatedInstruction = '';

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

  const itemCount = enableAutoLength ? 10 : (parseInt(totalListItems) || 10);
        const format = listNumberingFormat || '1.';

        let numberingArray = [];
        for (let i = 1; i <= itemCount; i++) {
          numberingArray.push(format === 'none' ? '' : format.replace('1', i));
        }
        if (useDescendingOrder) numberingArray.reverse();
        const explicitNumberingStr = format === 'none' ? 'Do not use numbering.' : `Use EXACTLY these prefixes in this order for your list items: ${numberingArray.join(', ')}`;

        let lengthInstruction = `CRITICAL REQUIREMENT: Generate exactly ${itemCount} list items.`;
        let structureInstruction = `
          === STRICT LISTICLE STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next ${itemCount} H2 headings MUST be the core list items/products.
             - ${explicitNumberingStr}
             ${!enableAutoLength ? '- CRITICAL: Do NOT nest any H3 subheadings under these list items.' : ''}
          3. ${enableAutoLength ? 'After the list items, add exactly TWO additional H2 informational sections (e.g., "Buying Guide"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${enableSupplementalInformation ? 'At the very end, add an H2 heading titled "Supplemental Information" with nested H3 subheadings.' : ''}
          5. ${includeFaq ? 'Add an H2 titled "Frequently Asked Questions" with nested H3s.' : ''}
        `;


  const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`
  const result = await outlineModel.generateContent(outlinePrompt)
  const parsedData = JSON.parse(result.response.text());

  return {
        success: true,
        title: parsedData.title,
        outline: parsedData.outline,
        externalLinks: fetchedExternalLinks
      }
}


export async function generateListicleSection(body, genAI) {
      const {
      outlineContext,
      heading,
      subheadings,
      sectionIndex,
      uploadedMedia,
      settings = {}
    } = body;

        const {model, targetKeyword, articleTitle, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, externalLinks, internalLinks, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, listItemPrompt, language, country} = settings;
  const isCoreListItem = (!subheadings || subheadings.length === 0);
        const listPromptInject = isCoreListItem && listItemPrompt
          ? `\nSPECIAL LIST ITEM REQUIREMENT: ${listItemPrompt}`
          : '';

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
          CRITICAL STRUCTURE REQUIREMENTS (LISTICLE MODE):
          1. You are writing content strictly for the heading: "${heading}".
          2. Do NOT add an introduction paragraph before your subheadings if you have subheadings. Go straight to the content.
          ${subheadings && subheadings.length > 0 ? `3. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : '3. Do NOT add any H3 subheadings. Write the content directly under the main heading.'}
          ${listPromptInject}
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

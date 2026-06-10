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
  getBaseSystemInstruction
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

// ============================================================================
// 1. GENERATE THE OUTLINE
// ============================================================================
export async function generateAmazonReviewOutline(body, genAI) {
  const { prompt, settings } = body;
  const {
    model,
    targetKeyword,
    language,
    country,
    condensedMode,
    enableFirstHandExperience,
    includeFaq
  } = settings;

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
    // Using your exact working schema string from standard.js to ensure stability
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with two keys: "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }`
  });

  // Dynamic Structure Rules based on the user's settings
  let outlineStructure = ``;

  if (condensedMode) {
    outlineStructure += `
      - CONDENSED MODE IS ENABLED: Create a highly concise, punchy outline.
      - Limit the structure to essential H2s only.
      - Do NOT use H3 subheadings unless absolutely critical.
    `;
  } else {
    outlineStructure += `
      - FULL REVIEW MODE: Create a comprehensive, deep-dive outline.
      - Include logical H2s (e.g., Overview, Unboxing, Performance, Pros & Cons, Alternatives).
      - Use highly descriptive H3 subheadings under the main H2 sections to break up the text.
    `;
  }

  if (enableFirstHandExperience) {
    outlineStructure += `
      - FIRST-HAND EXPERIENCE IS ENABLED: The headings MUST reflect personal testing and usage (e.g., "My Experience With...", "How I Tested It").
    `;
  }

  if (includeFaq) {
    outlineStructure += `
      - Include an FAQ section with 3 to 4 commonly asked questions about the product formatted as H3s under an "FAQ" H2.
    `;
  }

  const outlinePrompt = `Create an Amazon Single-Product Review Outline for: ${prompt || targetKeyword}\n\nIMPORTANT STRUCTURE RULES:\n${outlineStructure}`;

  const result = await outlineModel.generateContent(outlinePrompt);
  const parsedData = JSON.parse(result.response.text());

  // EXACT MATCH to listicle.js and standard.js returns
  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline
  };
}

// ============================================================================
// 2. GENERATE THE SECTION CONTENT
// ============================================================================
export async function generateAmazonReviewSection(sectionData, genAI) {
  // We extract everything directly from sectionData (no need for the 'body' parameter)
  const {
    heading,
    subheadings,
    sectionIndex,
    outlineContext,
    settings,
    amazonProductData,
    externalLinks,
    internalLinks,
  } = sectionData;

  const {
    model,
    targetKeyword,
    articleTitle,
    condensedMode,
    enableFirstHandExperience,
    toneOfVoice,
    customToneOfVoice,
    pointOfView,
    improveReadability,
  } = settings;

  // Now genAI is properly defined and this will not crash!
  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
  });

  // Fetch Instructions from Helpers
  let realTimeInstruction = await getRealTimeInstruction(settings.realTimeDataSource, articleTitle, heading, targetKeyword);
  let extLinkInstruction = getExternalLinkInstruction(externalLinks);
  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = await getSeoInstruction(targetKeyword);
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);

  // Force First-Person POV if First-Hand Experience is enabled
  let povInstruction = enableFirstHandExperience
    ? `POINT OF VIEW: You MUST write in the First-Person ("I", "me", "my"). Speak directly to the reader as someone who currently owns, uses, and has rigorously tested this product.`
    : getPovInstruction(pointOfView);

  let readabilityInstruction = getReadabilityInstruction(improveReadability);

  // Parse Amazon Data if provided to ground the AI in factual specs
  let amazonContext = '';
  if (amazonProductData) {
    amazonContext = `
      REAL PRODUCT DATA CONTEXT:
      Title: ${amazonProductData.title}
      Price: ${amazonProductData.price}
      Include these exact factual details naturally in the text where relevant.
    `;
  }

  let sectionStructureRequirements = `
    CRITICAL STRUCTURE REQUIREMENTS (AMAZON SINGLE PRODUCT REVIEW):
    1. You are writing content strictly for the heading: "${heading}".
    2. Write an engaging paragraph directly under the main heading before diving into any subheadings. Do not leave the space under the H2 blank.
    ${condensedMode ? '3. Keep paragraphs extremely short (2-3 sentences max). Get straight to the point. No fluff.' : ''}
    ${subheadings && subheadings.length > 0 ? `4. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
    ${enableFirstHandExperience ? '5. Write as if you are sharing your personal, hands-on experience. Detail specific things you noticed while "testing" or "using" it.' : '5. Write as an objective, highly knowledgeable product reviewer.'}
  `;

  const sectionPrompt = `
    Review Article Title/Context: ${articleTitle || targetKeyword}
    Full Article Outline for Context: ${JSON.stringify(outlineContext)}

    TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

    ${amazonContext}
    ${sectionStructureRequirements}
    ${realTimeInstruction}
    ${extLinkInstruction}
    ${linkInstruction}
    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
  `;

  const result = await sectionModel.generateContent(sectionPrompt);

  return {
    success: true,
    text: result.response.text(),
    mediaHtml: null
  };
}

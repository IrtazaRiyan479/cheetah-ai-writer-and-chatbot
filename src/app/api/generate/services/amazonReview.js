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
 ,fetchPeopleAlsoSearchFor } from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

function extractASIN(url) {
  if (!url) return null;
  const match = url.match(/(?:dp|o|v|item|ASIN|product)\/([a-zA-Z0-9]{10})/i) || url.match(/\/([a-zA-Z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1] : null;
}

/**
 * Internal Fetcher: Hits your existing route.js
 */
async function fetchInternalAmazonData(keyword, settings) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const response = await fetch(`${baseUrl}/api/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: settings.partnerTag || 'babiescarrier-20'
    })
  });

  if (!response.ok) throw new Error(`Failed to fetch Amazon data. Status: ${response.status}`);
  return await response.json();
}

/**
 * Formatter: Cleans the data so the AI can read it perfectly
 */
function formatAmazonProducts(apiData, settings) {
  const rawData = apiData?.data?.searchResult?.items || [];
  if (!rawData.length) return [];

  return rawData.map(item => {
    const ASIN = item.asin || '';
    let affiliateUrl =  new URL(item.detailPageURL || `https://${settings.amazonDomain || 'www.amazon.com'}/dp/${ASIN}?tag='babiescarrier-20'}&linkCode=osi&th=1&psc=1`);
    affiliateUrl.searchParams.set('tag', settings.amazonTrackingId);
    return {
      productName: item.itemInfo?.title?.displayValue || 'Amazon Product',
      amazonUrl: affiliateUrl.toString(),
      imageUrl: item.images?.primary?.large?.url || '',
      price: item.offersV2?.listings?.[0]?.price?.displayAmount || 'Check Amazon',
      features: item.itemInfo?.features?.displayValues || []
    };
  });
}

// ============================================================================
// 1. GENERATE THE OUTLINE
// ============================================================================
export async function generateAmazonReviewOutline(body, genAI) {
  const { prompt, settings } = body;
  const {
    model,
    targetKeyword,
    amazonProductUrl,
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

  const asin = extractASIN(amazonProductUrl);
  const searchStr = asin || targetKeyword || 'amazon product';

  const apiData = await fetchInternalAmazonData(searchStr, settings);
  const formattedProducts = formatAmazonProducts(apiData, settings);
  const product = formattedProducts[0];

  if (!product) {
    throw new Error("Could not fetch product details from Amazon. Please check the URL.");
  }

  const activeKeyword = targetKeyword || product.productName;

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: "application/json" },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${activeKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${activeKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${activeKeyword}" in its "text" field.`

  });

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

  const outlinePrompt = `Create an Amazon Single-Product Review Outline for: ${prompt || targetKeyword}\n\nIMPORTANT STRUCTURE RULES:\n${outlineStructure}
  CRITICAL STRUCTURE & SCHEMA REQUIREMENTS:
    You are writing an outline for a single product review.
    Product Name / Target Keyword: ${activeKeyword}

    You must format the outline array exactly like this:
    Schema: { "type": "h2", "text": "Heading Text", "sectionType": "the_type" }

    Rules for "sectionType": MUST be one of: "intro", "features", "pros_cons", "conclusion"${includeFaq ? ', or "faq"' : ''}.

    CRITICAL WORD COUNT & DEPTH RULES:
  - Total Target Word Count: 3500+ words.
  - You MUST generate at least 20 H2/H3 sections.
  - Each section MUST be dense with information, analysis, and data.
  - Include specific sections for: "In-depth Technical Specifications", "Real-world Performance Testing", "Comparative Analysis vs Competitors", and "Long-term Durability Report".

    LAYOUT ORDER:
    1. The first item MUST be an "intro" (type: h2).
    2. Next, create 2 or 3 feature-focused headings (type: h2).
    3. Include a "pros_cons" section (type: h2).
    4. Include a "conclusion" (type: h2).
    ${includeFaq ? '5. The final item MUST be an "faq" (type: h2).' : ''}`;

  const result = await outlineModel.generateContent(outlinePrompt);
  const parsedData = JSON.parse(result.response.text());

  if (parsedData.outline && parsedData.outline.length > 0) {
    parsedData.outline[0].productData = product;
  }

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription,
    heroImage: product?.imageUrl || ''
  };
}

// ============================================================================
// 2. GENERATE THE SECTION CONTENT
// ============================================================================
export async function generateAmazonReviewSection(sectionData, genAI) {
  const {
    heading,
    section,
    subheadings,
    sectionIndex,
    outlineContext,
    settings,
    amazonProductData,
    externalLinks,
    internalLinks,
    usedExternalLinks = [],
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

  const sectionModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
  });

  let realTimeInstruction = await getRealTimeInstruction(settings.realTimeDataSource, articleTitle, heading, targetKeyword);
  // let extLinkInstruction = getExternalLinkInstruction(externalLinks, usedExternalLinks);
  let linkInstruction = getLinkInstruction(internalLinks);
  let seoInstruction = await getSeoInstruction(targetKeyword);
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);

  const introSection = outlineContext.find(s => s.productData);
  const product = introSection ? introSection.productData : null;

  const activeHeadingText = heading || section?.text || 'Section';
  let activeSectionType = section?.sectionType || section?.type;

  if (!activeSectionType && Array.isArray(outlineContext)) {
    const matched = outlineContext.find(s => s.text === activeHeadingText || activeHeadingText.includes(s.text));
    if (matched) activeSectionType = matched.sectionType;
  }
  activeSectionType = activeSectionType || 'standard';

  const activeKeyword = targetKeyword || (product ? product.productName : 'this product');

  const condensedInstruction = condensedMode
    ? "CRITICAL REQUIREMENT (CONDENSED MODE): This article must be highly concise. Keep all paragraphs extremely short (1 to 3 sentences maximum). Eliminate all fluff, repetitive filler words, and long-winded introductions. Get straight to the point immediately."
    : "Write detailed, comprehensive paragraphs to fully explore the topic.";

  const experienceInstruction = enableFirstHandExperience
    ? "PERSPECTIVE: Write as if you personally own, use, and have extensively tested this exact product. Share hands-on observations."
    : "PERSPECTIVE: Write objectively as an expert product reviewer relying on factual data.";

  let povInstruction = enableFirstHandExperience
    ? `POINT OF VIEW: You MUST write in the First-Person ("I", "me", "my"). Speak directly to the reader as someone who currently owns, uses, and has rigorously tested this product.`
    : getPovInstruction(pointOfView);

  let readabilityInstruction = getReadabilityInstruction(improveReadability);

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
    2. DEPTH: Write minimum 500-800 words for this section. Expand on every point. Use extensive, detailed explanations. Do not provide brief answers.
    3. Use descriptive H3 subheadings (###) to break up the dense content.
    4. Write an engaging paragraph directly under the main heading before diving into any subheadings. Do not leave the space under the H2 blank.
    5. Ensure the total article length (across all sections) will reach 3500+ words.
    ${condensedMode ? '3. Keep paragraphs extremely short (2-3 sentences max). Get straight to the point. No fluff.' : ''}
    ${subheadings && subheadings.length > 0 ? `4. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
    ${enableFirstHandExperience ? '5. Write as if you are sharing your personal, hands-on experience. Detail specific things you noticed while "testing" or "using" it.' : '5. Write as an objective, highly knowledgeable product reviewer.'}
  `;

  const activeSEOKeyword = targetKeyword || articleTitle || heading;
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword);
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`;

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 Google Keyword and 1 Bing Keyword from the provided lists into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `;

  let sectionPrompt = `
    Article Topic: Single Product Review for "${activeKeyword}"
    Current Heading: "${activeHeadingText}"
    Full Article Outline for Context: ${JSON.stringify(outlineContext)}

    TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

    ${keywordSEOInstructions}
    ${condensedInstruction}
    ${experienceInstruction}
    ${amazonContext}
    ${sectionStructureRequirements}
    ${realTimeInstruction}
    ${linkInstruction}
    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
  `;

  if (product) {
    sectionPrompt += `
      PRODUCT CONTEXT (FACTUAL DATA - DO NOT INVENT PRICING OR NAMES):
      - Product Name: ${product.productName}
      - Price: ${product.price}
      - Core Technical Features: ${product.features && product.features.length ? product.features.join(' | ') : 'N/A'}
    `;
  }


  // --- RENDER SECTIONS SAFELY ---
  if (activeSectionType === 'intro') {
    sectionPrompt += `
      TASK: Write a highly engaging introduction.

      STRICT LAYOUT REQUIREMENT (Image & CTA):
      Immediately following your introductory text, you MUST insert this EXACT HTML block to display link:
      <div align="center" style="margin: 25px 0;">
        <a href="${product?.amazonUrl || '#'}" target="_blank" rel="sponsored noopener" style="text-decoration: none; background-color: #6366f1; color: #ffffff !important; font-weight: 700; padding: 8px 16px; border-radius: 4px; display: inline-block;">Check Price on Amazon</a>
      </div>
    `;
  }
  else if (activeSectionType === 'pros_cons') {
    sectionPrompt += `
      TASK: Write a Pros and Cons section for this product.
      STRICT REQUIREMENT: Use a strictly formatted Markdown table with "Pros" and "Cons" columns.
    `;
  }
  else if (activeSectionType === 'conclusion') {
    sectionPrompt += `
      TASK: Write a compelling conclusion and final verdict.
      STRICT LAYOUT REQUIREMENT (Final CTA):
      At the very end of your conclusion, insert this EXACT HTML block:

      <div align="center" style="margin: 25px 0;">
       <a href="${product?.amazonUrl || '#'}" target="_blank" rel="sponsored noopener" style="text-decoration: none; background-color: #6366f1; color: #ffffff !important; font-weight: 700; padding: 8px 16px; border-radius: 4px; display: inline-block;">Check Price on Amazon</a>
      </div>
    `;
  }
  else if (activeSectionType === 'faq') {
    sectionPrompt += `
      TASK: Write a comprehensive FAQ section containing 3 to 5 commonly asked questions regarding this product.

      STRICT REQUIREMENT (Schema Markup):
      You MUST wrap the questions and answers in valid JSON-LD FAQPage schema markup. Place the schema inside a <script type="application/ld+json"> tag at the very end of the section. Do NOT use markdown code blocks around the script tag.
    `;
  }
  else {
    sectionPrompt += `
      TASK: Write a comprehensive section analyzing this specific aspect of the product.
    `;
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
    mediaHtml: null
  };
}

import {
  getLinkInstruction,
  getExternalLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction
} from '../utils/helpers';
import { languages } from '@/configs/languages';
import { countries } from '@/configs/countries';

/**
 * 1. Internal Fetcher: The backend automatically fetches the Amazon data itself.
 * This completely removes the need for the frontend to handle Amazon API logic.
 */
async function fetchInternalAmazonData(keyword, settings) {
  // Ensure this points to your real domain in production via .env
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      domain: settings.domain || 'www.amazon.com',
      partnerTag: settings.partnerTag || 'babiescarrier-20'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from internal /api/amazon route. Status: ${response.status}`);
  }
  return await response.json();
}

/**
 * 2. Formatter: Cleans the raw Amazon data
 */
function formatAmazonProducts(apiData, settings) {
  // 10. Navigates the exact data format you provided
  const rawData = apiData?.data?.searchResult?.items || [];
  const numberOfProducts = settings.numberOfProducts || 5;
  const limitedProducts = rawData.slice(0, numberOfProducts);

  return limitedProducts.map(item => {
    // Graceful fallbacks in case a specific product is missing data
    const title = item?.itemInfo?.title?.displayValue || 'Amazon Product';
    // 9. Uses the detailPageURL which already contains your affiliate tag!
    const affiliateUrl = item?.detailPageURL || `https://www.amazon.com/dp/${item.asin}?tag=${settings.partnerTag}`;
    // 8. Digs into the deeply nested image object
    const imageUrl = item?.images?.primary?.large?.url || '';
    const price = item?.offersV2?.listings?.[0]?.price?.money?.displayAmount || 'Check Price on Amazon';

    return {
      productName: title,
      amazonUrl: affiliateUrl,
      imageUrl: imageUrl,
      price: price
    };
  });
}

/**
 * GENERATOR 1: Outline Generator
 */
export async function generateAmazonRoundupOutline(body, genAI) {
  const { settings, targetKeyword } = body;
  const { model, language, country } = settings;

  // Automatically fetch data from your existing Amazon API route
  const amazonApiData = await fetchInternalAmazonData(targetKeyword, settings);
  const formattedProducts = formatAmazonProducts(amazonApiData, settings);

  if (formattedProducts.length === 0) {
    throw new Error('No Amazon products found for this keyword. Please check the keyword or Amazon API limit.');
  }

  const langObj = languages ? languages[language] : null;
  const langName = langObj ? langObj.name : (language || 'English');
  const countryObj = countries ? countries.find(c => c.code === country) : null;
  const countryName = countryObj ? countryObj.name : (country || 'United States');

  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);
  const productTitles = formattedProducts.map((p, index) => `${index + 1}. ${p.title}`).join('\n');

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging Amazon Roundup article outline for the keyword: "${targetKeyword}". You MUST return a JSON object with two keys: "title" (A catchy H1 Title) and "outline" (A flat JSON array of objects).

For standard sections (intro, buying_guide, faq), use this schema:
{ "type": "h2", "text": "Section Title", "sectionType": "intro" }

For "product" sections, you MUST include the rich product data provided to you using this schema:
{
  "type": "h2",
  "text": "[Product Name]",
  "sectionType": "product",
  "productData": {
    "productName": "Exact Amazon Title",
    "amazonUrl": "https://amazon.com/dp/...",
    "imageUrl": "https://m.media-amazon.com/images/...",
    "price": "$19.99"
  }
}`
  });

  // Strict schema required by OutlineEditor.jsx (type: "h2", text: "heading")
  const outlinePrompt = `
    CRITICAL STRUCTURE & SCHEMA REQUIREMENTS:
    You must format the outline array exactly like this to support the frontend editor:
    Schema: { "type": "h2", "text": "Heading Text", "sectionType": "the_type" }

    Rules for "type": MUST strictly be "h2" or "h3".
    Rules for "text": The actual string of the heading.
    Rules for "sectionType": MUST be one of: "intro", "product", "buying_guide", "conclusion", or "faq".

    LAYOUT ORDER:
    1. The first item MUST be an "intro" (type: h2).
    2. Next, you MUST create a "product" (type: h2) for EXACTLY these products in this exact order:
    ${productTitles}
    3. Include a "buying_guide" (type: h2) after the product reviews.
    4. Include a "conclusion" (type: h2).
    5. The final item MUST be an "faq" (type: h2).
  `;

  const result = await outlineModel.generateContent(outlinePrompt);
  const parsedData = JSON.parse(result.response.text());
  return {
  success: true,
  title: parsedData.title,
  outline: parsedData.outline,
  externalLinks: parsedData.externalLinks || []
};
}

/**
 * GENERATOR 2: Section Content Generator
 */
export async function generateAmazonRoundupSection(body, genAI) {
  const { heading, text, section = {}, articleTitle, outlineContext, settings = {}, targetKeyword, internalLinks, externalLinks } = body;

  const {
    model,
    enableFirstHandExperience,
    improveReadability,
    pointOfView,
    toneOfVoice,
  } = settings;

  // Automatically fetch the data again so the section generator knows about the products statelessly
  const amazonApiData = await fetchInternalAmazonData(targetKeyword || articleTitle, settings);
  const formattedProducts = formatAmazonProducts(amazonApiData, settings);

  // Accommodate OutlineEditor using 'text' instead of 'heading'
  const activeHeadingText = heading || text || section.text || section.heading || 'Section';
  const activeSectionType = section.sectionType || section.type || 'standard';

  const sectionModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-pro' });

  const toneInstruction = getToneInstruction(toneOfVoice);
  const povInstruction = getPovInstruction(pointOfView);
  const readabilityInstruction = getReadabilityInstruction(improveReadability);
  const seoInstruction = await getSeoInstruction(targetKeyword);

  let linkInstruction = '';
  let extLinkInstruction = '';
  if (activeSectionType === 'intro' || activeSectionType === 'buying_guide') {
    linkInstruction = getLinkInstruction(internalLinks);
    extLinkInstruction = getExternalLinkInstruction(externalLinks);
  }

  const experienceInstruction = enableFirstHandExperience
    ? "CRITICAL: Write this review using strong first-hand experience. Use phrases like 'When I tested this...', 'In my hands-on experience...', and 'What I noticed right away...'. Speak as an expert who has physically unboxed and used the item."
    : "Write this review from an objective, expert standpoint based on specifications, features, and market consensus.";

  let sectionPrompt = `
    Article Title Context: ${articleTitle || targetKeyword}
    Full Article Outline Context: ${JSON.stringify(outlineContext)}
    Current Heading: ${activeHeadingText}

    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
    ${linkInstruction}
    ${extLinkInstruction}
  `;

  if (activeSectionType === 'intro') {
    const top3 = formattedProducts.slice(0, 3);
    const top3Markdown = top3.map(p => `| <img src="${p.imageUrl}" width="100"/> | **${p.title}** | [Check Price](${p.affiliateUrl}) |`).join('\n');

    sectionPrompt += `
      TASK: Write a strong, engaging introduction for the keyword "${targetKeyword}".

      STRICT LAYOUT REQUIREMENT (Top 3 Picks Table):
      Immediately following your introductory paragraphs, you MUST include this EXACT Markdown table representing our Top 3 Picks:

      ### Our Top 3 Picks
      | Image | Product | Link |
      |---|---|---|
      ${top3Markdown}
    `;
  }

  else if (activeSectionType === 'product') {
    const product = formattedProducts.find(p => activeHeadingText.includes(p.title) || p.title.includes(activeHeadingText)) || formattedProducts[0];

    sectionPrompt += `
      TASK: Write a comprehensive product review for "${product.title}".
      ${experienceInstruction}

      PRODUCT CONTEXT (DO NOT INVENT PRICING):
      - Title: ${product.title}
      - Price: ${product.price}

      STRICT LAYOUT REQUIREMENT:
      Format this section EXACTLY in this order:
      1. **Review:** 2-3 engaging paragraphs reviewing the product.
      2. **HTML Image:** Insert this EXACT HTML centered:
         <div align="center"><img src="${product.imageUrl}" alt="${product.title}" style="max-width:100%; border-radius:8px; margin: 20px 0;"/></div>
      3. **Features:** A bulleted list of 3-4 key features.
      4. **Pros & Cons Table:** A strictly formatted Markdown table with "Pros" and "Cons" columns.
      5. **Real Buyer Opinions:** A brief summary of what real buyers think.
      6. **CTA Button:** Insert this EXACT HTML for the affiliate button:
         <div align="center" style="margin: 25px 0;">
           <a href="${product.affiliateUrl}" target="_blank" rel="sponsored noopener" style="background-color: #f90; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 18px;">Check Price on Amazon</a>
         </div>
    `;
  }

  else if (activeSectionType === 'faq') {
    sectionPrompt += `
      TASK: Write a comprehensive FAQ section containing 4 to 6 commonly asked questions regarding "${targetKeyword}".

      STRICT REQUIREMENT (Schema Markup):
      You MUST wrap the questions and answers in valid JSON-LD FAQPage schema markup. Place the schema inside a <script type="application/ld+json"> tag at the very end of the section. Do NOT use markdown code blocks around the script tag.
    `;
  }

  else {
    sectionPrompt += `
      TASK: Write a comprehensive section for "${activeHeadingText}". Ensure the formatting is clean, engaging, and directly answers the user's intent.
    `;
  }

  const result = await sectionModel.generateContent(sectionPrompt);
  return { success: true, text: result.response.text(), mediaHtml: null };
}

import {
  getLinkInstruction,
  getExternalLinkInstruction,
  getReadabilityInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchUnsplashImage, fetchPexelsImage, fetchPixabayImage, calculateRelevanceScore
 ,fetchPeopleAlsoSearchFor,
 generateFallbackImage} from '../utils/helpers';
import { languages } from '@/configs/languages';
import { countries } from '@/configs/countries';

async function fetchInternalAmazonData(keyword, settings) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const response = await fetch(`${baseUrl}/api/amazon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: keyword,
      domain: settings.amazonDomain || 'www.amazon.com',
      partnerTag: process.env.AMAZON_PARTNER_TAG
    })
  });



  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails = errorText;
    try {
        const parsed = JSON.parse(errorText);
        errorDetails = parsed.details ? JSON.stringify(parsed.details) : errorText;
    } catch(e) {}

    console.error("Amazon Route Failed:", errorDetails);
    throw new Error(`Amazon API 400: ${errorDetails}`);
  }
  return await response.json();
}

function formatAmazonProducts(apiData, settings) {
  const rawData = apiData?.data?.searchResult?.items || [];
  const numberOfProducts = settings.numberOfProducts || 5;
  const limitedProducts = rawData.slice(0, numberOfProducts);

  return limitedProducts.map(item => {
    const title = item?.itemInfo?.title?.displayValue || 'Amazon Product';
    let affiliateUrl = new URL(item?.detailPageURL || `https://${settings.amazonDomain || 'www.amazon.com'}/dp/${item.asin}?tag=${process.env.AMAZON_PARTNER_TAG}`);
    affiliateUrl.searchParams.set('tag', settings.amazonTrackingId);
    let imageUrl = item?.images?.primary?.large?.url || '';
    imageUrl = imageUrl.replace(/\._[A-Za-z0-9_]+_\./, '.');
    const price = item?.offersV2?.listings?.[0]?.price?.money?.displayAmount || 'Check Price on Amazon';
    const features = item?.itemInfo?.features?.displayValues || [];

    return {
      productName: title,
      amazonUrl: affiliateUrl.toString(),
      imageUrl: imageUrl,
      price: price,
      features: features
    };
  });
}

export async function generateAmazonRoundupOutline(body, genAI) {
  const { settings, targetKeyword } = body;
  const { model, language, country, includeFaq } = settings;

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
  const productListString = formattedProducts.map((p, index) =>
    `${index + 1}. ${p.productName}\n   URL: ${p.amazonUrl}\n   Image: ${p.imageUrl}\n   Price: ${p.price}`
  ).join('\n\n');

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
   systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging Amazon Roundup article outline for the keyword: "${targetKeyword}". You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy H1 Title) and "outline" (A flat JSON array of objects).\n\nFor standard sections (intro, buying_guide, faq), use this schema:\n{ "type": "h2", "text": "Section Title", "sectionType": "intro" }\n\nFor "product" sections, you MUST include the rich product data provided to you using this schema:\n{\n  "type": "h2",\n  "text": "[Product Name]",\n  "sectionType": "product",\n  "productData": {\n    "productName": "Exact Amazon Title",\n    "amazonUrl": "https://amazon.com/dp/...",\n    "imageUrl": "https://m.media-amazon.com/images/...",\n    "price": "$19.99"\n  }\n}\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object (intro) MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object (conclusion or faq) MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  });


  const outlinePrompt = `
    CRITICAL STRUCTURE & SCHEMA REQUIREMENTS:
    You must format the outline array exactly like this to support the frontend editor:
    Schema: { "type": "h2", "text": "Heading Text", "sectionType": "the_type" }

    Rules for "type": MUST strictly be "h2" or "h3".
    Rules for "text": The actual string of the heading.
    Rules for "sectionType": MUST be one of: "intro", "product", "buying_guide", "conclusion", or "faq".

    LAYOUT ORDER:
    1. The first item MUST be an "intro" (type: h2).
    2. Next, you MUST create a "product" (type: h2) for EXACTLY these products using this precise data. You MUST explicitly number the product titles in the "text" field (e.g., "1. Product Name", "2. Product Name"):
    ${productListString}
    3. Include a "buying_guide" (type: h2) after the product reviews.
    4. Include a "conclusion" (type: h2).
    ${includeFaq ? '5. The final item MUST be an "faq" (type: h2).' : ''}
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
  metaTitle: parsedData.metaTitle,
  metaDescription: parsedData.metaDescription,
  externalLinks: parsedData.externalLinks || [],
  heroImage: heroImageUrl
};
}

export async function generateAmazonRoundupSection(body, genAI) {
  const { heading, text, section = {}, articleTitle, outlineContext, settings = {}, targetKeyword, internalLinks, externalLinks } = body;

  const {
    model,
    enableFirstHandExperience,
    improveReadability,
    pointOfView,
    toneOfVoice,
    usedExternalLinks = [],
  } = settings;

  const amazonApiData = await fetchInternalAmazonData(targetKeyword || articleTitle, settings);
  const formattedProducts = formatAmazonProducts(amazonApiData, settings);

  const activeHeadingText = heading || text || section.text || section.heading || 'Section';
  let activeSectionType = section.sectionType || section.type;
  if (!activeSectionType && Array.isArray(outlineContext)) {
    const matchedSection = outlineContext.find(s =>
      s.text === activeHeadingText || activeHeadingText.includes(s.text)
    );
    if (matchedSection) {
      activeSectionType = matchedSection.sectionType;
    }
  }
  activeSectionType = activeSectionType || 'standard';

  const sectionModel = genAI.getGenerativeModel({ model: model || 'gemini-3.1-flash-lite' });

  const toneInstruction = getToneInstruction(toneOfVoice);
  const povInstruction = getPovInstruction(pointOfView);
  const readabilityInstruction = getReadabilityInstruction(improveReadability);
  const seoInstruction = await getSeoInstruction(targetKeyword);

  let linkInstruction = '';
  // let extLinkInstruction = '';
  if (activeSectionType === 'intro' || activeSectionType === 'buying_guide') {
    linkInstruction = getLinkInstruction(internalLinks);
    // let extLinkInstruction = getExternalLinkInstruction(externalLinks, usedExternalLinks);
  }

  const experienceInstruction = enableFirstHandExperience
    ? "CRITICAL: Write this review using strong first-hand experience. Use phrases like 'When I tested this...', 'In my hands-on experience...', and 'What I noticed right away...'. Speak as an expert who has physically unboxed and used the item."
    : "Write this review from an objective, expert standpoint based on specifications, features, and market consensus.";

  const activeSEOKeyword = targetKeyword || articleTitle || heading;
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



  let sectionPrompt = `
    Article Title Context: ${articleTitle || targetKeyword}
    Full Article Outline Context: ${JSON.stringify(outlineContext)}
    Current Heading: ${activeHeadingText}

    ${seoInstruction}
    ${toneInstruction}
    ${povInstruction}
    ${readabilityInstruction}
    ${linkInstruction}
    ${keywordSEOInstructions}
  `;

  if (activeSectionType === 'intro') {
    const top3 = formattedProducts.slice(0, 3);

    const top3HTML = top3.map(p => {
      const safeTitle = p.productName.replace(/[\r\n]+/g, ' ').replace(/\|/g, '-');
      const safeImageUrl = p.imageUrl ? p.imageUrl.replace(/_/g, '%5F') : '';
      return `<tr><td><img src="${safeImageUrl}" width="100"/></td><td><strong>${safeTitle}</strong></td><td><a href="${p.amazonUrl}" target="_blank" rel="sponsored noopener" class="not-prose bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded inline-block no-underline">Check Price</a></td></tr>`;
    }).join('');


    sectionPrompt += `
        TASK: Write a strong, engaging introduction for the keyword "${targetKeyword}".

        STRICT LAYOUT REQUIREMENT (Top 3 Picks Table):
        Immediately following your introductory paragraphs, you MUST include this EXACT HTML table representing our Top 3 Picks. Do NOT add any formatting, newlines, or spaces between the HTML tags:

        ### Our Top 3 Picks
        <table><tbody><tr><th>Image</th><th>Product</th><th>Link</th></tr>${top3HTML}</tbody></table>
        `;
  }

  else if (activeSectionType === 'product') {
    const product = formattedProducts.find(p => activeHeadingText.includes(p.productName) || p.productName.includes(activeHeadingText)) || formattedProducts[0];

    console.log(product.features && product.features.length ? `[Product Features] ${product.productName}: ${product.features.join(' | ')}` : `[Product Features] ${product.productName}: No features available.`);

    sectionPrompt += `
      TASK: Write a comprehensive product review for "${product.productName}".
      ${experienceInstruction}

      PRODUCT CONTEXT (DO NOT INVENT PRICING):
      - Title: ${product.productName}
      - Price: ${product.price}

      STRICT LAYOUT REQUIREMENT:
      Format this section EXACTLY in this order:
      1. **Review:** 2-3 engaging paragraphs reviewing the product.
      2. **HTML Image:** Insert this EXACT HTML centered:
         <div align="center" style="margin: 25px 0;">
            <img src="${product.imageUrl}" alt="${product.title}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.05);" />
          </div>
      3. **Features:** A bulleted list of 3-4 key features.
      4. **Pros & Cons Table:** A strictly formatted Markdown table with "Pros" and "Cons" columns.
      5. **Real Buyer Opinions:** A brief summary of what real buyers think. CRITICAL: You must synthesize this summary directly from the "Official Features" provided above. Frame the feedback around how buyers react to those specific attributes (e.g., if a feature highlights 'lightweight design', mention how users praise its portability).
      6. **CTA Button:** Insert this EXACT HTML for the affiliate button:
         <div align="center" style="margin: 20px 0;">
            <a href="${product.amazonUrl}" target="_blank" rel="sponsored noopener" class="no-underline bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded inline-block">Check Price</a>
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

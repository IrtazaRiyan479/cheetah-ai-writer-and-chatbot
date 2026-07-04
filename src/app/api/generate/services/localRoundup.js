import {fetchSerperOutlineData, fetchSerperPlacesData, getLinkInstruction, getExternalLinkInstruction, getRealTimeInstruction, getReadabilityInstruction, getMediaInstruction, getSeoInstruction, getPovInstruction, getToneInstruction, getBaseSystemInstruction, fetchUnsplashImage, fetchPexelsImage, fetchPixabayImage, calculateRelevanceScore ,fetchPeopleAlsoSearchFor, generateFallbackImage } from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateLocalRoundupOutline(body, genAI) {
  const { prompt, settings} = body;
      const { model, targetKeyword, language, country, automaticExternalLinks, includeFaq, includeKeyTakeaways, useDescendingOrder, enableSupplementalInformation, numberOfPlaces, enableAutoLength, listNumberingFormat
    } = settings;

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

   const itemCount = enableAutoLength ? 10 : (parseInt(numberOfPlaces) || 10);

        const placesData = await fetchSerperPlacesData(targetKeyword || prompt, itemCount, country, language);
        let placesInstruction = '';

        const format = listNumberingFormat || '1.';

        let numberingArray = [];
        for (let i = 1; i <= itemCount; i++) {
          numberingArray.push(format === 'none' ? '' : format.replace('1', i));
        }
        if (useDescendingOrder) numberingArray.reverse();
        const explicitNumberingStr = format === 'none' ? 'Do not use numbering.' : `Use EXACTLY these prefixes in this order for your list items: ${numberingArray.join(', ')}`;

        if (placesData.length > 0) {
          const placeNames = placesData.map((p, i) => {
            const prefix = numberingArray[i] ? `${numberingArray[i]} ` : '';
            return `${prefix}${p.title}`;
          }).join('\n');
          placesInstruction = `You MUST use EXACTLY these locations for the core H2 headings in order:\n${placeNames}`;
        } else {
          placesInstruction = `Generate exactly ${itemCount} H2 headings representing specific real-world locations related to the topic. Number them.${explicitNumberingStr}`;
        }
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

        let lengthInstruction = `CRITICAL: Generate exactly ${itemCount} location items.`;
        let structureInstruction = `
          === STRICT LOCAL ROUNDUP STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next H2 headings MUST be the core locations:
          ${placesInstruction}
          - CRITICAL: Do NOT nest any H3 subheadings under the location items.
          3. ${enableSupplementalInformation ? 'After the locations, add exactly TWO additional H2 informational sections (e.g., "What to look for"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${faqInstruction}
          5. ${takeawaysInstruction}
          6. ${relatedInstruction}
        `;



          const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`
          const result = await outlineModel.generateContent(outlinePrompt)
          const parsedData = JSON.parse(result.response.text());
          if (placesData && placesData.length > 0) {
            let currentPlaceIndex = 0;

            parsedData.outline.forEach(item => {
              if (item.type === 'h2') {
                const lowerText = item.text.toLowerCase();

                if (!lowerText.includes('introduction') &&
                    !lowerText.includes('key takeaways') &&
                    !lowerText.includes('frequently asked') &&
                    !lowerText.includes('conclusion')) {

                  if (currentPlaceIndex < placesData.length) {
                    const prefix = numberingArray[currentPlaceIndex] ? `${numberingArray[currentPlaceIndex]} ` : '';
                    item.text = `${prefix}${placesData[currentPlaceIndex].title}`;
                    currentPlaceIndex++;
                  }
                }
              }
            });
          }

          const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
    fetchUnsplashImage(targetKeyword),
    fetchPexelsImage(targetKeyword),
    fetchPixabayImage(targetKeyword)
  ]);

  let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url);
  let heroImageUrl = '';
  let fallbackToAiImageTag = false;
  let scoredCandidates = [];

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
                externalLinks: fetchedExternalLinks,
                heroImage: heroImageUrl,
                metaTitle: parsedData.metaTitle,
                metaDescription: parsedData.metaDescription,
              }
}

export async function generateLocalRoundupSection(body, genAI) {
  const { heading, subheadings, settings, externalLinks,
    internalLinks, sectionIndex, outlineContext, usedImageUrls = [], usedExternalLinks = [] } = body;

      const { model, targetKeyword, articleTitle, language, country, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, generateUniqueMapImages, enableFirstHandExperience, uploadedMedia, usedInternalLinks = [],
    } = settings;

                      const langObj = languages ? languages[language] : null;
    const langName = langObj ? langObj.name : (language || 'English');
    const countryObj = countries ? countries.find(c => c.code === country) : null;
    const countryName = countryObj ? countryObj.name : (country || 'United States');
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName);

          const modelConfig = {
          model: deepSearch ? 'deep-research-preview-04-2026' : (model || 'gemini-3.5-flash'),
          systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
        }

          const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search';
    if (useRealTimeSearchData && isWebSearch) {
      modelConfig.tools = [{
        googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } }
      }];
    }

    const sectionModel = genAI.getGenerativeModel(modelConfig);

    let realTimeInstruction = await getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading);
    let extLinkInstruction = settings.automaticExternalLinks
    ? getExternalLinkInstruction(externalLinks, usedExternalLinks)
    : '\nCRITICAL FORMATTING: Do NOT include or generate any external URLs or links in this section under any circumstances.';
    let { instruction: linkInstruction, selectedUrl: internalLinkUrl }= await getLinkInstruction(internalLinks, heading, genAI, usedInternalLinks)
    let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);
    let { mediaInstruction, assignedMediaElement, mediaUrl } = await getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI, usedImageUrls, settings);
    let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
    let povInstruction = getPovInstruction(pointOfView);
    let readabilityInstruction = getReadabilityInstruction(improveReadability);

   const isCoreLocation = (!subheadings || subheadings.length === 0) && !heading.toLowerCase().includes('introduction') && !heading.toLowerCase().includes('faq') && !heading.toLowerCase().includes('supplemental');

   let narrativeRequirement = '';
   let placeDataStr = '';
  if (isCoreLocation) {
      const placeInfo = await fetchSerperPlacesData(`${heading} ${targetKeyword || ''}`, 1, country, language);
      const p = placeInfo.length > 0 ? placeInfo[0] : null;
      if (p) {
        const mapLink = p.cid ? `https://maps.google.com/?cid=${p.cid}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title + ' ' + (p.address || ''))}`;

        if (generateUniqueMapImages) {
          const mapImgUrl = (p.latitude && p.longitude)
            ? `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${p.longitude},${p.latitude}&z=16&l=map&size=600,300&pt=${p.longitude},${p.latitude},pm2rdm`
            : `https://placehold.co/800x400/ececec/555555?text=Map+Location:+${encodeURIComponent(p.title)}`;


          assignedMediaElement = `<a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; margin: 24px 0;"><img src="${mapImgUrl}" alt="Map of ${p.title}" style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; object-fit: cover; aspect-ratio: 2/1;" /></a>`;
          mediaInstruction = `\n[NOTE: A map image has been automatically inserted. Do NOT output image HTML.]`;
        }

        placeDataStr = `
          REAL LOCATION DATA TO USE:
          - Ratings: ${p.rating ? `${p.rating} / 5 (${p.ratingCount} reviews)` : 'Not Available'}
          - Address: ${p.address || 'Address Not Available'}
          - Map URL: ${mapLink}
          - Phone: ${p.phoneNumber || 'Not Available'}
          - Website URL: ${p.website || 'Not Available'}
        `;
      }

     narrativeRequirement = enableFirstHandExperience
    ? 'Write a compelling, authentic 2-paragraph review from a first-person perspective ("I", "my"). CRITICAL: You MUST drastically vary your opening sentences and narrative structure. DO NOT repetitively start paragraphs with generic phrases like "When I visited," "I recently went to," or "My experience." Instead, dive naturally into the review by immediately describing a specific sensory detail, an interaction with the staff, the immediate atmosphere, or a unique observation. Make it read like a dynamic, genuine blog post.'
    : 'Write a highly detailed, objective description (2 paragraphs) of this location, its atmosphere, and its best offerings. Maintain a professional, third-person perspective.';
          }
           let sectionStructureRequirements = `
              CRITICAL LOCAL ROUNDUP LAYOUT:
              You are writing the section for the location: "${heading}".
              ${placeDataStr}

              1. First, ${narrativeRequirement}
              2. Then, you MUST output an exact bulleted list exactly matching this HTML/Markdown format. Ensure the links are properly formatted HTML ` + "`<a>`" + ` tags:

              * **Ratings:** [Insert Rating Data]
              * **Location:** <a href="[Insert Map URL]" target="_blank">[Insert Address]</a>
              * **Contact Info:** [Insert Phone]
              * **Visit Website:** <a href="[Insert Website URL]" target="_blank" rel="noopener nofollow">View Website</a>

              Do NOT add any H3s or other text after the bullet points. Follow this structure strictly.
            `;

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
        ${keywordSEOInstructions}
      `

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

const isTypeError = error.name === 'TypeError' || errorMessage.includes('typeerror');

      const is503 = error.status === 503 || errorMessage.includes('503');

      const isFetchFailed = errorMessage.includes('fetch failed') ||
                            errorMessage.includes('econnreset') ||
                            errorMessage.includes('etimedout');

      if (is503 || isFetchFailed || isTypeError) {
        console.warn(`[Gemini API] Transient Error (${is503 ? '503' : 'Fetch Failed'}). Retrying in ${delay / 1000} seconds... (Attempt ${i + 1} of ${retries})`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }

      return { success: true, text: result.response.text(), mediaHtml: assignedMediaElement, mediaUrl: mediaUrl, internalLinkUrl: internalLinkUrl}
}

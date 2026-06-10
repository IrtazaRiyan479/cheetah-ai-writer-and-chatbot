import {fetchSerperOutlineData, fetchSerperPlacesData, getLinkInstruction, getExternalLinkInstruction, getRealTimeInstruction, getReadabilityInstruction, getMediaInstruction, getSeoInstruction, getPovInstruction, getToneInstruction, getBaseSystemInstruction} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

export async function generateLocalRoundupOutline(body, genAI) {
  const { prompt, settings} = body;
      const { model, targetKeyword, language, country, automaticExternalLinks, includeFaq, includeKeyTakeaways, enableSupplementalInformation, numberOfPlaces, enableAutoLength
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

   const itemCount = enableAutoLength ? 10 : (parseInt(numberOfPlaces) || 10);

        // 1. Fetch real places from Serper to build the outline!
        const placesData = await fetchSerperPlacesData(targetKeyword || prompt, itemCount, country, language);
        let placesInstruction = '';

        if (placesData.length > 0) {
          const placeNames = placesData.map((p, i) => `${i + 1}. ${p.title}`).join('\n');
          placesInstruction = `You MUST use EXACTLY these locations for the core H2 headings in order:\n${placeNames}`;
        } else {
          placesInstruction = `Generate exactly ${itemCount} H2 headings representing specific real-world locations related to the topic. Number them.`;
        }
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

          return {
                success: true,
                title: parsedData.title,
                outline: parsedData.outline,
                externalLinks: fetchedExternalLinks
              }

  return { success: true, text: result.response.text(), mediaHtml: assignedMediaElement };
}

export async function generateLocalRoundupSection(body, genAI) {
  const { heading, subheadings, settings, externalLinks,
    internalLinks, sectionIndex, outlineContext } = body;

      const { model, targetKeyword, articleTitle, language, country, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, deepSearch, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, generateUniqueMapImages, enableFirstHandExperience, uploadedMedia
    } = settings;

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

    let realTimeInstruction = await getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading);
    let extLinkInstruction = getExternalLinkInstruction(externalLinks);
    let linkInstruction = getLinkInstruction(internalLinks);
    let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword);
    let { mediaInstruction, assignedMediaElement } = await getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI);
    let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice);
    let povInstruction = getPovInstruction(pointOfView);
    let readabilityInstruction = getReadabilityInstruction(improveReadability);

   const isCoreLocation = (!subheadings || subheadings.length === 0) && !heading.toLowerCase().includes('introduction') && !heading.toLowerCase().includes('faq') && !heading.toLowerCase().includes('supplemental');
   let narrativeRequirement = '';
   let placeDataStr = '';
  if (isCoreLocation) {
      // 1. Fetch exact data for this specific location
      const placeInfo = await fetchSerperPlacesData(`${heading} ${targetKeyword || ''}`, 1, country, language);
      const p = placeInfo.length > 0 ? placeInfo[0] : null;
      if (p) {
        // Build Map Link & Unique Map Image
        const mapLink = p.cid ? `https://maps.google.com/?cid=${p.cid}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title + ' ' + (p.address || ''))}`;

        if (generateUniqueMapImages) {
          // Using Yandex Static Map API if coordinates exist, otherwise Placehold fallback
          const mapImgUrl = (p.latitude && p.longitude)
            ? `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${p.longitude},${p.latitude}&z=16&l=map&size=600,300&pt=${p.longitude},${p.latitude},pm2rdm`
            : `https://placehold.co/800x400/ececec/555555?text=Map+Location:+${encodeURIComponent(p.title)}`;

          assignedMediaElement = `<a href="${mapLink}" target="_blank" rel="noopener noreferrer" class="block w-full my-6 transition-transform hover:scale-[1.02]"><img src="${mapImgUrl}" alt="Map of ${p.title}" class="w-full h-auto rounded-xl shadow-md border border-gray-200 object-cover aspect-[2/1]" /></a>`;
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

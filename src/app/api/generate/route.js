import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'

async function fetchSerperData(query, type = 'search') {
  if (!process.env.SERPER_API_KEY) return [];
  try {
    const res = await fetch(`https://google.serper.dev/${type}`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    });
    const data = await res.json();
    if (type === 'news' && data.news) return data.news.slice(0, 4).map(n => `${n.title}: ${n.snippet}`);
    if (type === 'scholar' && data.organic) return data.organic.slice(0, 4).map(o => `${o.title}: ${o.snippet}`);
    if (data.organic) return data.organic.slice(0, 4);
    return [];
  } catch (e) { console.error('Serper API Error:', e); return []; }
}

async function fetchSerperOutlineData(query) {
  if (!process.env.SERPER_API_KEY) return { organic: [], faqs: [], related: [] };
  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    });
    const data = await res.json();
    return {
      organic: data.organic ? data.organic.slice(0, 4) : [],
      faqs: data.peopleAlsoAsk ? data.peopleAlsoAsk.map(item => item.question) : [],
      related: data.relatedSearches ? data.relatedSearches.map(item => item.query) : []
    };
  } catch (e) { console.error('Serper Outline Error:', e); return { organic: [], faqs: [], related: [] }; }
}

async function fetchSerperPlacesData(query, count = 10, countryCode = 'us', languageCode = 'en') {
  if (!process.env.SERPER_API_KEY) return [];
  try {
    const res = await fetch(`https://google.serper.dev/places`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        gl: countryCode.toLowerCase(), // 'gl' forces the Google Search country
        hl: languageCode.toLowerCase() // 'hl' forces the Google Search language
      })
    });
    const data = await res.json();
    return data.places ? data.places.slice(0, count) : [];
  } catch (e) {
    console.error('Serper Places API Error:', e);
    return [];
  }
}

// --- HELPER: LIVE SEO KEYWORD FETCHER ---
async function fetchLiveKeywords(keyword) {
  const keywords = new Set()
  if (!keyword) return []
  try {
    const gsRes = await fetch(`http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`)
    if (gsRes.ok) {
      const gsData = await gsRes.json()
      if (gsData[1] && Array.isArray(gsData[1])) gsData[1].forEach(k => keywords.add(k))
    }
  } catch (e) { console.error('Google Suggest Error:', e) }
  try {
    const dmRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(keyword)}&max=10`)
    if (dmRes.ok) {
      const dmData = await dmRes.json()
      dmData.forEach(item => keywords.add(item.word))
    }
  } catch (e) { console.error('Datamuse Error:', e) }
  if (process.env.SERPER_API_KEY) {
    try {
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: keyword })
      })
      if (serperRes.ok) {
        const serperData = await serperRes.json()
        if (serperData.relatedSearches) serperData.relatedSearches.forEach(item => keywords.add(item.query))
      }
    } catch (e) { console.error('Serper API Error:', e) }
  }
  return Array.from(keywords).slice(0, 15)
}

// --- HELPER: MEDIA FETCHERS ---
async function fetchUnsplashImage(query) {
  if (!process.env.UNSPLASH_API_KEY) return null;
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${process.env.UNSPLASH_API_KEY}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return { url: data.results[0].urls.regular, alt: data.results[0].alt_description || query };
    }
  } catch (e) { console.error('Unsplash Error:', e); }
  return null;
}

async function getSmartImageKeyword(topic, heading, genAI) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = `Generate a highly descriptive, aesthetic 2-3 word search query for an Unsplash image related to the topic "${topic}" and specifically the section "${heading}". Reply ONLY with the keywords, no quotes, no extra text.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/['"]/g, '');
  } catch(e) {
    return `${topic} ${heading}`.trim();
  }
}

async function fetchYouTubeVideo(query) {
  if (!process.env.YOUTUBE_API_KEY) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return { id: data.items[0].id.videoId, title: data.items[0].snippet.title };
    }
  } catch (e) { console.error('YouTube Data API Error:', e); }
  return null;
}

async function getSmartVideoQuery(topic, heading, genAI) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    const prompt = `Generate a highly specific, highly relevant 3-5 word YouTube search query for an educational or informative video related to the topic "${topic}" and specifically the section "${heading}". Do NOT use generic words like 'introduction', 'conclusion', or 'tutorial'. Reply ONLY with the exact search query, no quotes.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().replace(/['"]/g, '');
  } catch(e) {
    return `${topic} ${heading}`.trim();
  }
}

export async function POST(request) {
  try {
    const body = await request.json()

    const {
      mode, // Previously causing the action error
      prompt,
      outlineContext,
      heading,
      subheadings,
      sectionIndex,
      uploadedMedia,
      settings = {}
    } = body;

    // Extract all variables including the new Media fields
    const {type, model, targetKeyword, articleTitle, language, country, articleLength, customArticleLength, toneOfVoice, customToneOfVoice,
          pointOfView, useRealTimeSearchData, realTimeDataSource, externalLinks, internalLinks, automaticExternalLinks, deepSearch, includeFaq, includeKeyTakeaways, improveReadability, seoOptimization, manualKeywords, aiImagesAndVideos, enableAutoLength, totalListItems, listNumberingFormat, useDescendingOrder, enableSupplementalInformation, listItemPrompt, numberOfPlaces, generateUniqueMapImages, enableFirstHandExperience
    } = settings;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const langObj = languages ? languages[language] : null;
    const langName = langObj ? langObj.name : (language || 'English');
    const countryObj = countries ? countries.find(c => c.code === country) : null;
    const countryName = countryObj ? countryObj.name : (country || 'United States');


    const baseSystemInstruction = `You are an advanced, lightning-fast AI writing assistant.
      CRITICAL RULE: Do NOT introduce yourself, say "Hello", or mention the name "Cheetah AI" in normal conversation. Just answer the user's prompt directly and naturally.
     CRITICAL LOCALIZATION & LANGUAGE RULES:
      1. You MUST write the ENTIRE article (including all headings, subheadings, and paragraphs) STRICTLY in the following language: ${langName}. Do NOT output English unless the requested language is English.
      2. You MUST tailor the content, cultural references, examples, spelling nuances, and context specifically for this target country/region: ${countryName}.
      IDENTITY RULES (ONLY IF ASKED):
      - NEVER mention Google, Gemini, or being a large language model.
      - If explicitly asked who created you, respond ONLY with: "I was created by the Cheetah AI team."
      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`

 // --- MODE 1: GENERATE OUTLINE ---
    if (mode === 'outline') {
          const outlineModel = genAI.getGenerativeModel({
            model: model || 'gemini-3.1-flash-lite',
            generationConfig: { responseMimeType: "application/json" },
            // UPDATED SCHEMA: Now forces a Catchy Title AND the Outline array separately!
            systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with two keys: "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }`
          })

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

      // --- KEY TAKEAWAYS INSTRUCTION ---
      let takeawaysInstruction = '';
      if (includeKeyTakeaways) {
         takeawaysInstruction = `\nCRITICAL REQUIREMENT - KEY TAKEAWAYS: The second H2 heading (immediately after the Introduction) MUST be titled exactly "Key Takeaways". Do NOT nest any H3 subheadings under it.`;
      }

      let structureInstruction = '';
      let lengthInstruction = '';

      if (type === 'local-roundup') {
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

        lengthInstruction = `CRITICAL: Generate exactly ${itemCount} location items.`;
        structureInstruction = `
          === STRICT LOCAL ROUNDUP STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next H2 headings MUST be the core locations:
          ${placesInstruction}
          - CRITICAL: Do NOT nest any H3 subheadings under the location items.
          3. ${enableSupplementalInformation ? 'After the locations, add exactly TWO additional H2 informational sections (e.g., "What to look for"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${includeFaq ? 'At the very end, add an H2 heading titled "Frequently Asked Questions" and nest 3-5 relevant questions as H3s.' : ''}
        `;
      }
      // --- BRANCH B: LISTICLE (WITH FAQ FIX) ---
      else if (type === 'listicle') {
        const itemCount = enableAutoLength ? 10 : (parseInt(totalListItems) || 10);
        const format = listNumberingFormat || '1.';

        let numberingArray = [];
        for (let i = 1; i <= itemCount; i++) {
          numberingArray.push(format === 'none' ? '' : format.replace('1', i));
        }
        if (useDescendingOrder) numberingArray.reverse();
        const explicitNumberingStr = format === 'none' ? 'Do not use numbering.' : `Use EXACTLY these prefixes in this order for your list items: ${numberingArray.join(', ')}`;

        lengthInstruction = `CRITICAL REQUIREMENT: Generate exactly ${itemCount} list items.`;
        structureInstruction = `
          === STRICT LISTICLE STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next ${itemCount} H2 headings MUST be the core list items/products.
             - ${explicitNumberingStr}
             ${!enableAutoLength ? '- CRITICAL: Do NOT nest any H3 subheadings under these list items.' : ''}
          3. ${enableAutoLength ? 'After the list items, add exactly TWO additional H2 informational sections (e.g., "Buying Guide"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${enableSupplementalInformation ? 'At the very end, add an H2 heading titled "Supplemental Information" with nested H3 subheadings.' : ''}
          5. ${includeFaq ? 'Add an H2 titled "Frequently Asked Questions" with nested H3s.' : ''}
        `;
      }
      // BRANCH B: STANDARD BLOG OUTLINE LOGIC
      else {
        if (articleLength === 'default') lengthInstruction = 'Generate exactly 6 main H2 headings.';
        else if (articleLength === 'shorter') lengthInstruction = 'Generate exactly 3 main H2 headings.';
        else if (articleLength === 'short') lengthInstruction = 'Generate exactly 5 main H2 headings.';
        else if (articleLength === 'medium') lengthInstruction = 'Generate exactly 7 main H2 headings.';
        else if (articleLength === 'long') lengthInstruction = 'Generate exactly 9 main H2 headings.';
        else if (articleLength === 'longer') lengthInstruction = 'Generate exactly 12 main H2 headings.';
        else if (articleLength === 'custom') lengthInstruction = `Generate EXACTLY ${customArticleLength || 9} main H2 headings.`;

        let faqInstruction = '';
        let takeawaysInstruction = includeKeyTakeaways ? `\nThe second H2 heading MUST be "Key Takeaways" with NO nested H3 subheadings.` : '';

        if (includeFaq) {
            faqInstruction = `\nYou MUST include an H2 heading titled "Frequently Asked Questions" and nest 3-5 highly relevant questions as H3 subheadings.`;
        }

        structureInstruction = `
          IMPORTANT STRUCTURE RULES:
          1. The FIRST H2 heading MUST be an Introduction.
          ${takeawaysInstruction}
          2. The LAST H2 heading MUST be a Conclusion.
          ${faqInstruction}
          3. For ALL OTHER H2 headings, nest 2 to 3 relevant H3 subheadings.
        `;
      }

      const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`

      const result = await outlineModel.generateContent(outlinePrompt)
      const parsedData = JSON.parse(result.response.text());

      return NextResponse.json({
        success: true,
        title: parsedData.title,
        outline: parsedData.outline,
        externalLinks: fetchedExternalLinks
      })
    }
    // --- MODE 2: GENERATE SINGLE SECTION ---
    if (mode === 'section') {
      const modelConfig = {
        model: deepSearch ? 'deep-research-preview-04-2026' : (model || 'gemini-2.5-pro'),
        systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
      }

      const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search';

     if (useRealTimeSearchData && isWebSearch) {
        modelConfig.tools = [{
          googleSearchRetrieval: {
            dynamicRetrievalConfig: {
              mode: "MODE_DYNAMIC",
              dynamicThreshold: 0.3
            }
          }
        }];
      }

      const sectionModel = genAI.getGenerativeModel(modelConfig);

      // 1. Live Data Instruction
        let realTimeInstruction = '';
              if (useRealTimeSearchData && (realTimeDataSource === 'news' || realTimeDataSource === 'scholar')) {
                const liveData = await fetchSerperData(`${articleTitle || targetKeyword} ${heading}`, realTimeDataSource);
                if (liveData.length > 0) {
                  const dataStrings = typeof liveData[0] === 'string' ? liveData : liveData.map(d => `${d.title}: ${d.snippet}`);
                  realTimeInstruction = `\nREAL-TIME FACTUAL CONTEXT: Use the following recent data points to make your section highly accurate and up-to-date:\n${dataStrings.join('\n')}`;
                }
              }

      // 2. External Links Instruction
      let extLinkInstruction = '';
      if (externalLinks && externalLinks.length > 0) {
        extLinkInstruction = `\nCRITICAL EXTERNAL LINKING: Naturally weave 3 or 4 of these high-authority external URLs into the text using relevant anchor text: ${externalLinks.join(', ')}. Do not force them if they don't fit perfectly.`;
      }

      // 1. Build Internal Linking Instruction
      const linkInstruction = internalLinks && internalLinks.length > 0
        ? `\nCRITICAL INTERNAL LINKING: Naturally integrate 1 or 2 of the following URLs into your paragraphs using highly relevant, descriptive anchor text. Do not force them if they don't fit perfectly. URLs to use: ${internalLinks.join(', ')}`
        : '';

      // 2. Build Live SEO Instruction
      let seoInstruction = '';
      if (seoOptimization === 'manual' && manualKeywords) {
        seoInstruction = `\nCRITICAL SEO REQUIREMENT: You MUST naturally weave the following exact-match keywords into your paragraphs: ${manualKeywords}.`;
      } else if (seoOptimization === 'ai' && targetKeyword) {
        const liveKeywords = await fetchLiveKeywords(targetKeyword);
        if (liveKeywords.length > 0) {
          seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. We have pulled live search engine data for this topic. You MUST naturally weave several of the following high-value LSI and Google Autocomplete keywords into the paragraphs: ${liveKeywords.join(', ')}.`;
        } else {
          seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. Automatically identify and seamlessly weave high-value LSI (Latent Semantic Indexing) keywords related to "${targetKeyword}" into the paragraphs.`;
        }
      }

      // 3. Advanced Media Infrastructure (Manual Uploads & Structured Auto Pacing)
      let mediaInstruction = '';
      let assignedMediaElement = null; // Used for the post-processing safety guard

// 1. Priority to Manual Uploads (1 file per section, NO repeating)
      if (uploadedMedia && uploadedMedia.length > 0 && sectionIndex < uploadedMedia.length) {
        const mediaItem = uploadedMedia[sectionIndex];

        if (mediaItem.type.startsWith('image/')) {
          assignedMediaElement = `<img src="${mediaItem.url}" alt="${mediaItem.name}" class="rounded-xl shadow-md my-8 w-full aspect-video object-cover" />`;

        } else if (mediaItem.type.startsWith('video/')) {
          assignedMediaElement = `<video src="${mediaItem.url}" controls></video>`;
        }
        mediaInstruction = `\n[NOTE: A media file is placed at the end of this section. DO NOT output HTML tags for media.]`;

      }
      // 2. Fallback to Auto AI Media (Every section gets media)
      else if (aiImagesAndVideos === 'auto') {

        // Alternate every single section: Even = Unsplash, Odd = YouTube
        if (sectionIndex % 2 === 0) {
          // Unsplash Images
          const smartQuery = await getSmartImageKeyword(articleTitle || targetKeyword, heading, genAI);
          const unsplashData = await fetchUnsplashImage(smartQuery);
          const imgUrl = unsplashData ? unsplashData.url : `https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80`;
          const imgAlt = unsplashData ? unsplashData.alt : heading;

          assignedMediaElement = `<img src="${imgUrl}" alt="${imgAlt}" class="rounded-xl shadow-md my-8 w-full aspect-video object-cover" />`;
        } else {
          // YouTube Videos
          const smartYtQuery = await getSmartVideoQuery(articleTitle || targetKeyword, heading, genAI);
          const ytVideo = await fetchYouTubeVideo(smartYtQuery);
          if (ytVideo) {
            assignedMediaElement = `<div data-youtube-video><iframe src="https://www.youtube.com/embed/${ytVideo.id}" title="${ytVideo.title}"></iframe></div>`;
          }
        }
        mediaInstruction = `\n[NOTE: A contextual image or video is placed at the end of this section. DO NOT attempt to generate image/video tags yourself.]`;
      }

      // 4. Build Tone Instruction
      let toneInstruction = '';
      if (toneOfVoice === 'custom' && customToneOfVoice) {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a ${customToneOfVoice} tone of voice.`;
      } else if (toneOfVoice && toneOfVoice !== 'seo') {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a heavily ${toneOfVoice} tone of voice.`;
      } else {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using an SEO Optimized (Confident, Knowledgeable, Neutral, and Clear) tone of voice.`;
      }

      let povInstruction = '';
      if (pointOfView === 'first') {
        povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Singular perspective (using pronouns like 'I', 'me', 'my', 'myself').`;
      } else if (pointOfView === 'first-plural') {
        povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Plural perspective (using pronouns like 'we', 'us', 'our', 'ourselves').`;
      } else if (pointOfView === 'second') {
        povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Second Person perspective (using pronouns like 'you', 'your', 'yours').`;
      } else {
        povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Third Person perspective (using pronouns like 'he', 'she', 'it', 'they', 'their').`;
      }

      // 6. Readability Instruction
      let readabilityInstruction = '';
      if (improveReadability) {
        readabilityInstruction = `\nSTYLING & READABILITY: You MUST heavily format this section to be highly skimmable. Use bullet points, numbered lists, and bold text for important concepts, terms, or key phrases. Avoid writing long, blocky paragraphs. Break text up aggressively.`;
      } else {
        readabilityInstruction = `\nSTYLING & READABILITY: Write in standard, flowing paragraph format. Do not aggressively use bullet points or bold text unless explicitly necessary for a list.`;
      }

      let sectionStructureRequirements = '';
        if (type === 'local-roundup') {
            const isCoreLocation = (!subheadings || subheadings.length === 0) && !heading.toLowerCase().includes('introduction') && !heading.toLowerCase().includes('faq') && !heading.toLowerCase().includes('supplemental');
            if (isCoreLocation) {
          // 1. Fetch exact data for this specific location
          const placeInfo = await fetchSerperPlacesData(`${heading} ${targetKeyword || ''}`, 1, country, language);
          const p = placeInfo.length > 0 ? placeInfo[0] : null;
          let placeDataStr = '';
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

          const narrativeRequirement = enableFirstHandExperience
            ? 'Write a compelling "First-Hand Experience" review (2 paragraphs) as if you personally visited this location. Use words like "When I visited", "My experience", etc.'
            : 'Write a highly detailed, objective description (2 paragraphs) of this location, its atmosphere, and its best offerings.';

          sectionStructureRequirements = `
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
        }
        } else if (type === 'listicle') {
        // Only apply List Item Custom Prompt if there are NO subheadings (indicating it is a core list item)
        const isCoreListItem = (!subheadings || subheadings.length === 0);
        const listPromptInject = isCoreListItem && listItemPrompt
          ? `\nSPECIAL LIST ITEM REQUIREMENT: ${listItemPrompt}`
          : '';

        sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (LISTICLE MODE):
          1. You are writing content strictly for the heading: "${heading}".
          2. Do NOT add an introduction paragraph before your subheadings if you have subheadings. Go straight to the content.
          ${subheadings && subheadings.length > 0 ? `3. You MUST cover the following subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : '3. Do NOT add any H3 subheadings. Write the content directly under the main heading.'}
          ${listPromptInject}
        `;
      } else {
        sectionStructureRequirements = `
          CRITICAL STRUCTURE REQUIREMENTS (STANDARD MODE):
          1. You MUST first write a strong introductory paragraph directly under the main heading "${heading}". Do not leave it blank!
          ${subheadings && subheadings.length > 0 ? `2. After the intro, cover these subheadings exactly as H3s (### [Title]):\n${subheadings.join('\n')}` : ''}
        `;
      }

      // 4. Assemble the Final Prompt
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
      return NextResponse.json({ success: true, text: result.response.text(), mediaHtml: assignedMediaElement})
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    const defaultModel = genAI.getGenerativeModel({
      model: model || 'gemini-3.1-flash-lite',
      systemInstruction: baseSystemInstruction
    })
    const result = await defaultModel.generateContent(prompt)
    return NextResponse.json({ success: true, text: result.response.text() })

  } catch (error) {
    console.error('Gemini API Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}

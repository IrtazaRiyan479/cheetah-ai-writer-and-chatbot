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

    // Format based on the endpoint used
    if (type === 'news' && data.news) return data.news.slice(0, 4).map(n => `${n.title}: ${n.snippet}`);
    if (type === 'scholar' && data.organic) return data.organic.slice(0, 4).map(o => `${o.title}: ${o.snippet}`);
    if (data.organic) return data.organic.slice(0, 4); // Returns full object for Web/Search
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

async function fetchYouTubeVideo(query) {
  if (!process.env.YOUTUBE_API_KEY) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return { id: data.items[0].id.videoId, title: data.items[0].snippet.title };
    }
  } catch (e) { console.error('YouTube Error:', e); }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Extract all variables including the new Media fields
    const { prompt, model, mode, targetKeyword, outlineContext, heading, subheadings, internalLinks, seoOptimization, manualKeywords, aiImagesAndVideos, sectionIndex, totalSections, articleLength, customArticleLength, toneOfVoice, customToneOfVoice, language, country, pointOfView, useRealTimeSearchData, realTimeDataSource, externalLinks, automaticExternalLinks, deepSearch, articleTitle, includeFaq, includeKeyTakeaways, improveReadability } = body
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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

      // 1. Give every single option (including default) a strict H2 constraint
      let lengthInstruction = '';
      if (articleLength === 'default') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 6 main H2 headings.';
      else if (articleLength === 'shorter') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 3 main H2 headings.';
      else if (articleLength === 'short') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 5 main H2 headings.';
      else if (articleLength === 'medium') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 7 main H2 headings.';
      else if (articleLength === 'long') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 9 main H2 headings.';
      else if (articleLength === 'longer') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 12 main H2 headings.';
      else if (articleLength === 'custom') lengthInstruction = `CRITICAL REQUIREMENT: Generate EXACTLY ${customArticleLength || 9} main H2 headings. No more, no less.`;

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

      const structureInstruction = `
        IMPORTANT STRUCTURE RULES:
        1. The FIRST H2 heading MUST be an Introduction. Do NOT use the article title here!
        ${takeawaysInstruction}
        2. The LAST H2 heading MUST be a Conclusion.
        ${faqInstruction}
        3. For ALL OTHER H2 headings, nest 2 to 3 relevant H3 subheadings.
        ${relatedInstruction}
      `

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
              dynamicThreshold: 0.3 // Tells Gemini to actively use Search for this prompt
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

      // 3. Build Auto Media Instruction (Unsplash & YouTube)
      let mediaInstruction = '';
      if (aiImagesAndVideos === 'auto') {
        const searchQuery = `${articleTitle || targetKeyword} ${heading}`.trim();

        // Fetch Image for the 1st section
        if (sectionIndex === 0) {
          const img = await fetchUnsplashImage(searchQuery);
          if (img) {
            mediaInstruction = `\nCRITICAL MEDIA REQUIREMENT: You MUST embed this image directly below the main heading using HTML: <img src="${img.url}" alt="${img.alt}" style="width:100%; border-radius:8px; margin: 1.5rem 0;" />`;
          }
        }
        // Fetch Video for the middle section
        else if (sectionIndex === Math.floor(totalSections / 2)) {
          const vid = await fetchYouTubeVideo(searchQuery);
          if (vid) {
            mediaInstruction = `\nCRITICAL MEDIA REQUIREMENT: You MUST embed this YouTube video directly below the main heading using an iframe: <iframe width="100%" height="450" src="https://www.youtube.com/embed/${vid.id}" title="${vid.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius:8px; margin: 1.5rem 0;"></iframe>`;
          }
        }
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

      // 4. Assemble the Final Prompt
      const sectionPrompt = `
        Article Title/Context: ${articleTitle || targetKeyword}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

        CRITICAL STRUCTURE REQUIREMENTS:
        1. You MUST first write a strong introductory paragraph (or two) directly under the main heading "${heading}" before moving to any subheadings. Do not leave the space under the main heading blank!
        ${subheadings && subheadings.length > 0 ? `2. After your introductory paragraph(s), you MUST structure the rest of the response to cover the following subheadings. Use exactly '### [Subheading Title]' to denote them so they format correctly:\n${subheadings.join('\n')}` : ''}

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
      return NextResponse.json({ success: true, text: result.response.text() })
    }

    // --- FALLBACK: STANDARD GENERATION ---
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

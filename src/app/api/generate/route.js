import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

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
    const { prompt, model, mode, targetKeyword, outlineContext, heading, subheadings, internalLinks, seoOptimization, manualKeywords, aiImagesAndVideos, sectionIndex, totalSections, articleLength, customArticleLength, toneOfVoice, customToneOfVoice, language } = body

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const baseSystemInstruction = `You are an advanced, lightning-fast AI writing assistant.
      CRITICAL RULE: Do NOT introduce yourself, say "Hello", or mention the name "Cheetah AI" in normal conversation. Just answer the user's prompt directly and naturally.
      CRITICAL LANGUAGE RULE: You MUST write the entire article and all responses in the following language code: ${language}. If the language is not English, ensure you use native grammar, spelling, and cultural context for that specific region.
      IDENTITY RULES (ONLY IF ASKED):
      - NEVER mention Google, Gemini, or being a large language model.
      - If explicitly asked who created you, respond ONLY with: "I was created by the Cheetah AI team."
      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`

 // --- MODE 1: GENERATE OUTLINE ---
    if (mode === 'outline') {
      const outlineModel = genAI.getGenerativeModel({
        model: model || 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert SEO content strategist. Generate a highly-engaging article outline. You MUST return a flat JSON array of objects. Schema: [{ "type": "h2", "text": "Main Heading" }, { "type": "h3", "text": "Subheading" }]`
      })

      // 1. Give every single option (including default) a strict H2 constraint
      let lengthInstruction = '';
      if (articleLength === 'default') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 6 main H2 headings.';
      else if (articleLength === 'shorter') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 3 main H2 headings.';
      else if (articleLength === 'short') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 5 main H2 headings.';
      else if (articleLength === 'medium') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 7 main H2 headings.';
      else if (articleLength === 'long') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 9 main H2 headings.';
      else if (articleLength === 'longer') lengthInstruction = 'CRITICAL REQUIREMENT: Generate exactly 12 main H2 headings.';
      else if (articleLength === 'custom') lengthInstruction = `CRITICAL REQUIREMENT: Generate EXACTLY ${customArticleLength || 5} main H2 headings. No more, no less.`;

      // 2. FORCE Introduction and Conclusion + H3 logic
      const structureInstruction = `
        IMPORTANT STRUCTURE RULES:
        1. The FIRST H2 heading MUST be an Introduction (e.g., "Introduction to [Topic]").
        2. The LAST H2 heading MUST be a Conclusion.
        3. For ALL OTHER H2 headings in the body, you MUST nest 2 to 3 relevant H3 subheadings directly underneath them.
        4. Do NOT put H3 subheadings under the Introduction or Conclusion.
      `

      const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`

      const result = await outlineModel.generateContent(outlinePrompt)
      return NextResponse.json({ success: true, outline: JSON.parse(result.response.text()) })
    }
    // --- MODE 2: GENERATE SINGLE SECTION ---
    if (mode === 'section') {
      const sectionModel = genAI.getGenerativeModel({
        model: model || 'gemini-2.5-pro',
        systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
      })

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
        const searchQuery = `${targetKeyword} ${heading}`.trim();

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

      // 4. Assemble the Final Prompt
      const sectionPrompt = `
        Article Topic: ${targetKeyword}
        Full Article Outline for Context: ${JSON.stringify(outlineContext)}

        TASK: Write a comprehensive section focusing ONLY on the main heading: "${heading}".

        CRITICAL STRUCTURE REQUIREMENTS:
        1. You MUST first write a strong introductory paragraph (or two) directly under the main heading "${heading}" before moving to any subheadings. Do not leave the space under the main heading blank!
        ${subheadings && subheadings.length > 0 ? `2. After your introductory paragraph(s), you MUST structure the rest of the response to cover the following subheadings. Use exactly '### [Subheading Title]' to denote them so they format correctly:\n${subheadings.join('\n')}` : ''}

        ${linkInstruction}
        ${seoInstruction}
        ${mediaInstruction}
        ${toneInstruction}
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

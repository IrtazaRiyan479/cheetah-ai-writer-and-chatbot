import { YoutubeTranscript } from 'youtube-transcript';

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

export async function fetchPeopleAlsoSearchFor(query) {
  if (!process.env.SERPER_API_KEY) return [];
  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query })
    });

    const data = await res.json();
    const lsiKeywords = new Set();

    // Extract "People Also Ask" (Questions)
    if (data.peopleAlsoAsk && Array.isArray(data.peopleAlsoAsk)) {
      data.peopleAlsoAsk.forEach(item => lsiKeywords.add(item.question));
    }

    // Extract "Related Searches" (Search queries)
    if (data.relatedSearches && Array.isArray(data.relatedSearches)) {
      data.relatedSearches.forEach(item => lsiKeywords.add(item.query));
    }

    return Array.from(lsiKeywords).slice(0, 8);
  } catch (e) {
    console.error('Serper LSI Fetch Error:', e);
    return [];
  }
}

export async function fetchArticleData(url) {
  if (!url) return { success: false, text: '', title: '' };

  try {
    // r.jina.ai is a free, powerful tool that converts any URL into clean Markdown,
    // removing ads, navbars, and junk—perfect for LLM processing.
    const res = await fetch(`https://r.jina.ai/${url}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch article: ${res.statusText}`);
    }

    const markdownText = await res.text();

    // Extract a rough title from the markdown if possible (usually the first line)
    const firstLine = markdownText.split('\n')[0];
    const extractedTitle = firstLine.replace(/^#+\s*/, '').trim() || 'Extracted Article';

    return {
      success: true,
      text: markdownText,
      title: extractedTitle
    };
  } catch (error) {
    console.error('Article Fetch Error:', error);
    return { success: false, text: '', error: error.message };
  }
}

export async function fetchSerperOutlineData(query) {
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

export async function fetchSerperPlacesData(query, count = 10, countryCode = 'us', languageCode = 'en') {
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

export async function fetchYoutubeVideoData(url) {
  try {
    // 1. Fetch Video Metadata via YouTube's public oEmbed API
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!oembedRes.ok) throw new Error('Invalid YouTube URL or private video.');
    const metadata = await oembedRes.json();

    // 2. Fetch Transcript
    const transcriptArray = await YoutubeTranscript.fetchTranscript(url);
    const fullTranscript = transcriptArray.map(t => t.text).join(' ');

    return {
      success: true,
      title: metadata.title,
      author: metadata.author_name,
      thumbnail: metadata.thumbnail_url,
      transcript: fullTranscript
    };
  } catch (error) {
    console.error('YouTube Fetch Error:', error.message);
    return { success: false, error: error.message };
  }
}

export function getBaseSystemInstruction(language, country) {
  const baseSystemInstruction = `You are an advanced, lightning-fast AI writing assistant.
      CRITICAL RULE: Do NOT introduce yourself, say "Hello", or mention the name "Cheetah AI" in normal conversation. Just answer the user's prompt directly and naturally.
     CRITICAL LOCALIZATION & LANGUAGE RULES:
      1. You MUST write the ENTIRE article (including all headings, subheadings, and paragraphs) STRICTLY in the following language: ${language}. Do NOT output English unless the requested language is English.
      2. You MUST tailor the content, cultural references, examples, spelling nuances, and context specifically for this target country/region: ${country}.
      IDENTITY RULES (ONLY IF ASKED):
      - NEVER mention Google, Gemini, or being a large language model.
      - If explicitly asked who created you, respond ONLY with: "I was created by the Cheetah AI team."
      Your primary goal is to help users generate professional content, brainstorm ideas, and answer questions accurately.`
  return baseSystemInstruction;
}

export function getToneInstruction(toneOfVoice, customToneOfVoice) {
      let toneInstruction = '';
      if (toneOfVoice === 'custom' && customToneOfVoice) {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a ${customToneOfVoice} tone of voice.`;
      } else if (toneOfVoice && toneOfVoice !== 'seo') {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a heavily ${toneOfVoice} tone of voice.`;
      } else {
        toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using an SEO Optimized (Confident, Knowledgeable, Neutral, and Clear) tone of voice.`;
      }
      return toneInstruction;
}

export function getPovInstruction(pointOfView) {
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
      return povInstruction;
}

export async function getSeoInstruction(seoOptimization, manualKeywords, targetKeyword) {
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
      return seoInstruction;
}

export async function getMediaInstruction(uploadedMedia, sectionIndex, aiImagesAndVideos, articleTitle, targetKeyword, heading, genAI) {
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

      return { mediaInstruction, assignedMediaElement };
}

export function getReadabilityInstruction(improveReadability) {
      let readabilityInstruction = '';
      if (improveReadability) {
        readabilityInstruction = `\nSTYLING & READABILITY: You MUST heavily format this section to be highly skimmable. Use bullet points, numbered lists, and bold text for important concepts, terms, or key phrases. Avoid writing long, blocky paragraphs. Break text up aggressively.`;
      } else {
        readabilityInstruction = `\nSTYLING & READABILITY: Write in standard, flowing paragraph format. Do not aggressively use bullet points or bold text unless explicitly necessary for a list.`;
      }
      return readabilityInstruction;
}

export async function getRealTimeInstruction(useRealTimeSearchData, realTimeDataSource, articleTitle, targetKeyword, heading) {
          let realTimeInstruction = '';
              if (useRealTimeSearchData && (realTimeDataSource === 'news' || realTimeDataSource === 'scholar')) {
                const liveData = await fetchSerperData(`${articleTitle || targetKeyword} ${heading}`, realTimeDataSource);
                if (liveData.length > 0) {
                  const dataStrings = typeof liveData[0] === 'string' ? liveData : liveData.map(d => `${d.title}: ${d.snippet}`);
                  realTimeInstruction = `\nREAL-TIME FACTUAL CONTEXT: Use the following recent data points to make your section highly accurate and up-to-date:\n${dataStrings.join('\n')}`;
                }
              }
              return realTimeInstruction;
}

export function getExternalLinkInstruction(externalLinks) {
        let extLinkInstruction = '';
      if (externalLinks && externalLinks.length > 0) {
        extLinkInstruction = `\nCRITICAL EXTERNAL LINKING: Naturally weave 3 or 4 of these high-authority external URLs into the text using properly formatted Markdown links (e.g., [anchor text](URL)). URLs to use: ${externalLinks.join(', ')}. Do not force them if they don't fit perfectly.`;
      }
      return extLinkInstruction;
    }

export function getLinkInstruction(internalLinks) {
        const linkInstruction = internalLinks && internalLinks.length > 0
        ? `\nCRITICAL INTERNAL LINKING: Naturally integrate 1 or 2 of the following URLs into your paragraphs using properly formatted Markdown links (e.g., [anchor text](URL)). URLs to use: ${internalLinks.join(', ')}. Do not force them if they don't fit perfectly.`
        : '';
        return linkInstruction;
}

import { YoutubeTranscript } from 'youtube-transcript'

import { callLightLLM, parseJsonSafe } from './lightLLM'

export function mediaKey(item) {
  if (!item) return ''

  if (typeof item === 'object' && item.id != null) {
    return `${String(item.source || 'img').toLowerCase()}:${item.id}`
  }

  const url = typeof item === 'string' ? item : item.url || ''

  if (!url) return ''

  try {
    const u = new URL(url)

    u.search = ''
    u.hash = ''

    const unsplash = u.pathname.match(/photo-([a-zA-Z0-9_-]+)/)

    if (unsplash) return `unsplash:${unsplash[1]}`

    const pexels = u.pathname.match(/\/photos\/(\d+)/)

    if (pexels) return `pexels:${pexels[1]}`

    // Pixabay /get/gHASH_640.jpg is a download token, NOT a photo id
    const pix = u.pathname.match(/\/get\/g([a-f0-9]+)_/)

    if (pix) return `pixabay-file:${pix[1]}`

    return `${u.origin}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return String(url).split('?')[0]
  }
}

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'arent',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'cant',
  'cannot',
  'could',
  'couldnt',
  'did',
  'didnt',
  'do',
  'does',
  'doesnt',
  'doing',
  'dont',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'hadnt',
  'has',
  'hasnt',
  'have',
  'havent',
  'having',
  'he',
  'hed',
  'hell',
  'hes',
  'her',
  'here',
  'heres',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'hows',
  'i',
  'id',
  'ill',
  'im',
  'ive',
  'if',
  'in',
  'into',
  'is',
  'isnt',
  'it',
  'its',
  'itself',
  'lets',
  'me',
  'more',
  'most',
  'mustnt',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'shant',
  'she',
  'shed',
  'shell',
  'shes',
  'should',
  'shouldnt',
  'so',
  'some',
  'such',
  'than',
  'that',
  'thats',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'theres',
  'these',
  'they',
  'theyd',
  'theyll',
  'theyre',
  'theyve',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'wasnt',
  'we',
  'wed',
  'well',
  'were',
  'weve',
  'werent',
  'what',
  'whats',
  'when',
  'whens',
  'where',
  'wheres',
  'which',
  'while',
  'who',
  'whos',
  'whom',
  'why',
  'whys',
  'with',
  'wont',
  'would',
  'wouldnt',
  'you',
  'youd',
  'youll',
  'youre',
  'youve',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'guide',
  'best',
  'top',
  'vs',
  'versus',
  'can',
  'will',
  'introduction',
  'conclusion',
  'overview',
  'summary',
  'tips',
  'ways',
  'things',
  'how',
  'what',
  'why',
  'when',
  'where',
  'caring',
  'care',
  'old',
  'new',
  'ultimate',
  'complete'
])

function isUsed(candidate, usedList) {
  const used = new Set((usedList || []).map(mediaKey))
  const keys = [mediaKey(candidate), candidate.url, String(candidate.id || '')].filter(Boolean)

  return keys.some(k => used.has(k) || used.has(mediaKey(k)))
}

export async function fetchPexelsImage(query, { page = 1, perPage = 12 } = {}) {
  if (!process.env.PEXELS_API_KEY) return []

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    )

    if (!res.ok) return []
    const data = await res.json()

    return (data.photos || []).map(p => ({
      id: p.id,
      url: p.src.large,
      alt: p.alt || query,
      source: 'Pexels'
    }))
  } catch (e) {
    console.error('Pexels Error:', e)

    return []
  }
}

export async function fetchPixabayImage(query, { page = 1, perPage = 15 } = {}) {
  if (!process.env.PIXABAY_API_KEY) return []

  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${perPage}&page=${page}`
    )

    if (!res.ok) return []
    const data = await res.json()

    if (!data.hits?.length) return []

    return data.hits.map(h => ({
      id: h.id, // stable photo id — this is what you track
      url: h.webformatURL || h.largeImageURL,
      alt: h.tags || query,
      source: 'Pixabay'
    }))
  } catch (e) {
    console.error('Pixabay API Error:', e)

    return []
  }
}

export async function fetchUnsplashImage(query, { page = 1, perPage = 10 } = {}) {
  if (!process.env.UNSPLASH_API_KEY) return []

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape&client_id=${process.env.UNSPLASH_API_KEY}`
    )

    if (!res.ok) return []
    const data = await res.json()

    return (data.results || []).map(r => ({
      id: r.id,
      url: r.urls.regular,
      alt: r.alt_description || query,
      source: 'Unsplash'
    }))
  } catch (e) {
    console.error('Unsplash Error:', e)

    return []
  }
}

const NON_VISUAL_WORDS = new Set([
  ...STOP_WORDS,
  'train',
  'training',
  'teach',
  'teaching',
  'learn',
  'learning',
  'mastering',
  'establishing',
  'developing',
  'understanding',
  'caring',
  'care',
  'guide',
  'tips',
  'ways',
  'best',
  'top',
  'how',
  'what',
  'why',
  'when',
  'first',
  'weeks',
  'week',
  'old',
  'new',
  'ultimate',
  'complete',
  'comprehensive',
  'introduction',
  'conclusion',
  'overview',
  'importance',
  'using',
  'ensure',
  'must'
])

function visualTokens(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !NON_VISUAL_WORDS.has(w))
}

function coreSubjectQuery(topic, heading) {
  const topicVis = visualTokens(topic).slice(0, 3) // e.g. german shepherd puppy

  const headingVis = visualTokens(heading)
    .filter(w => !topicVis.includes(w))
    .slice(0, 2) // e.g. crate, leash, obedience

  const q = [...topicVis, ...headingVis].join(' ').trim()

  return q || topicVis.join(' ') || (topic || 'dog puppy').trim()
}

async function getSmartImageKeyword(topic, heading, _genAI) {
  const visualFallback = () => {
    const stockSearchQuery = coreSubjectQuery(topic, heading)

    return {
      isRealisticStockPhoto: true,
      stockSearchQuery,
      aiGenerationPrompt: `Photorealistic photo of ${stockSearchQuery}, clearly showing the main subject, no text, no watermark`
    }
  }

  try {
    const result = await callLightLLM({
      system: 'Reply with JSON only. No markdown.',
      json: true,
      max_tokens: 160,
      waitOn429: false,
      prompt: `Stock PHOTO search query for a blog image.
Article topic (MAIN SUBJECT — must appear in the query): "${topic}"
Section heading: "${heading}"

RULES:
- stockSearchQuery MUST include the visual subject from the topic (e.g. "german shepherd puppy").
- Add 1-2 concrete nouns from the heading (crate, leash, food bowl, backyard) ONLY if they are photographable objects.
- NEVER use verbs: train, training, teach, how, guide, weeks, importance, establishing.
- NEVER return transport, cities, portraits of strangers, or unrelated objects.

JSON: {"isRealisticStockPhoto":true,"stockSearchQuery":"3-6 words","aiGenerationPrompt":"photorealistic prompt"}`
    })

    const parsed = parseJsonSafe(result?.text)
    const topicVis = visualTokens(topic)
    const q = String(parsed?.stockSearchQuery || '').toLowerCase()
    const hasSubject = topicVis.length === 0 || topicVis.some(t => q.includes(t))

    if (typeof parsed?.isRealisticStockPhoto === 'boolean' && parsed.stockSearchQuery && hasSubject) {
      return parsed
    }
  } catch (e) {
    console.warn('[smart-image] light LLM skipped', e?.message || e)
  }

  return visualFallback()
}

export function calculateRelevanceScore(altText, query, topic) {
  if (!altText) return 0

  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'to',
    'in',
    'on',
    'with',
    'by',
    'for',
    'at',
    'about',
    'is',
    'are',
    'photo',
    'image',
    'picture',
    'background',
    'isolated',
    'stock',
    'closeup',
    'close',
    'up',
    'shot',
    'view',
    'horizontal',
    'vertical'
  ])

  const clean = str =>
    (str || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))

  const altTokens = clean(altText)
  const altJoined = altTokens.join(' ')
  const altSet = new Set(altTokens)
  const queryTokens = clean(query)
  const topicTokens = clean(topic)
  const targetTokens = [...new Set([...queryTokens, ...topicTokens])]

  if (targetTokens.length === 0) return 0

  const animalHints = [
    'dog',
    'puppy',
    'puppies',
    'canine',
    'cat',
    'kitten',
    'pet',
    'breed',
    'shepherd',
    'retriever',
    'labrador',
    'terrier',
    'hound'
  ]

  const topicLower = (topic || '').toLowerCase()
  const topicIsAnimal = animalHints.some(h => topicLower.includes(h))

  if (topicIsAnimal) {
    const altHasAnimal = animalHints.some(h => altJoined.includes(h))

    if (!altHasAnimal) return 0
  }

  const offTopic = [
    'train',
    'railway',
    'subway',
    'metro',
    'locomotive',
    'station',
    'kyoto',
    'japan',
    'tokyo',
    'tram',
    'bus',
    'airplane',
    'airport',
    'cone',
    'traffic',
    'stadium',
    'construction',
    'barrier',
    'woman',
    'man',
    'girl',
    'boy',
    'portrait',
    'people',
    'person',
    'crowd'
  ]

  const offHits = offTopic.filter(w => altJoined.includes(w) && !topicLower.includes(w)).length

  if (offHits >= 2) return 0

  let score = 0
  let matched = 0

  targetTokens.forEach(token => {
    if (NON_VISUAL_WORDS?.has?.(token)) return

    if (altSet.has(token)) {
      score += 2.5
      matched += 1
    } else {
      for (const alt of altTokens) {
        if (alt.includes(token) || token.includes(alt)) {
          score += 1.0
          matched += 0.5
          break
        }
      }
    }
  })

  const queryPhrase = queryTokens.filter(t => !NON_VISUAL_WORDS?.has?.(t)).join(' ')

  if (queryPhrase.length > 4 && altJoined.includes(queryPhrase)) score += 4

  if (targetTokens.length) score += (matched / targetTokens.length) * 3

  if (topicIsAnimal) {
    const humanHits = ['man', 'woman', 'person', 'people', 'portrait', 'face'].filter(h => altJoined.includes(h)).length

    if (humanHits > 0) score -= humanHits * 4
  }

  return Math.max(0, score)
}

export async function generateFallbackImage(prompt) {
  if (!process.env.GEMINI_FREE_API_KEY) return null

  try {
    const finalPrompt = `photorealistic style, landscape orientation, highly detailed. ${prompt}`

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: { imageConfig: { aspectRatio: '16:9' } }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent?key=${process.env.GEMINI_FREE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    )

    const data = await res.json()
    let originalBase64 = null

    data.candidates?.forEach(candidate => {
      candidate.content?.parts?.forEach(part => {
        if (part.inlineData?.data) originalBase64 = part.inlineData.data
        else if (part.inline_data?.data) originalBase64 = part.inline_data.data
      })
    })

    if (originalBase64) {
      return {
        url: `data:image/png;base64,${originalBase64}`,
        alt: `AI Generated: ${prompt}`,
        source: 'Gemini'
      }
    }
  } catch (e) {
    console.error('Gemini Image Gen Fallback Error:', e)
  }

  return null
}

export async function fetchSerperData(query, type = 'search') {
  if (!process.env.SERPER_API_KEY) return []

  try {
    const res = await fetch(`https://google.serper.dev/${type}`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    })

    const data = await res.json()

    if (type === 'news' && data.news) return data.news.slice(0, 4).map(n => `${n.title}: ${n.snippet}`)
    if (type === 'scholar' && data.organic) return data.organic.slice(0, 4).map(o => `${o.title}: ${o.snippet}`)
    if (data.organic) return data.organic.slice(0, 4)

    return []
  } catch (e) {
    console.error('Serper API Error:', e)

    return []
  }
}

export async function fetchLiveKeywords(keyword) {
  const keywords = new Set()

  if (!keyword) return []

  try {
    const gsRes = await fetch(
      `http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(keyword)}`
    )

    if (gsRes.ok) {
      const gsData = await gsRes.json()

      if (gsData[1] && Array.isArray(gsData[1])) gsData[1].forEach(k => keywords.add(k))
    }
  } catch (e) {
    console.error('Google Suggest Error:', e)
  }

  try {
    const dmRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(keyword)}&max=10`)

    if (dmRes.ok) {
      const dmData = await dmRes.json()

      dmData.forEach(item => keywords.add(item.word))
    }
  } catch (e) {
    console.error('Datamuse Error:', e)
  }

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
    } catch (e) {
      console.error('Serper API Error:', e)
    }
  }

  return Array.from(keywords).slice(0, 15)
}

export async function fetchBingTitles(query) {
  const titles = new Set()

  try {
    if (process.env.SERP_API_KEY) {
      const serpUrl = new URL('https://serpapi.com/search.json')

      serpUrl.searchParams.append('engine', 'bing')
      serpUrl.searchParams.append('q', query)
      serpUrl.searchParams.append('cc', 'US')
      serpUrl.searchParams.append('api_key', process.env.SERP_API_KEY)

      const serpRes = await fetch(serpUrl)

      if (serpRes.ok) {
        const serpData = await serpRes.json()

        if (serpData.organic_results) {
          serpData.organic_results.forEach(item => titles.add(item.title))

          return Array.from(titles)
        }
      }
    }
  } catch (e) {
    console.error('SerpAPI Bing Error:', e)
  }

  try {
    if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
      const credentials = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString(
        'base64'
      )

      const postData = [{ keyword: query, language_code: 'en', location_code: 2840 }]

      const dfsRes = await fetch('https://api.dataforseo.com/v3/serp/bing/organic/live/advanced', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (dfsRes.ok) {
        const dfsData = await dfsRes.json()
        const results = dfsData.tasks?.[0]?.result?.[0]?.items || []

        results.forEach(item => titles.add(item.title))
      }
    }
  } catch (e) {
    console.error('DataForSEO Error:', e)
  }

  return Array.from(titles)
}

export async function fetchYouTubeVideo(query) {
  if (!process.env.YOUTUBE_API_KEY) return null

  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=8&videoEmbeddable=true&key=${process.env.YOUTUBE_API_KEY}`
      )

      if (!res.ok) {
        console.error(`YouTube Data API HTTP ${res.status} (attempt ${attempt})`)
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 800 * attempt))
        continue
      }

      const data = await res.json()

      if (data.items && data.items.length > 0) {
        return data.items
          .filter(item => item?.id?.videoId)
          .map(item => ({
            id: item.id.videoId,
            title: item.snippet?.title || 'YouTube video'
          }))
      }

      return null
    } catch (e) {
      console.error(`YouTube Data API Error (attempt ${attempt}):`, e?.message || e)
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 800 * attempt))
    }
  }

  return null
}

export async function isYouTubeVideoAvailable(url) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const res = await fetch(oembedUrl, { signal: controller.signal })

    clearTimeout(timer)

    return res.ok
  } catch (error) {
    // Network blip → assume embeddable rather than killing the section
    console.warn('YouTube oEmbed check failed, assuming available:', error?.message || error)

    return true
  }
}

async function getSmartVideoQuery(topic, heading, _genAI) {
  const fallback = () => {
    const cleanTopic = (topic || '').toLowerCase().replace(/[^\w\s]|_/g, '')
    const fallbackWords = cleanTopic.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))

    return fallbackWords.slice(0, 4).join(' ') || (topic || '').trim() || 'tutorial'
  }

  //   try {
  //     const prompt = `Generate a highly specific 3-5 word YouTube search query for an educational video.
  // CRITICAL RULE 1: The query MUST be primarily about the main topic: "${topic}".
  // CRITICAL RULE 2: Integrate context from the section heading "${heading}" but do not lose the main topic.
  // CRITICAL RULE 3: Do NOT use generic words like 'introduction', 'conclusion', 'tutorial', or 'video'.
  // Reply ONLY with the exact search query, no quotes.`

  //     const result = await callLightLLM({ prompt })

  //     if (!result?.text) return fallback()

  //     const keyword = result.text.trim().replace(/['"]/g, '')
  //     const cleanTopic = (topic || '').toLowerCase().replace(/[^\w\s]|_/g, '')
  //     const cleanKeyword = keyword.toLowerCase().replace(/[^\w\s]|_/g, '')
  //     const topicWords = cleanTopic.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  //     const isRelated = topicWords.some(w => cleanKeyword.includes(w))

  //     if (!isRelated && topicWords.length > 0) {
  //       return topicWords.slice(0, 4).join(' ')
  //     }

  //     return keyword || topicWords.slice(0, 4).join(' ') || topic.trim()
  //   } catch (e) {
  //     console.error('getSmartVideoQuery Error:', e?.message || e)

  //     return fallback()
  //   }

  return fallback()
}

export async function fetchPeopleAlsoSearchFor(query) {
  const bingKeywords = new Set()
  const googleKeywords = new Set()

  const bingTitles = await fetchBingTitles(query)

  bingTitles.forEach(title => bingKeywords.add(title))

  if (!process.env.SERPER_API_KEY) {
    return { bing: Array.from(bingKeywords).slice(0, 10), google: [] }
  }

  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    })

    const data = await res.json()

    if (data.peopleAlsoAsk) data.peopleAlsoAsk.forEach(item => googleKeywords.add(item.question))
    if (data.relatedSearches) data.relatedSearches.forEach(item => googleKeywords.add(item.query))

    return {
      bing: Array.from(bingKeywords).slice(0, 8),
      google: Array.from(googleKeywords).slice(0, 8)
    }
  } catch (e) {
    console.error('Serper LSI Fetch Error:', e)

    return { bing: Array.from(bingKeywords).slice(0, 10), google: [] }
  }
}

export async function fetchArticleData(url) {
  if (!url) return { success: false, text: '', title: '' }

  try {
    const res = await fetch(`https://r.jina.ai/${url}`)

    if (!res.ok) {
      throw new Error(`Failed to fetch article: ${res.statusText}`)
    }

    const markdownText = await res.text()

    const firstLine = markdownText.split('\n')[0]
    const extractedTitle = firstLine.replace(/^#+\s*/, '').trim() || 'Extracted Article'

    return {
      success: true,
      text: markdownText,
      title: extractedTitle
    }
  } catch (error) {
    console.error('Article Fetch Error:', error)

    return { success: false, text: '', error: error.message }
  }
}

export async function fetchSerperOutlineData(query) {
  if (!process.env.SERPER_API_KEY) return { organic: [], faqs: [], related: [], authorityLinks: [] }

  try {
    const res = await fetch(`https://google.serper.dev/search`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query })
    })

    const data = await res.json()

    if (data.statusCode === 400 || data.statusCode === 403) {
      console.error('Serper API Error:', data.message)

      return { organic: [], faqs: [], related: [], authorityLinks: [] }
    }

    const allLinks = data.organic ? data.organic.map(item => item.link) : []

    let authorityLinks = allLinks.filter(
      link => link.includes('.gov') || link.includes('.org') || link.includes('.edu')
    )

    // if (authorityLinks.length === 0 && allLinks.length > 0) {
    //   console.log(`[ExtLinks] No .gov/.org/.edu links found for "${query}". Falling back to standard organic results.`);
    //   authorityLinks = allLinks;
    // }

    return {
      organic: data.organic ? data.organic.slice(0, 4) : [],
      faqs: data.peopleAlsoAsk ? data.peopleAlsoAsk.map(item => item.question) : [],
      related: data.relatedSearches ? data.relatedSearches.map(item => item.query) : [],
      authorityLinks: authorityLinks
    }
  } catch (e) {
    console.error('Serper Outline Error:', e)

    return { organic: [], faqs: [], related: [], authorityLinks: [] }
  }
}

export async function fetchSerperPlacesData(query, count = 10, countryCode = 'us', languageCode = 'en') {
  if (!process.env.SERPER_API_KEY) return []

  try {
    const res = await fetch(`https://google.serper.dev/places`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: query,
        gl: countryCode.toLowerCase(),
        hl: languageCode.toLowerCase()
      })
    })

    const data = await res.json()

    return data.places ? data.places.slice(0, count) : []
  } catch (e) {
    console.error('Serper Places API Error:', e)

    return []
  }
}

export async function fetchYoutubeVideoData(url) {
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)

    if (!oembedRes.ok) throw new Error('Invalid YouTube URL or private video.')
    const metadata = await oembedRes.json()

    const transcriptArray = await YoutubeTranscript.fetchTranscript(url)
    const fullTranscript = transcriptArray.map(t => t.text).join(' ')

    return {
      success: true,
      title: metadata.title,
      author: metadata.author_name,
      thumbnail: metadata.thumbnail_url,
      transcript: fullTranscript
    }
  } catch (error) {
    console.error('YouTube Fetch Error:', error.message)

    return { success: false, error: error.message }
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

  return baseSystemInstruction
}

export function getToneInstruction(toneOfVoice, customToneOfVoice) {
  let toneInstruction = ''

  if (toneOfVoice === 'custom' && customToneOfVoice) {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a ${customToneOfVoice} tone of voice.`
  } else if (toneOfVoice && toneOfVoice !== 'seo') {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using a heavily ${toneOfVoice} tone of voice.`
  } else {
    toneInstruction = `\nCRITICAL TONE REQUIREMENT: You MUST write this entire section using an SEO Optimized (Confident, Knowledgeable, Neutral, and Clear) tone of voice.`
  }

  return toneInstruction
}

export function getPovInstruction(pointOfView) {
  let povInstruction = ''

  if (pointOfView === 'first') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Singular perspective (using pronouns like 'I', 'me', 'my', 'myself').`
  } else if (pointOfView === 'first-plural') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a First Person Plural perspective (using pronouns like 'we', 'us', 'our', 'ourselves').`
  } else if (pointOfView === 'second') {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Second Person perspective (using pronouns like 'you', 'your', 'yours').`
  } else {
    povInstruction = `\nCRITICAL PERSPECTIVE REQUIREMENT: You MUST write this entire section strictly from a Third Person perspective (using pronouns like 'he', 'she', 'it', 'they', 'their').`
  }

  return povInstruction
}

export async function getSeoInstruction(seoOptimization, manualKeywords, targetKeyword) {
  let seoInstruction = ''

  if (seoOptimization === 'manual' && manualKeywords) {
    seoInstruction = `\nCRITICAL SEO REQUIREMENT: You MUST naturally weave the following exact-match keywords into your paragraphs: ${manualKeywords}.`
  } else if (seoOptimization === 'ai' && targetKeyword) {
    const liveKeywords = await fetchLiveKeywords(targetKeyword)

    if (liveKeywords.length > 0) {
      seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. We have pulled live search engine data for this topic. You MUST naturally weave several of the following high-value LSI and Google Autocomplete keywords into the paragraphs: ${liveKeywords.join(', ')}.`
    } else {
      seoInstruction = `\nADVANCED AI SEO: You are acting as an elite technical SEO expert. Automatically identify and seamlessly weave high-value LSI (Latent Semantic Indexing) keywords related to "${targetKeyword}" into the paragraphs.`
    }
  }

  return seoInstruction
}

export async function getMediaInstruction(
  uploadedMedia,
  sectionIndex,
  aiImagesAndVideos,
  articleTitle,
  targetKeyword,
  heading,
  genAI,
  usedImageUrls = [],
  settings
) {
  try {
    let mediaInstruction = ''
    let assignedMediaElement = null
    let selectedMediaUrl = null

    if (uploadedMedia && uploadedMedia.length > 0 && sectionIndex < uploadedMedia.length) {
      const mediaItem = uploadedMedia[sectionIndex]

      selectedMediaUrl = mediaItem.url

      if (mediaItem.type.startsWith('image/')) {
        assignedMediaElement = `\n\n<img src="${mediaItem.url}" alt="${mediaItem.name}" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;" />\n\n`
      } else if (mediaItem.type.startsWith('video/')) {
        assignedMediaElement = `\n\n<video src="${mediaItem.url}" controls style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%;"></video>\n\n`
      }

      mediaInstruction = `\n[NOTE: A media file is placed at the end of this section. DO NOT output HTML tags for media.]`
    } else if (aiImagesAndVideos === 'auto') {
      const lowerHeading = (heading || '').toLowerCase()

      if (
        lowerHeading.includes('conclusion') ||
        lowerHeading.includes('final verdict') ||
        lowerHeading.includes('faq') ||
        lowerHeading.includes('frequently asked')
      ) {
        return { mediaInstruction: '', assignedMediaElement: null, mediaUrl: null, mediaId: null }
      }

      const imageLimit = parseInt(settings?.numberOfImages)
      const hasImageLimit = !isNaN(imageLimit) && String(settings?.numberOfImages || '').trim() !== ''

      const videoLimit = parseInt(settings?.numberOfYoutubeVideos)
      const hasVideoLimit = !isNaN(videoLimit) && String(settings?.numberOfYoutubeVideos || '').trim() !== ''

      const maxImageSlots = hasImageLimit ? imageLimit : 999
      const maxVideoSlots = hasVideoLimit ? videoLimit : 999

      const isImageSlot = sectionIndex % 2 === 0

      const imageSlotNumber = settings?.heroImage ? Math.floor((sectionIndex - 1) / 2) : Math.floor(sectionIndex / 2)

      const videoSlotNumber = Math.floor(sectionIndex / 2)

      const canHaveImage = isImageSlot && imageSlotNumber < maxImageSlots
      const canHaveVideo = !isImageSlot && videoSlotNumber < maxVideoSlots

      if (!canHaveImage && !canHaveVideo) {
        return { mediaInstruction: '', assignedMediaElement: null, mediaUrl: null, mediaId: null }
      }

      if (canHaveImage) {
        const coreTopic = articleTitle || targetKeyword

        // Fast path: build a decent stock query without waiting on Gemini when possible
        let smartImageData

        try {
          // Soft timeout so a slow/rate-limited Gemini doesn't block the whole section
          const kwPromise = getSmartImageKeyword(coreTopic, heading, genAI)

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('smart-image-timeout')), 3500)
          )

          smartImageData = await Promise.race([kwPromise, timeoutPromise])
        } catch (e) {
          const visualStop = new Set([
            ...STOP_WORDS,
            'caring',
            'care',
            'guide',
            'tips',
            'ways',
            'best',
            'top',
            'how',
            'what',
            'why',
            'ultimate',
            'complete',
            'introduction',
            'conclusion',
            'overview'
          ])

          const words = (coreTopic || '')
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !visualStop.has(w))

          const stockQuery = words.slice(0, 4).join(' ') || coreTopic

          smartImageData = {
            isRealisticStockPhoto: true,
            stockSearchQuery: stockQuery,
            aiGenerationPrompt: `Photorealistic landscape photo of ${stockQuery}, no text, no watermark`
          }
        }

        let bestImage = null
        const MIN_ACCEPT = 5
        const topicForScore = `${coreTopic} ${heading}`

        const pickBest = (list, searchQuery) => {
          const unused = (list || []).filter(c => !isUsed(c, usedImageUrls))

          unused.forEach(c => {
            c.score = calculateRelevanceScore(c.alt || '', searchQuery, topicForScore)
          })
          unused.sort((a, b) => b.score - a.score)

          return unused.find(c => c.score >= MIN_ACCEPT) || null
        }

        if (smartImageData.isRealisticStockPhoto && smartImageData.stockSearchQuery) {
          const q1 = smartImageData.stockSearchQuery

          const [u1, p1, x1] = await Promise.all([
            fetchUnsplashImage(q1, { page: 1, perPage: 15 }),
            fetchPexelsImage(q1, { page: 1, perPage: 15 }),
            fetchPixabayImage(q1, { page: 1, perPage: 20 })
          ])

          bestImage = pickBest([...u1, ...p1, ...x1], q1)
        }

        if (!bestImage) {
          const q2 = coreSubjectQuery(coreTopic, '')

          if (q2 && q2 !== smartImageData.stockSearchQuery) {
            const [u2, p2, x2] = await Promise.all([
              fetchUnsplashImage(q2, { page: 1, perPage: 15 }),
              fetchPexelsImage(q2, { page: 1, perPage: 15 }),
              fetchPixabayImage(q2, { page: 1, perPage: 20 })
            ])

            bestImage = pickBest([...u2, ...p2, ...x2], q2)
          }
        }

        if (bestImage) {
          selectedMediaUrl = mediaKey(bestImage)
          console.log(
            `[Section Image] ${bestImage.source} id=${bestImage.id} score=${bestImage.score.toFixed(2)} alt="${(bestImage.alt || '').slice(0, 50)}"`
          )

          const imageTitle = heading || coreTopic
          const imageAlt = `${targetKeyword || coreTopic} ${heading || ''}`.trim()

          assignedMediaElement = `\n\n<img src="${bestImage.url}" alt="${imageAlt}" title="${imageTitle}" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block;" />\n\n`
        } else {
          console.log('[Section Image] No on-topic stock photo — skipping image for this section')
          selectedMediaUrl = null
          assignedMediaElement = null
        }
      } else if (canHaveVideo) {
        try {
          const smartYtQuery = await getSmartVideoQuery(articleTitle || targetKeyword, heading, genAI)
          const ytVideos = await fetchYouTubeVideo(smartYtQuery)

          if (ytVideos && ytVideos.length > 0) {
            const availableVideos = ytVideos.filter(video => !usedImageUrls.includes(video.id))

            for (const ytVideo of availableVideos) {
              const videoUrl = `https://www.youtube.com/watch?v=${ytVideo.id}`
              const isAvailable = await isYouTubeVideoAvailable(videoUrl)

              if (isAvailable) {
                selectedMediaUrl = ytVideo.id
                assignedMediaElement = `\n\n<div data-youtube-video style="margin: 32px 0;"><iframe src="https://www.youtube.com/embed/${ytVideo.id}" title="${(ytVideo.title || '').replace(/"/g, '&quot;')}" style="width: 100%; aspect-ratio: 16/9; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: none; display: block; max-width: 100%;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n\n`
                break
              }
            }
          }
        } catch (videoErr) {
          console.error('[Media] YouTube path failed (section continues without video):', videoErr?.message || videoErr)

          // Do not rethrow — section text must still generate
        }
      }

      mediaInstruction = `\n[NOTE: A contextual image or video is placed at the end of this section. DO NOT attempt to generate image/video tags yourself.]`
    }

    return {
      mediaInstruction,
      assignedMediaElement,
      mediaUrl: selectedMediaUrl,
      mediaId: selectedMediaUrl
    }
  } catch (err) {
    console.error('[getMediaInstruction] Non-fatal media failure:', err?.message || err)

    return { mediaInstruction: '', assignedMediaElement: null, mediaUrl: null, mediaId: null }
  }
}

export function getReadabilityInstruction(improveReadability) {
  let readabilityInstruction = ''

  if (improveReadability) {
    readabilityInstruction = `\nSTYLING & READABILITY: You MUST heavily format this section to be highly skimmable. Use bullet points, numbered lists, and bold text for important concepts, terms, or key phrases. Avoid writing long, blocky paragraphs. Break text up aggressively.`
  } else {
    readabilityInstruction = `\nSTYLING & READABILITY: Write in standard, flowing paragraph format. Do not aggressively use bullet points or bold text unless explicitly necessary for a list.`
  }

  return readabilityInstruction
}

export async function getRealTimeInstruction(
  useRealTimeSearchData,
  realTimeDataSource,
  articleTitle,
  targetKeyword,
  heading
) {
  let realTimeInstruction = ''

  if (useRealTimeSearchData && (realTimeDataSource === 'news' || realTimeDataSource === 'scholar')) {
    const liveData = await fetchSerperData(`${articleTitle || targetKeyword} ${heading}`, realTimeDataSource)

    if (liveData.length > 0) {
      const dataStrings = typeof liveData[0] === 'string' ? liveData : liveData.map(d => `${d.title}: ${d.snippet}`)

      realTimeInstruction = `\nREAL-TIME FACTUAL CONTEXT: Use the following recent data points to make your section highly accurate and up-to-date:\n${dataStrings.join('\n')}`
    }
  }

  return realTimeInstruction
}

export function getExternalLinkInstruction(externalLinks, usedExternalLinks = []) {
  let extLinkInstruction = ''

  let availableLinks = (externalLinks || []).filter(link => !usedExternalLinks.includes(link))

  if (availableLinks.length === 0 && externalLinks && externalLinks.length > 0) {
    availableLinks = externalLinks
  }

  if (availableLinks && availableLinks.length > 0) {
    extLinkInstruction = `\nCRITICAL EXTERNAL LINKING: Naturally weave exactly 2 to 3 high-authority external URLs into the text. \nRULES:\n1. You MUST ONLY link to informative sources, Government sites (.gov), NGOs (.org), or research papers (e.g., Google Scholar).\n2. Do NOT link to advertising, entertainment, or competitor sites.\n3. URLs you can use: ${availableLinks.join(', ')}. Do not force them if they don't fit perfectly.`
  } else {
    extLinkInstruction = `\nCRITICAL EXTERNAL LINKING: Naturally weave exactly 2 to 3 high-authority external URLs into the text using Markdown formatting. \nRULES:\n1. You MUST ONLY link to informative sources, Government sites (.gov), NGOs (.org), or research papers (e.g., Google Scholar).\n2. Do NOT link to advertising, entertainment, or competitor sites.`
  }

  return extLinkInstruction
}

const sitemapCache = new Map()

export async function getLinkInstruction(internalLinks, heading, genAI, usedInternalLinks = []) {
  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    Connection: 'keep-alive'
  }

  if (!internalLinks || internalLinks.length === 0) return { instruction: '', selectedUrl: null }
  const domain = internalLinks[0]

  if (!domain) return { instruction: '', selectedUrl: null }

  let cleanDomain = String(domain)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

  if (!cleanDomain.startsWith('www.')) cleanDomain = `www.${cleanDomain}`

  const homeUrl = `https://${cleanDomain}`
  let extractedUrls = []

  if (sitemapCache.has(cleanDomain)) {
    extractedUrls = sitemapCache.get(cleanDomain)
  } else {
    const sitemapPaths = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml']
    let sitemapFound = false

    for (const path of sitemapPaths) {
      try {
        const response = await fetch(`${homeUrl}${path}`, {
          headers: browserHeaders,
          signal: AbortSignal.timeout(6000)
        })

        if (response.ok) {
          sitemapFound = true
          const xmlText = await response.text()
          let matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)]

          extractedUrls = matches.map(m => m[1])

          const isSitemapIndex = extractedUrls.some(url => url.endsWith('.xml'))

          if (isSitemapIndex) {
            const subSitemaps = extractedUrls.filter(
              url => url.includes('post-sitemap') || url.includes('page-sitemap') || url.includes('wp-sitemap-posts')
            )

            extractedUrls = []

            for (const subMap of subSitemaps) {
              const subResponse = await fetch(subMap, { headers: browserHeaders, signal: AbortSignal.timeout(6000) })

              if (subResponse.ok) {
                const subXmlText = await subResponse.text()
                const subMatches = [...subXmlText.matchAll(/<loc>(.*?)<\/loc>/g)]

                extractedUrls.push(...subMatches.map(m => m[1]))
              }
            }
          }

          break
        }
      } catch (error) {
        continue
      }
    }

    extractedUrls = extractedUrls.filter(url => {
      if (!url) return false

      try {
        const path = new URL(url).pathname

        return path.length > 1 && !url.endsWith('.xml') && !url.includes('/wp-content/uploads/')
      } catch (e) {
        return false
      }
    })

    extractedUrls = [...new Set(extractedUrls)].slice(0, 100)
    sitemapCache.set(cleanDomain, extractedUrls)
  }

  let availableUrls = extractedUrls.filter(url => !usedInternalLinks.includes(url))

  if (availableUrls.length === 0) {
    if (!usedInternalLinks.includes(homeUrl)) {
      availableUrls = [homeUrl]
    } else if (!usedInternalLinks.includes(domain)) {
      availableUrls = [domain]
    } else {
      return { instruction: '', selectedUrl: null }
    }
  }

  let bestMatchUrl = availableUrls[0]

  if (availableUrls.length > 1) {
    const pickByKeywords = () => {
      const words = (heading || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)

      let best = availableUrls[0]
      let max = -1

      for (const url of availableUrls) {
        const lower = url.toLowerCase()
        const score = words.reduce((n, w) => n + (lower.includes(w) ? 1 : 0), 0)

        if (score > max) {
          max = score
          best = url
        }
      }

      return best
    }

    try {
      const shortList = availableUrls.slice(0, 15)

      const result = await callLightLLM({
        system: 'Reply with JSON only.',
        json: true,
        max_tokens: 80,
        waitOn429: false,
        prompt: `Pick the ONE URL most relevant to this heading.
Heading: "${heading}"
URLs:
${shortList.map(u => `- ${u}`).join('\n')}
{"bestUrl":"<exact url or null>"}`
      })

      const parsed = parseJsonSafe(result?.text)

      bestMatchUrl = parsed?.bestUrl && availableUrls.includes(parsed.bestUrl) ? parsed.bestUrl : pickByKeywords()
    } catch {
      bestMatchUrl = pickByKeywords()
    }
  }

  const instruction = `\nCRITICAL INTERNAL LINKING: Naturally integrate the following URL into your paragraph using properly formatted Markdown links (e.g., [anchor text](URL)). URL to use: ${bestMatchUrl}. Make the anchor text highly relevant to the context.`

  return { instruction, selectedUrl: bestMatchUrl }
}

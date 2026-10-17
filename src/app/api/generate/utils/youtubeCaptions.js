import { extractVideoId } from '@/utils/youtubeId'

const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const PLAYER_CLIENTS = [
  {
    client: {
      clientName: 'ANDROID',
      clientVersion: '20.10.38',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'User-Agent': ANDROID_USER_AGENT,
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '20.10.38'
    }
  }
]

export function formatYoutubeDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))

  if (!total) return ''

  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function youtubeSectionPlan(durationSeconds, transcript) {
  const sourceWords = String(transcript || '').trim() ? String(transcript).trim().split(/\s+/).filter(Boolean).length : 0
  const seconds = Number(durationSeconds) || 0
  const minutes = seconds > 0 ? seconds / 60 : sourceWords > 0 ? sourceWords / 150 : 1
  let minH2 = 5
  let maxH2 = 7

  if (minutes > 8 && minutes <= 15) {
    minH2 = 7
    maxH2 = 9
  } else if (minutes > 15 && minutes <= 30) {
    minH2 = 9
    maxH2 = 12
  } else if (minutes > 30 && minutes <= 60) {
    minH2 = 12
    maxH2 = 16
  } else if (minutes > 60) {
    minH2 = 16
    maxH2 = Math.min(24, 16 + Math.floor((minutes - 60) / 15))
  }

  const spokenWords = sourceWords || Math.round(Math.max(minutes, 1) * 150)
  const targetWords = Math.max(minutes <= 8 ? 280 : 800, spokenWords)

  return {
    minutes: Math.max(1, Math.round(minutes)),
    seconds,
    sourceWords: spokenWords,
    targetWords,
    minH2,
    maxH2,
    h3min: 0,
    h3max: minutes <= 8 ? 1 : 2,
    wordsPerSection: Math.max(40, Math.round(targetWords / ((minH2 + maxH2) / 2)))
  }
}

function decodeCaptionEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (match, code) => {
      const point = Number(code)

      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      const point = parseInt(hex, 16)

      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match
    })
    .replace(new RegExp('&' + 'quot;', 'g'), '"')
    .replace(new RegExp('&' + '#39;|&' + 'apos;', 'g'), "'")
    .replace(new RegExp('&' + 'lt;', 'g'), '<')
    .replace(new RegExp('&' + 'gt;', 'g'), '>')
    .replace(new RegExp('&' + 'amp;', 'g'), '&')
}

function cleanCaptionText(value) {
  return decodeCaptionEntities(String(value || ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function textFromJsonCaptions(raw) {
  try {
    const data = JSON.parse(raw)
    const events = Array.isArray(data?.events) ? data.events : []

    return cleanCaptionText(
      events
        .flatMap(event => (Array.isArray(event?.segs) ? event.segs : []).map(seg => seg?.utf8 || ''))
        .join(' ')
    )
  } catch {
    return ''
  }
}

function textFromVtt(raw) {
  return cleanCaptionText(
    String(raw || '')
      .replace(/^WEBVTT[^\n]*$/gm, ' ')
      .replace(/^\d+$/gm, ' ')
      .replace(/\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->\s+\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}[^\n]*/g, ' ')
  )
}

function textFromCaptionPayload(payload, contentType = '') {
  const raw = String(payload || '')
  const trimmed = raw.trim()
  const type = String(contentType || '').toLowerCase()

  if (!trimmed) return ''

  if (trimmed.startsWith('WEBVTT') || type.includes('vtt')) return textFromVtt(trimmed)

  if (trimmed.startsWith('{') || trimmed.startsWith('[') || (type.includes('json') && !trimmed.startsWith('<'))) {
    const jsonText = textFromJsonCaptions(trimmed)

    if (jsonText) return jsonText
  }

  return cleanCaptionText(trimmed)
}

async function fetchText(url, headers, timeout = 8000) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
    cache: 'no-store'
  })
  const text = await response.text().catch(() => '')

  if (!response.ok) return { ok: false, status: response.status, text: '', contentType: '' }

  return {
    ok: true,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    text
  }
}

async function fetchVisitorData(videoId) {
  const headers = {
    'User-Agent': BROWSER_USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9'
  }
  const pages = [
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?hl=en`,
    'https://www.youtube.com/embed/jNQXAC9IVRw?hl=en'
  ]

  for (const page of pages) {
    try {
      const response = await fetchText(page, headers, 3500)
      const visitorData = String(response.text || '').match(/"visitorData":"([^"]+)"/)?.[1] || ''

      if (visitorData) return visitorData
    } catch {
      /* next */
    }
  }

  return ''
}

async function fetchPlayer(videoId, spec, visitorData = '') {
  const client = visitorData ? { ...spec.client, visitorData } : { ...spec.client }
  const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...spec.headers,
      ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {})
    },
    body: JSON.stringify({
      context: { client },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true
    }),
    signal: AbortSignal.timeout(5000)
  })

  if (!response.ok) return null

  const data = await response.json().catch(() => null)

  if (!data) return null

  const details = data.videoDetails || {}
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks

  return {
    title: details.title || '',
    author: details.author || '',
    durationSeconds: Number(details.lengthSeconds) || 0,
    thumbnails: Array.isArray(details.thumbnail?.thumbnails) ? details.thumbnail.thumbnails : [],
    tracks: Array.isArray(tracks) ? tracks : [],
    playability: data.playabilityStatus?.status || '',
    reason: data.playabilityStatus?.reason || ''
  }
}

async function fetchOembed(videoId) {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: AbortSignal.timeout(4000) }
    )

    if (!response.ok) return { ok: false, status: response.status }

    const metadata = await response.json()

    return {
      ok: true,
      title: metadata.title || '',
      author: metadata.author_name || '',
      thumbnail: metadata.thumbnail_url || ''
    }
  } catch {
    return { ok: false, status: 0 }
  }
}

function pickThumbnail(videoId, thumbnails, oembedUrl) {
  const ranked = [...(thumbnails || [])].filter(item => item?.url).sort((a, b) => (b.width || 0) - (a.width || 0))

  return ranked[0]?.url || oembedUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function rankTrack(track) {
  const lang = String(track?.languageCode || '')
  const kind = String(track?.kind || '')
  let score = 0

  if (lang === 'en' || lang.startsWith('en-')) score += 30
  if (kind !== 'asr') score += 15

  return score
}

function absoluteCaptionUrl(url) {
  let value = String(url || '')

  if (value.startsWith('//')) value = `https:${value}`
  else if (value.startsWith('/')) value = `https://www.youtube.com${value}`

  return value
}

function captionCandidates(baseUrl) {
  const absolute = absoluteCaptionUrl(baseUrl)
  let parsed

  try {
    parsed = new URL(absolute)
  } catch {
    return [absolute]
  }

  const out = []
  const push = value => {
    const next = String(value || '')

    if (next && !out.includes(next)) out.push(next)
  }

  const json3 = new URL(parsed.toString())

  json3.searchParams.set('fmt', 'json3')
  push(json3.toString())

  push(parsed.toString())

  return out
}

async function readCaptionTrack(track, videoId) {
  if (!track?.baseUrl) return ''

  const headers = {
    'User-Agent': BROWSER_USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://www.youtube.com/watch?v=${videoId || ''}`,
    Origin: 'https://www.youtube.com'
  }

  for (const candidate of captionCandidates(track.baseUrl)) {
    try {
      const response = await fetchText(candidate, headers, 5000)

      if (!response.ok || !response.text) continue

      const text = textFromCaptionPayload(response.text, response.contentType)

      if (text.length > 40) return text
    } catch {
      /* next */
    }
  }

  return ''
}

async function fetchViaYoutubeTranscriptPackage(videoId) {
  try {
    const mod = await import('youtube-transcript')
    const YoutubeTranscript = mod.YoutubeTranscript || mod.default?.YoutubeTranscript || mod.default

    if (!YoutubeTranscript?.fetchTranscript) return { text: '', source: '' }

    for (const lang of [undefined, 'en', 'hi']) {
      try {
        const items = lang
          ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
          : await YoutubeTranscript.fetchTranscript(videoId)

        if (!Array.isArray(items) || !items.length) continue

        const text = cleanCaptionText(items.map(item => item?.text || '').join(' '))

        if (text.length > 40) {
          return { text, source: `youtube-transcript:${lang || items[0]?.lang || 'auto'}` }
        }
      } catch {
        /* next lang */
      }
    }
  } catch (error) {
    console.error('[youtube] youtube-transcript package failed', error?.message || error)
  }

  return { text: '', source: '' }
}

/**
 * Approach B — Gemini YouTube video understanding.
 * Does NOT use timedtext / PO tokens. Gemini fetches the public YouTube URL server-side
 * and returns spoken content. Uses existing GEMINI_API_KEYS from env.
 */
function listGeminiKeysLocal() {
  const keys = []
  const push = value => {
    const next = String(value || '').trim()

    if (next && !keys.includes(next)) keys.push(next)
  }

  const csv = process.env.GEMINI_API_KEYS || ''

  for (const part of csv.split(',')) push(part)

  for (let i = 1; i <= 20; i++) {
    push(process.env[`GEMINI_API_KEY_${i}`])
    push(process.env[`GEMINI_FREE_API_KEY_${i}`])
  }

  push(process.env.GEMINI_FREE_API_KEY)
  push(process.env.GEMINI_API_KEY)

  return keys
}

async function fetchViaGeminiYoutube(videoId, title = '') {
  const keys = listGeminiKeysLocal()

  if (!keys.length) {
    console.error('[youtube] gemini fallback skipped: no GEMINI_API_KEYS')
    return { text: '', source: '' }
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
  const prompt = [
    'Extract the full spoken transcript of this YouTube video as continuous plain text.',
    'Include everything the speakers say in order from start to finish.',
    'Do not summarize. Do not add headings, timestamps, speaker labels, or commentary.',
    'If the speech is not in English, keep the original language.',
    title ? `Video title hint: ${title}` : ''
  ]
    .filter(Boolean)
    .join(' ')

  // Prefer flash-lite first (fast + cheap). On 429/503 rotate KEYS before switching model.
  const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash']
  const keyPool = keys.slice(0, 12) // walk up to 12 keys from GEMINI_API_KEYS / numbered env

  console.info('[youtube] gemini fallback keys available', keyPool.length)

  for (const model of models) {
    let modelMissing = false

    for (let keyIndex = 0; keyIndex < keyPool.length; keyIndex++) {
      const apiKey = keyPool[keyIndex]

      try {
        const url = new URL(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
        )

        url.searchParams.set('key', apiKey)

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(50000),
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { fileData: { fileUri: youtubeUrl } },
                  { text: prompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          })
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          const msg = data?.error?.message || `HTTP ${response.status}`
          const status = response.status

          console.error('[youtube] gemini video fail', {
            model,
            keyIndex: keyIndex + 1,
            keysTotal: keyPool.length,
            status,
            msg: String(msg).slice(0, 160)
          })

          // Model gone / not found → skip remaining keys for this model
          if (status === 404 || /no longer available|is not found/i.test(String(msg))) {
            modelMissing = true
            break
          }

          // Auth/permission on this key → try next key
          if (status === 400 || status === 401 || status === 403) continue

          // Rate limit / high demand → try next key on same model
          if (status === 429 || status === 503) continue

          continue
        }

        const text = cleanCaptionText(
          (data?.candidates || [])
            .flatMap(c => c?.content?.parts || [])
            .map(p => p?.text || '')
            .join(' ')
        )

        if (text.length > 80) {
          return {
            text,
            source: `gemini-youtube:${model}:key${keyIndex + 1}`
          }
        }
      } catch (error) {
        console.error('[youtube] gemini video error', {
          model,
          keyIndex: keyIndex + 1,
          err: error?.message || error
        })
        // network/timeout → next key
      }
    }

    if (modelMissing) continue
  }

  return { text: '', source: '' }
}

function failureMessage({ valid, title, reason }) {
  const lowered = String(reason || '').toLowerCase()

  if (!valid) {
    if (lowered.includes('private')) return 'This video is private.'
    if (lowered.includes('unavailable') || lowered.includes('removed')) return 'This video is unavailable.'

    return 'This video is unavailable or the URL is not a YouTube video.'
  }

  if (lowered.includes('age')) {
    return `This YouTube URL is valid${title ? ` ("${title}")` : ''}, but captions are age-restricted and could not be read.`
  }

  return `This YouTube URL is valid${title ? ` ("${title}")` : ''}, but captions could not be read. The video may have no subtitles, or YouTube blocked the caption request. Try again.`
}

function withTimeout(promise, ms, fallback) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms)

    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}

function resultFromTrack(base, text, trackOrSource) {
  const source =
    typeof trackOrSource === 'string'
      ? trackOrSource
      : `player:${trackOrSource?.languageCode || 'und'}:${trackOrSource?.kind || 'manual'}`

  return {
    ...base,
    success: true,
    transcript: text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    source
  }
}

async function loadYoutubeVideo(videoId) {
  const attempts = []
  const oembedPromise = fetchOembed(videoId)
  // Start Gemini immediately in parallel — it is the reliable path when timedtext is blocked
  const geminiPromise = fetchViaGeminiYoutube(videoId, '')
  const packagePromise = fetchViaYoutubeTranscriptPackage(videoId)
  const visitorData = await fetchVisitorData(videoId)

  attempts.push(visitorData ? 'visitor:ok' : 'visitor:empty')

  let player = null
  let transcript = ''
  let winningTrack = null

  // Fast caption path — single Android client, one track try only
  for (const spec of PLAYER_CLIENTS) {
    const label = `${spec.client.clientName}${spec.client.clientVersion || ''}`

    try {
      const nextPlayer = await fetchPlayer(videoId, spec, visitorData)

      if (!nextPlayer) {
        attempts.push(`${label}:empty`)
        continue
      }

      player = nextPlayer

      if (!nextPlayer.tracks.length) {
        attempts.push(`${label}:${nextPlayer.playability || 'no-tracks'}`)
        continue
      }

      attempts.push(`${label}:tracks:${nextPlayer.tracks.length}`)

      // Prefer English / manual track; only try the best one to save time
      const orderedTracks = [...nextPlayer.tracks].sort((a, b) => rankTrack(b) - rankTrack(a)).slice(0, 1)

      for (const track of orderedTracks) {
        const text = await readCaptionTrack(track, videoId)

        if (text.length > 40) {
          transcript = text
          winningTrack = track
          break
        }
      }

      if (!transcript) attempts.push(`${label}:caption-empty`)
    } catch (error) {
      attempts.push(`${label}:${error?.message || error}`)
    }
  }

  const oembed = await oembedPromise
  const title = player?.title || oembed.title || ''
  const author = player?.author || oembed.author || ''
  const durationSeconds = Number(player?.durationSeconds) || 0
  const thumbnail = pickThumbnail(videoId, player?.thumbnails, oembed.thumbnail || '')
  const valid = Boolean(title || oembed.ok || durationSeconds)
  const base = {
    valid,
    title,
    author,
    thumbnail,
    videoId,
    durationSeconds,
    durationLabel: formatYoutubeDuration(durationSeconds)
  }

  if (transcript && winningTrack) return resultFromTrack(base, transcript, winningTrack)

  // Package (usually same blocked path) — do not await long; race with Gemini
  let pkgResult = { text: '', source: '' }

  try {
    pkgResult = await Promise.race([
      packagePromise,
      new Promise(resolve => setTimeout(() => resolve({ text: '', source: 'pkg:timeout' }), 4000))
    ])

    if (pkgResult.text?.length > 40) {
      attempts.push(`pkg:${pkgResult.source}`)
      return resultFromTrack(base, pkgResult.text, pkgResult.source)
    }

    attempts.push(pkgResult.source === 'pkg:timeout' ? 'pkg:timeout' : 'pkg:empty')
  } catch (error) {
    attempts.push(`pkg:${error?.message || error}`)
  }

  // Gemini was already running in parallel
  try {
    const gemini = await geminiPromise

    if (gemini.text?.length > 80) {
      attempts.push(`gemini:${gemini.source}`)
      return resultFromTrack(base, gemini.text, gemini.source)
    }

    // Rare: first Gemini call started with empty title — one retry with title (same keys, preferred model only)
    if (title) {
      const retry = await fetchViaGeminiYoutube(videoId, title)

      if (retry.text?.length > 80) {
        attempts.push(`gemini-retry:${retry.source}`)
        return resultFromTrack(base, retry.text, retry.source)
      }
    }

    attempts.push('gemini:empty')
  } catch (error) {
    attempts.push(`gemini:${error?.message || error}`)
  }

  console.error('[youtube] caption fetch failed', { videoId, valid, attempts: attempts.slice(0, 14) })

  return {
    ...base,
    success: false,
    transcript: '',
    wordCount: 0,
    source: '',
    error: failureMessage({ valid, title, reason: valid ? player?.reason : player?.reason || player?.playability })
  }
}

export async function fetchYoutubeVideoData(url) {
  const videoId = extractVideoId(String(url || '').replace(new RegExp('&' + 'amp;', 'g'), '&'))

  if (!videoId) {
    return { success: false, valid: false, error: 'That is not a YouTube video URL.' }
  }

  return withTimeout(loadYoutubeVideo(videoId), 55000, {
    success: false,
    valid: true,
    videoId,
    title: '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    transcript: '',
    wordCount: 0,
    source: '',
    error: 'YouTube took too long to respond. Try the link again.'
  })
}

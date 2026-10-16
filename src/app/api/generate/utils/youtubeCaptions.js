import { extractVideoId } from '@/utils/youtubeId'

const PLAYER_CLIENTS = [
  {
    client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' },
    headers: {}
  },
  {
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.65.10',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'User-Agent':
        'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
      'X-YouTube-Client-Name': '28',
      'X-YouTube-Client-Version': '1.65.10'
    }
  },
  {
    client: {
      clientName: 'IOS',
      clientVersion: '19.45.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'User-Agent': 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '19.45.4'
    }
  },
  {
    client: { clientName: 'TVHTML5_SIMPLY', clientVersion: '1.0', hl: 'en', gl: 'US' },
    headers: { 'X-YouTube-Client-Name': '75', 'X-YouTube-Client-Version': '1.0' }
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

function cleanCaptionText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function textFromCaptionPayload(payload, contentType = '') {
  const raw = String(payload || '')

  if (!raw.trim()) return ''

  if (contentType.includes('json') || raw.trim().startsWith('{')) {
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

  return cleanCaptionText(raw)
}

async function fetchText(url, headers, timeout = 12000) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), redirect: 'follow' })

  if (!response.ok) return { ok: false, status: response.status, text: '' }

  return {
    ok: true,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    text: await response.text()
  }
}

async function fetchPlayer(videoId, spec) {
  const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...spec.headers },
    body: JSON.stringify({
      context: { client: spec.client },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true
    }),
    signal: AbortSignal.timeout(12000)
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
      { signal: AbortSignal.timeout(10000) }
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

async function resolveThumbnail(videoId, thumbnails, oembedUrl) {
  const ranked = [...(thumbnails || [])].filter(item => item?.url).sort((a, b) => (b.width || 0) - (a.width || 0))

  if ((ranked[0]?.width || 0) >= 1280) return ranked[0].url

  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    ranked[0]?.url,
    oembedUrl,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  ].filter(Boolean)
  const seen = new Set()

  for (const url of candidates) {
    const clean = String(url).split('?')[0]

    if (seen.has(clean)) continue

    seen.add(clean)

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'follow' })

      if (!response.ok) continue

      const buffer = Buffer.from(await response.arrayBuffer())

      if (buffer.length > 5000) return clean
    } catch {
      /* try the next size */
    }
  }

  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function rankTrack(track) {
  const lang = String(track?.languageCode || '')
  const kind = String(track?.kind || '')
  let score = 0

  if (lang === 'en' || lang.startsWith('en-')) score += 30
  if (kind !== 'asr') score += 15

  return score
}

async function readCaptionTrack(track) {
  if (!track?.baseUrl) return ''

  let url = String(track.baseUrl)

  if (url.startsWith('//')) url = `https:${url}`
  else if (url.startsWith('/')) url = `https://www.youtube.com${url}`

  const candidates = [url]

  if (!/fmt=/.test(url)) {
    candidates.push(`${url}&fmt=json3`, `${url}&fmt=srv3`, `${url}&fmt=vtt`)
  }

  for (const candidate of candidates) {
    try {
      const response = await fetchText(candidate)

      if (!response.ok) continue

      const text = textFromCaptionPayload(response.text, response.contentType)

      if (text.length > 40) return text
    } catch {
      /* next format */
    }
  }

  return ''
}

function tracksFromHtml(html) {
  const sources = [html, html.replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/')]

  for (const source of sources) {
    const marker = '"captionTracks":'
    const start = source.indexOf(marker)

    if (start < 0) continue

    const bracket = source.indexOf('[', start)

    if (bracket < 0) continue

    let depth = 0

    for (let index = bracket; index < source.length && index < bracket + 250000; index++) {
      const char = source[index]

      if (char === '[') depth += 1
      else if (char === ']') {
        depth -= 1

        if (depth === 0) {
          try {
            const parsed = JSON.parse(source.slice(bracket, index + 1))

            if (Array.isArray(parsed)) return parsed
          } catch {
            break
          }
        }
      }
    }
  }

  return []
}

async function fetchWatchTracks(videoId) {
  try {
    const response = await fetchText(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&bpctr=9999999999&has_verified=1`,
      {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+667; SOCS=CAI'
      },
      10000
    )

    if (!response.ok) return []

    return tracksFromHtml(response.text)
  } catch {
    return []
  }
}

async function fetchTimedText(videoId, lang, kind) {
  const kindQuery = kind ? `&kind=${encodeURIComponent(kind)}` : ''
  const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}${kindQuery}&fmt=json3`
  const response = await fetchText(url)

  if (!response.ok) return ''

  return textFromCaptionPayload(response.text, response.contentType || 'application/json')
}

async function fetchPackageTranscript(videoId) {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript')
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId)

    return cleanCaptionText((transcriptArray || []).map(item => item.text).join(' '))
  } catch {
    return ''
  }
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

export async function fetchYoutubeVideoData(url) {
  const videoId = extractVideoId(url)

  if (!videoId) {
    return { success: false, valid: false, error: 'That is not a YouTube video URL.' }
  }

  const attempts = []
  const oembedPromise = fetchOembed(videoId)
  let title = ''
  let author = ''
  let durationSeconds = 0
  let thumbnails = []
  let playability = ''
  let reason = ''
  const tracks = []

  for (const spec of PLAYER_CLIENTS) {
    try {
      const player = await fetchPlayer(videoId, spec)

      if (!player) {
        attempts.push(`${spec.client.clientName}:empty`)
        continue
      }

      if (!title && player.title) title = player.title
      if (!author && player.author) author = player.author
      if (!durationSeconds && player.durationSeconds) durationSeconds = player.durationSeconds
      if (!thumbnails.length && player.thumbnails.length) thumbnails = player.thumbnails
      if (!playability) playability = player.playability
      if (!reason && player.reason) reason = player.reason

      if (player.tracks.length) {
        tracks.push(...player.tracks)
        attempts.push(`${spec.client.clientName}:tracks:${player.tracks.length}`)
        break
      }

      attempts.push(`${spec.client.clientName}:${player.playability || 'no-tracks'}`)
    } catch (error) {
      attempts.push(`${spec.client.clientName}:${error?.message || error}`)
    }
  }

  const oembed = await oembedPromise

  if (!title && oembed.title) title = oembed.title
  if (!author && oembed.author) author = oembed.author

  const thumbnail = await resolveThumbnail(videoId, thumbnails, oembed.thumbnail || '')
  const valid = Boolean(title || oembed.ok || durationSeconds)
  const base = {
    valid,
    title: title || '',
    author,
    thumbnail,
    videoId,
    durationSeconds,
    durationLabel: formatYoutubeDuration(durationSeconds)
  }

  const orderedTracks = [...tracks].sort((a, b) => rankTrack(b) - rankTrack(a)).slice(0, 6)

  for (const track of orderedTracks) {
    const text = await readCaptionTrack(track)

    if (text.length > 40) {
      return {
        ...base,
        success: true,
        transcript: text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        source: `player:${track.languageCode || 'und'}:${track.kind || 'manual'}`
      }
    }
  }

  const packageText = await fetchPackageTranscript(videoId)

  if (packageText.length > 40) {
    return {
      ...base,
      success: true,
      transcript: packageText,
      wordCount: packageText.split(/\s+/).filter(Boolean).length,
      source: 'youtube-transcript'
    }
  }

  attempts.push('youtube-transcript:empty')

  try {
    const watchTracks = await fetchWatchTracks(videoId)

    for (const track of [...watchTracks].sort((a, b) => rankTrack(b) - rankTrack(a)).slice(0, 4)) {
      const text = await readCaptionTrack(track)

      if (text.length > 40) {
        return {
          ...base,
          success: true,
          transcript: text,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          source: `watch:${track.languageCode || 'und'}`
        }
      }
    }

    if (!watchTracks.length) attempts.push('watch:no-tracks')
  } catch (error) {
    attempts.push(`watch:${error?.message || error}`)
  }

  for (const lang of ['en', 'en-US']) {
    for (const kind of ['', 'asr']) {
      try {
        const text = await fetchTimedText(videoId, lang, kind)

        if (text.length > 40) {
          return {
            ...base,
            success: true,
            transcript: text,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            source: `timedtext:${lang}${kind ? `:${kind}` : ''}`
          }
        }
      } catch (error) {
        attempts.push(`timedtext:${lang}:${error?.message || error}`)
      }
    }
  }

  console.error('[youtube] caption fetch failed', { videoId, valid, attempts: attempts.slice(0, 12) })

  return {
    ...base,
    success: false,
    transcript: '',
    wordCount: 0,
    error: failureMessage({ valid, title, reason: valid ? reason : reason || playability })
  }
}

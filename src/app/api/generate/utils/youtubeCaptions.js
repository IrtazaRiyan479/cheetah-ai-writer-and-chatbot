import { extractVideoId } from '@/utils/youtubeId'

const ANDROID_USER_AGENT = 'com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip'

const PLAYER_CLIENTS = [
  {
    client: {
      clientName: 'ANDROID',
      clientVersion: '21.26.364',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      hl: 'en',
      gl: 'US'
    },
    headers: {
      'User-Agent': ANDROID_USER_AGENT,
      'X-YouTube-Client-Name': '3',
      'X-YouTube-Client-Version': '21.26.364'
    }
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
    .replace(/&#(\d+);/g, (match, code) => {
      const value = Number(code)

      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match
    })
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

async function fetchVisitorData(videoId) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  }
  const pages = [
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?hl=en`,
    'https://www.youtube.com/embed/jNQXAC9IVRw?hl=en'
  ]

  for (const page of pages) {
    try {
      const response = await fetchText(page, headers, 4000)
      const visitorData = String(response.text || '').match(/"visitorData":"([^"]+)"/)?.[1] || ''

      if (visitorData) return visitorData
    } catch {
      /* next embed page */
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
      const response = await fetchText(
        candidate,
        {
          'User-Agent': ANDROID_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        5000
      )

      if (!response.ok) continue

      const text = textFromCaptionPayload(response.text, response.contentType)

      if (text.length > 40) return text
    } catch {
      /* next format */
    }
  }

  return ''
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

function resultFromTrack(base, text, track) {
  return {
    ...base,
    success: true,
    transcript: text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    source: `player:${track.languageCode || 'und'}:${track.kind || 'manual'}`
  }
}

async function loadYoutubeVideo(videoId) {
  const attempts = []
  const oembedPromise = fetchOembed(videoId)
  const visitorData = await fetchVisitorData(videoId)

  attempts.push(visitorData ? 'visitor:ok' : 'visitor:empty')

  let player = null
  const clients = [PLAYER_CLIENTS[0], PLAYER_CLIENTS[1]].filter(Boolean)

  for (const spec of clients) {
    try {
      const nextPlayer = await fetchPlayer(videoId, spec, visitorData)

      if (!nextPlayer) {
        attempts.push(`${spec.client.clientName}:empty`)
        continue
      }

      if (!player) player = nextPlayer
      else {
        if (!player.title && nextPlayer.title) player = { ...player, title: nextPlayer.title }
        if (!player.durationSeconds && nextPlayer.durationSeconds) {
          player = { ...player, durationSeconds: nextPlayer.durationSeconds }
        }
        if (!player.thumbnails?.length && nextPlayer.thumbnails?.length) {
          player = { ...player, thumbnails: nextPlayer.thumbnails }
        }
      }

      if (nextPlayer.tracks.length) {
        player = { ...player, tracks: nextPlayer.tracks, playability: nextPlayer.playability, reason: nextPlayer.reason }
        attempts.push(`${spec.client.clientName}:tracks:${nextPlayer.tracks.length}`)
        break
      }

      attempts.push(`${spec.client.clientName}:${nextPlayer.playability || 'no-tracks'}`)
    } catch (error) {
      attempts.push(`${spec.client.clientName}:${error?.message || error}`)
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
  const orderedTracks = [...(player?.tracks || [])].sort((a, b) => rankTrack(b) - rankTrack(a)).slice(0, 3)

  for (const track of orderedTracks) {
    const text = await readCaptionTrack(track)

    if (text.length > 40) return resultFromTrack(base, text, track)
  }

  console.error('[youtube] caption fetch failed', { videoId, valid, attempts: attempts.slice(0, 8) })

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
  const videoId = extractVideoId(String(url || '').replace(/&/g, '&'))

  if (!videoId) {
    return { success: false, valid: false, error: 'That is not a YouTube video URL.' }
  }

  return withTimeout(loadYoutubeVideo(videoId), 12000, {
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

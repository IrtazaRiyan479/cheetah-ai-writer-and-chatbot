import { YoutubeTranscript } from 'youtube-transcript'

function extractVideoId(input) {
  const value = String(input || '').trim()
  if (!value) return ''
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value
  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '').slice(0, 11)
    const v = url.searchParams.get('v')
    if (v) return v.slice(0, 11)
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
    if (embed) return embed[1]
    const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shorts) return shorts[1]
  } catch {
    /* ignore */
  }
  const loose = value.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[&?/]|$)/)
  return loose ? loose[1] : ''
}

async function fetchTimedText(videoId, lang) {
  const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=json3`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) return ''
  const data = await response.json().catch(() => null)
  const events = Array.isArray(data?.events) ? data.events : []
  const parts = []
  for (const event of events) {
    const segs = Array.isArray(event?.segs) ? event.segs : []
    for (const seg of segs) {
      if (seg?.utf8) parts.push(String(seg.utf8).replace(/\n+/g, ' ').trim())
    }
  }
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

async function fetchCaptionTrackList(videoId) {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    signal: AbortSignal.timeout(20000)
  })
  if (!response.ok) return []
  const html = await response.text()
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) return []
  try {
    return JSON.parse(match[1])
  } catch {
    return []
  }
}

async function fetchCaptionTrackText(track) {
  if (!track?.baseUrl) return ''
  const url = track.baseUrl.includes('fmt=') ? track.baseUrl : `${track.baseUrl}&fmt=json3`
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) return ''
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json')) {
    const data = await response.json().catch(() => null)
    const events = Array.isArray(data?.events) ? data.events : []
    return events
      .flatMap(event => (Array.isArray(event?.segs) ? event.segs : []).map(seg => seg?.utf8 || ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const xml = await response.text()
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchYoutubeVideoData(url) {
  const videoId = extractVideoId(url)
  if (!videoId) {
    return { success: false, error: 'Invalid YouTube URL.' }
  }

  let title = ''
  let author = ''
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
      { signal: AbortSignal.timeout(12000) }
    )
    if (oembedRes.ok) {
      const metadata = await oembedRes.json()
      title = metadata.title || ''
      author = metadata.author_name || ''
      thumbnail = metadata.thumbnail_url || thumbnail
    }
  } catch (error) {
    console.warn('[youtube] oEmbed failed:', error?.message || error)
  }

  const attempts = []

  // 1) youtube-transcript package
  try {
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoId)
    const fullTranscript = (transcriptArray || []).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()
    if (fullTranscript.length > 40) {
      return {
        success: true,
        title: title || 'YouTube Video',
        author,
        thumbnail,
        transcript: fullTranscript,
        source: 'youtube-transcript'
      }
    }
    attempts.push('youtube-transcript:empty')
  } catch (error) {
    attempts.push(`youtube-transcript:${error?.message || error}`)
  }

  // 2) timedtext common languages
  for (const lang of ['en', 'en-US', 'en-GB', 'a.en', 'es', 'fr', 'de', 'pt', 'hi', 'ar']) {
    try {
      const text = await fetchTimedText(videoId, lang)
      if (text.length > 40) {
        return {
          success: true,
          title: title || 'YouTube Video',
          author,
          thumbnail,
          transcript: text,
          source: `timedtext:${lang}`
        }
      }
      attempts.push(`timedtext:${lang}:empty`)
    } catch (error) {
      attempts.push(`timedtext:${lang}:${error?.message || error}`)
    }
  }

  // 3) scrape caption track list from watch page
  try {
    const tracks = await fetchCaptionTrackList(videoId)
    for (const track of tracks) {
      try {
        const text = await fetchCaptionTrackText(track)
        if (text.length > 40) {
          return {
            success: true,
            title: title || 'YouTube Video',
            author,
            thumbnail,
            transcript: text,
            source: `track:${track.languageCode || track.vssId || 'unknown'}`
          }
        }
      } catch (error) {
        attempts.push(`track:${track.languageCode || 'x'}:${error?.message || error}`)
      }
    }
    if (!tracks.length) attempts.push('captionTracks:none')
  } catch (error) {
    attempts.push(`captionTracks:${error?.message || error}`)
  }

  console.error('[youtube] caption fetch failed', { videoId, attempts: attempts.slice(0, 12) })
  return {
    success: false,
    error: 'Could not fetch captions. The video may be private, age-restricted, or missing subtitles.',
    title,
    author,
    thumbnail,
    attempts
  }
}

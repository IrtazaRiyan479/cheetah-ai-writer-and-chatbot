function extractVideoIdOnce(input) {
  const value = String(input || '').trim().replace(/^['"]+|['"]+$/g, '')

  if (!value) return ''
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value

  let decoded = value

  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }

  const candidates = decoded === value ? [value] : [decoded, value]

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      const host = url.hostname.replace(/^www\./, '')

      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        const id = (url.pathname.split('/').filter(Boolean)[0] || '').slice(0, 11)

        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id
      }

      const v = url.searchParams.get('v')

      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v

      const patterns = [
        /\/embed\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
        /\/live\/([a-zA-Z0-9_-]{11})/,
        /\/v\/([a-zA-Z0-9_-]{11})/
      ]

      for (const pattern of patterns) {
        const match = url.pathname.match(pattern)

        if (match) return match[1]
      }
    } catch {
      /* not a url */
    }

    const loose = candidate.match(/(?:[?&]v=|\/(?:embed|shorts|live|v)\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?/\s#]|$)/)

    if (loose) return loose[1]
  }

  return ''
}

export function extractVideoId(input) {
  const direct = extractVideoIdOnce(input)

  if (direct) return direct

  const raw = String(input || '')
  const embedded = raw.match(/[?&]u=([^&#]+)/i)

  if (!embedded) return ''

  try {
    const nested = decodeURIComponent(embedded[1])
    const absolute = /^https?:\/\//i.test(nested)
      ? nested
      : `https://www.youtube.com${nested.startsWith('/') ? nested : `/${nested}`}`

    return extractVideoIdOnce(absolute)
  } catch {
    return ''
  }
}

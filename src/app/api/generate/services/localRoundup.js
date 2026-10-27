import {
  fetchSerperOutlineData,
  fetchSerperPlacesData,
  getLinkInstruction,
  getExternalLinkInstruction,
  getRealTimeInstruction,
  getReadabilityInstruction,
  getMediaInstruction,
  getSeoInstruction,
  getPovInstruction,
  getToneInstruction,
  getBaseSystemInstruction,
  fetchUnsplashImage,
  fetchPexelsImage,
  fetchPixabayImage,
  calculateRelevanceScore,
  fetchPeopleAlsoSearchFor,
  generateFallbackImage
} from '../utils/helpers'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import { callLightLLM, parseJsonSafe } from '../utils/lightLLM'

const STRUCTURAL_HEADING =
  /introduction|key takeaways|frequently asked|\bfaq\b|conclusion|final thoughts|\bsummary\b|what to (?:look|know|expect)|how to (?:choose|pick)|tips for|supplemental/i

const LOCATION_LABEL =
  'Location|Address|Ubicación|Ubicacion|Dirección|Direccion|Adresse|Localisation|Standort|Localização|Localizacao|Locatie|Posizione|所在地'

const WEBSITE_LINE =
  'visit\\s+website|view\\s+website|official\\s+website|website\\s+url|sitio\\s+web|site\\s+officiel|webseite'

function normalizeWebsiteUrl(value) {
  let raw = String(value || '').trim()

  if (!raw || /^(?:not available|n\/a|none|null|undefined|#|\[insert website url\])$/i.test(raw)) return ''
  raw = raw.replace(/^[<\[]+|[>\]]+$/g, '')

  if (!/^https?:\/\//i.test(raw)) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(raw)) raw = `https://${raw}`
    else return ''
  }

  try {
    const url = new URL(raw)

    if (!/^https?:$/i.test(url.protocol)) return ''
    url.hash = ''

    return url.toString()
  } catch {
    return ''
  }
}

function isBlockedPlaceHost(hostname) {
  const host = String(hostname || '')
    .replace(/^www\./, '')
    .toLowerCase()

  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === 'google.com' || host.endsWith('.google.com') || /^google\.[a-z.]+$/.test(host)) return true

  if (
    host.includes('tripadvisor.') ||
    host === 'tripadvisor.com' ||
    host.endsWith('.yelp.com') ||
    host === 'yelp.com'
  ) {
    return true
  }

  const blocked = [
    'goo.gl',
    'g.page',
    'g.co',
    'facebook.com',
    'fb.com',
    'instagram.com',
    'tiktok.com',
    'twitter.com',
    'x.com',
    'youtube.com',
    'youtu.be',
    'linkedin.com',
    'pinterest.com',
    'reddit.com',
    'yellowpages.com',
    'yp.com',
    'foursquare.com',
    'mapquest.com',
    'wikipedia.org',
    'wikidata.org',
    'wikihow.com',
    'apple.com',
    'bing.com',
    'yahoo.com',
    'duckduckgo.com',
    'opentable.com',
    'doordash.com',
    'ubereats.com',
    'grubhub.com',
    'postmates.com',
    'zomato.com',
    'booking.com',
    'expedia.com',
    'hotels.com',
    'agoda.com',
    'airbnb.com',
    'bbb.org',
    'angi.com',
    'angieslist.com',
    'thumbtack.com',
    'nextdoor.com',
    'waze.com',
    'allmenus.com',
    'menupages.com',
    'sirved.com',
    'restaurantji.com',
    'wanderlog.com',
    'timeout.com',
    'eater.com',
    'theinfatuation.com',
    'happycow.net',
    'groupon.com',
    'craigslist.org',
    'quora.com'
  ]

  return blocked.some(domain => host === domain || host.endsWith(`.${domain}`))
}

function isOfficialWebsite(value) {
  const raw = normalizeWebsiteUrl(value)

  if (!raw) return false

  try {
    return !isBlockedPlaceHost(new URL(raw).hostname)
  } catch {
    return false
  }
}

function isRelatedWebsite(value) {
  const raw = normalizeWebsiteUrl(value)

  if (!raw) return false

  try {
    const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase()

    if (!host || host === 'localhost' || host.endsWith('.localhost')) return false
    if (host === 'google.com' || host.endsWith('.google.com') || /^google\.[a-z.]+$/.test(host)) return false

    if (
      ['goo.gl', 'g.co', 'g.page', 'maps.apple.com', 'bing.com', 'yahoo.com', 'duckduckgo.com'].some(
        domain => host === domain || host.endsWith(`.${domain}`)
      )
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

function rawWebsite(place) {
  if (!place || typeof place !== 'object') return ''

  const attrs = place.attributes && typeof place.attributes === 'object' ? place.attributes : {}

  const candidates = [
    place.website,
    place.websiteUrl,
    place.websiteURI,
    place.websiteUri,
    place.webSite,
    place.homepage,
    place.site,
    place.url,
    place.link,
    attrs.Website,
    attrs.website,
    attrs.websiteUrl
  ]

  for (const candidate of candidates) {
    const url = normalizeWebsiteUrl(candidate)

    if (url && isOfficialWebsite(url)) return url
  }

  return ''
}

function rawRelatedWebsite(place) {
  if (!place || typeof place !== 'object') return ''

  const attrs = place.attributes && typeof place.attributes === 'object' ? place.attributes : {}

  const candidates = [
    place.relatedWebsite,
    place.website,
    place.websiteUrl,
    place.websiteURI,
    place.websiteUri,
    place.webSite,
    place.homepage,
    place.site,
    attrs.Website,
    attrs.website,
    attrs.websiteUrl,
    place.url,
    place.link
  ]

  for (const candidate of candidates) {
    const url = unwrapResultUrl(candidate)

    if (url && isRelatedWebsite(url) && !isOfficialWebsite(url)) return url
  }

  return ''
}

function websiteNameTokens(value) {
  const stops = new Set(['the', 'and', 'for', 'with', 'near', 'best', 'from', 'this', 'that', 'place', 'shop', 'store'])

  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stops.has(word))
}

function websiteNameMatches(candidate, title) {
  const tokens = websiteNameTokens(title)

  if (!tokens.length) return false

  const hay = String(candidate || '').toLowerCase()
  const hits = tokens.filter(token => hay.includes(token))

  return hits.length >= Math.min(2, tokens.length) || hits.some(token => token.length > 5)
}

function scoreOfficialWebsite(url, resultTitle, place) {
  let host = ''
  let path = '/'

  try {
    const parsed = new URL(url)

    host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    path = parsed.pathname || '/'
  } catch {
    return 0
  }

  let score = 0
  const hostFlat = host.replace(/[^a-z0-9]/g, '')

  if (websiteNameTokens(place?.title).some(token => token.length > 3 && hostFlat.includes(token))) score += 5
  if (websiteNameMatches(resultTitle, place?.title)) score += 3
  if (path === '/') score += 2
  else if ((path.match(/\//g) || []).length <= 1) score += 1
  if (/\/(biz|place|places|listing|profile|menu)\//i.test(path)) score -= 4

  return score
}

function escUrlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/_/g, '%5F')
}

async function serperJson(path, body) {
  if (!process.env.SERPER_API_KEY) return null

  try {
    const res = await fetch(`https://google.serper.dev/${path}`, {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    })

    if (!res.ok) return null

    return await res.json()
  } catch (error) {
    console.warn('[local-roundup] website lookup failed:', error?.message || error)

    return null
  }
}

function contactFromOsm(hit) {
  const tags = hit?.extratags && typeof hit.extratags === 'object' ? hit.extratags : {}
  const phone = String(tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '').trim()
  const candidates = [tags.website, tags['contact:website'], tags.url, tags['contact:url']]
  let website = ''

  for (const candidate of candidates) {
    const url = normalizeWebsiteUrl(candidate)

    if (url && isRelatedWebsite(url)) {
      website = url
      break
    }
  }

  return { phone, website }
}

function venueWord(title) {
  return websiteNameTokens(primaryPlaceName(title)).find(token => token.length >= 4) || ''
}

function primaryPlaceName(title) {
  const cleaned = placeNameFromHeading(title)
  const head = cleaned.split(',')[0].trim()

  return head || cleaned
}

function placeLocality(title, address) {
  const fromTitle = String(placeNameFromHeading(title) || '')
    .split(',')
    .slice(1)
    .join(' ')
    .trim()

  if (fromTitle) return fromTitle

  const parts = String(address || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length >= 3) return parts[parts.length - 3]

  return parts[1] || ''
}

function hostIncludesToken(url, token) {
  const needle = String(token || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (needle.length < 4) return false

  try {
    return new URL(url).hostname
      .replace(/^www\./, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .includes(needle)
  } catch {
    return false
  }
}

function unwrapResultUrl(value) {
  const raw = normalizeWebsiteUrl(value)

  if (!raw) return ''

  try {
    const url = new URL(raw)

    if (!/google\./i.test(url.hostname)) return raw

    return normalizeWebsiteUrl(url.searchParams.get('q') || url.searchParams.get('url') || '')
  } catch {
    return ''
  }
}

function pickOfficialFromRows(rows, title) {
  const primary = primaryPlaceName(title)
  let best = ''
  let bestScore = 0

  for (const row of rows) {
    const url = rawWebsite(row) || unwrapResultUrl(row?.link || row?.website || row?.url)

    if (!url || !isOfficialWebsite(url)) continue

    let score = scoreOfficialWebsite(url, row?.title || row?.name || '', { title: primary })

    if (hostIncludesToken(url, primary)) score += 6
    if (websiteNameMatches(row?.title || row?.name || '', primary)) score += 2

    if (score > bestScore) {
      best = url
      bestScore = score
    }
  }

  return bestScore >= 4 ? best : ''
}

function pickRelatedFromRows(rows, title) {
  const primary = primaryPlaceName(title)
  const venueToken = websiteNameTokens(primary).find(token => token.length >= 4) || ''
  let best = ''
  let bestScore = 0

  for (const row of rows || []) {
    const urls = []

    const push = value => {
      const url = unwrapResultUrl(value)

      if (url && isRelatedWebsite(url) && !urls.includes(url)) urls.push(url)
    }

    push(row?.website)
    push(row?.websiteUrl)
    push(row?.websiteURI)
    push(row?.websiteUri)

    if (row?.attributes && typeof row.attributes === 'object') {
      push(row.attributes.Website)
      push(row.attributes.website)
      push(row.attributes.websiteUrl)
    }

    push(row?.link)
    push(row?.url)

    urls.forEach((url, index) => {
      let host = ''

      try {
        host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
      } catch {
        return
      }

      const hay = `${row?.title || ''} ${row?.name || ''} ${row?.snippet || ''} ${host}`.toLowerCase()
      const mentioned = venueToken ? hay.includes(venueToken) : websiteNameMatches(hay, primary)

      if (!mentioned) return

      let score = 3

      if (index === 0 && (row?.website || row?.websiteUrl || row?.websiteURI || row?.websiteUri)) score += 2
      if (hostIncludesToken(url, venueToken || primary)) score += 4
      if (!isBlockedPlaceHost(host)) score += 6

      if (score > bestScore) {
        best = url
        bestScore = score
      }
    })
  }

  return best
}

async function findOfficialWebsite(place, country, language) {
  const title = primaryPlaceName(place?.title || '')

  if (!title) return ''

  const token = venueWord(title)

  const locality = placeLocality(place?.title, place?.address)
  const gl = String(country || 'us').toLowerCase()
  const hl = String(language || 'en').toLowerCase()
  const websiteQuery = [title, locality, 'website'].filter(Boolean).join(' ')

  const [placeRows, mapsData, searchData] = await Promise.all([
    fetchSerperPlacesData([title, locality].filter(Boolean).join(' '), 5, gl, hl),
    serperJson('maps', { q: [title, locality].filter(Boolean).join(' '), gl, hl }),
    serperJson('search', { q: websiteQuery, gl, hl })
  ])

  const fromPlaces = pickOfficialFromRows(placeRows, title)

  if (fromPlaces) return fromPlaces

  const fromMaps = pickOfficialFromRows(mapsData?.places || [], title)

  if (fromMaps) return fromMaps

  const graph = searchData?.knowledgeGraph || {}
  const graphSite = unwrapResultUrl(graph.website || graph.attributes?.Website || graph.attributes?.website)

  if (
    graphSite &&
    isOfficialWebsite(graphSite) &&
    (!graph.title ||
      websiteNameMatches(graph.title, title) ||
      (token && String(graph.title).toLowerCase().includes(token)) ||
      hostIncludesToken(graphSite, token || title))
  ) {
    return graphSite
  }

  const organic = [
    ...(searchData?.organic || []),
    ...(graph.sitelinks || []),
    ...(searchData?.answerBox?.link ? [{ title: searchData.answerBox.title, link: searchData.answerBox.link }] : [])
  ]

  const fromSearch = pickOfficialFromRows(organic, title)

  if (fromSearch) return fromSearch

  const fallback = await serperJson('search', { q: `${title} official website`, gl, hl })
  const fallbackGraph = fallback?.knowledgeGraph || {}
  const fallbackSite = unwrapResultUrl(fallbackGraph.website || fallbackGraph.attributes?.Website)

  if (fallbackSite && isOfficialWebsite(fallbackSite) && hostIncludesToken(fallbackSite, token || title))
    return fallbackSite

  const strictFallback = pickOfficialFromRows(fallback?.organic || [], title)

  if (strictFallback) return strictFallback

  const relatedRows = [
    ...(Array.isArray(placeRows) ? placeRows : []),
    ...(mapsData?.places || []),
    ...organic,
    ...(graphSite ? [{ title: graph.title || '', snippet: graph.description || '', website: graphSite }] : []),
    ...(fallback?.organic || []),
    ...(fallbackSite ? [{ title: fallbackGraph.title || '', website: fallbackSite }] : [])
  ]

  return pickRelatedFromRows(relatedRows, title)
}

async function ensurePlaceWebsite(place, country, language) {
  const normalized = normalizePlace(place)

  if (!normalized) return null
  if (normalized.website) return normalized

  const geo = await geocodePlace(
    [primaryPlaceName(normalized.title), placeLocality(normalized.title, '')].filter(Boolean).join(', '),
    country
  )

  let phone = normalized.phone || geo?.phone || ''

  if (geo?.website && isOfficialWebsite(geo.website)) {
    return { ...normalized, website: geo.website, phone }
  }

  const website =
    (await findOfficialWebsite(normalized, country, language)) || normalized.relatedWebsite || geo?.website || ''

  return { ...normalized, website: website || '', phone }
}

export function applyExactWebsiteLink(text, website) {
  const source = String(text || '')
  const href = isRelatedWebsite(website) ? normalizeWebsiteUrl(website) : ''

  const lineRe = new RegExp(
    `^[ \\t]*(?:[-*][ \\t]+|\\d+\\.[ \\t]+)?(?:\\*\\*)?\\s*(?:${WEBSITE_LINE})\\b[^\\n]*$\\n?`,
    'gim'
  )

  const itemRe = new RegExp(`<li\\b[^>]*>[\\s\\S]*?(?:${WEBSITE_LINE})\\b[\\s\\S]*?<\\/li>\\s*`, 'gi')

  const paragraphRe = new RegExp(
    `<p\\b[^>]*>\\s*(?:<(?:strong|b)>\\s*)?(?:${WEBSITE_LINE})\\b[\\s\\S]*?<\\/p>\\s*`,
    'gi'
  )

  if (!href) {
    return source.replace(lineRe, '').replace(itemRe, '').replace(paragraphRe, '')
  }

  const bullet = `* **Visit Website:** <a href="${escUrlAttr(href)}" target="_blank" rel="noopener noreferrer">View Website</a>\n`
  let replaced = false
  let next = source.replace(lineRe, () => {
    replaced = true

    return bullet
  })

  next = next.replace(itemRe, () => {
    replaced = true

    return `<li><strong>Visit Website:</strong> <a href="${escUrlAttr(href)}" target="_blank" rel="noopener noreferrer">View Website</a></li>\n`
  })
  next = next.replace(paragraphRe, () => {
    replaced = true

    return `<p><strong>Visit Website:</strong> <a href="${escUrlAttr(href)}" target="_blank" rel="noopener noreferrer">View Website</a></p>\n`
  })

  if (!replaced) {
    const contactRe = /^[ \t]*(?:[-*][ \t]+|\d+\.[ \t]+).*\b(?:contact info|phone)\b.*$/im

    if (contactRe.test(next)) next = next.replace(contactRe, match => `${match}\n${bullet.trimEnd()}`)
    else next = `${next.trim()}\n\n${bullet}`
  }

  return next
}

let geocodeChain = Promise.resolve()
let lastGeocodeAt = 0

function escAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/</g, '<')
    .replace(/>/g, '>')
}

function cleanLabel(value, fallback) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[|\]/g, '')
    .trim()

  return text || fallback || 'View map'
}

export function isPlaceHeading(heading) {
  const text = String(heading || '').trim()

  if (!text) return false

  return !STRUCTURAL_HEADING.test(text)
}

export function placeNameFromHeading(heading) {
  return String(heading || '')
    .replace(/^\s*(?:\d+\s*[:.)]\s*)+/, '')
    .replace(/^\s*#+\s*/, '')
    .trim()
}

export function normalizePlace(place) {
  if (!place || typeof place !== 'object') return null

  const lat = Number(place.latitude ?? place.lat ?? place.gpsCoordinates?.latitude)
  const lng = Number(place.longitude ?? place.lng ?? place.gpsCoordinates?.longitude)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)

  return {
    title: place.title || place.name || '',
    address: place.address || '',
    latitude: hasCoords ? lat : null,
    longitude: hasCoords ? lng : null,
    phone: place.phoneNumber || place.phone || '',
    website: rawWebsite(place),
    relatedWebsite: rawRelatedWebsite(place),
    rating: place.rating || '',
    ratingCount: place.ratingCount ?? '',
    cid: place.cid || ''
  }
}

export function googleMapsUrl({ lat, lng, label }) {
  if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
    return `https://www.google.com/maps/search/?api=1&query=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`
  }

  const q = String(label || '').trim()

  if (!q) return ''

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function yandexStaticMapUrl(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''

  const latStr = Number(lat).toFixed(6)
  const lngStr = Number(lng).toFixed(6)

  return `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${lngStr},${latStr}&z=16&l=map&size=650,350&pt=${lngStr},${latStr},pm2rdm`
}

export function buildMapImageHtml({ src, href, title }) {
  if (!src || !href) return ''

  const alt = `Map of ${title || 'this place'}`

  return `<img src="${escAttr(src)}" alt="${escAttr(alt)}" title="${escAttr(alt)}" data-map-href="${escAttr(href)}" style="border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 32px 0; width: 100%; max-width: 100%; aspect-ratio: 2 / 1; object-fit: cover; display: block; cursor: pointer;" />`
}

function placeFromOutline(outlineContext, heading) {
  const items = Array.isArray(outlineContext) ? outlineContext : []
  const exact = items.find(item => item?.place && item.text === heading)

  if (exact?.place) return normalizePlace(exact.place)

  const name = placeNameFromHeading(heading).toLowerCase()

  if (!name) return null

  const fuzzy = items.find(item => {
    const title = String(item?.place?.title || '').toLowerCase()

    return title && (name.includes(title) || title.includes(name))
  })

  return fuzzy?.place ? normalizePlace(fuzzy.place) : null
}

function geocodePlace(query, country) {
  const q = String(query || '').trim()

  if (!q || q.split(/\s+/).length > 12) return Promise.resolve(null)

  const run = async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt))

    if (wait) await new Promise(resolve => setTimeout(resolve, wait))

    lastGeocodeAt = Date.now()

    const cc = String(country || '')
      .trim()
      .toLowerCase()

    const countryParam = /^[a-z]{2}$/.test(cc) ? `&countrycodes=${cc}` : ''

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&extratags=1&q=${encodeURIComponent(q)}${countryParam}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AffiGenieLocalRoundup/1.0 (place map snapshot)'
        },
        signal: AbortSignal.timeout(8000)
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    const hit = Array.isArray(data) ? data[0] : null

    if (!hit) return null

    const lat = Number(hit.lat)
    const lng = Number(hit.lon)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    const contact = contactFromOsm(hit)

    return {
      latitude: lat,
      longitude: lng,
      address: hit.display_name || '',
      phone: contact.phone,
      website: contact.website
    }
  }

  const task = geocodeChain.then(run, run)

  geocodeChain = task.then(
    () => {},
    () => {}
  )

  return task
}

async function ensurePlaceCoordinates(place, country, keyword) {
  const normalized = normalizePlace(place)

  if (!normalized) return null
  if (normalized.latitude != null && normalized.longitude != null) return normalized

  const queries = [
    [normalized.title, normalized.address].filter(Boolean).join(', '),
    [normalized.title, keyword].filter(Boolean).join(', ')
  ].filter((query, index, all) => query && all.indexOf(query) === index)

  for (const query of queries) {
    const geo = await geocodePlace(query, country)

    if (!geo) continue

    return {
      ...normalized,
      latitude: geo.latitude,
      longitude: geo.longitude,
      address: normalized.address || geo.address || '',
      phone: normalized.phone || geo.phone || '',
      website: normalized.website || (isOfficialWebsite(geo.website) ? geo.website : ''),
      relatedWebsite: normalized.relatedWebsite || (geo.website && !isOfficialWebsite(geo.website) ? geo.website : '')
    }
  }

  return normalized
}

async function resolvePlace({ heading, keyword, country, language, outlineContext }) {
  const named = placeFromOutline(outlineContext, heading)
  const cleaned = placeNameFromHeading(heading) || named?.title || ''

  if (named?.latitude != null && named?.longitude != null) {
    const titled = { ...named, title: named.title || cleaned }

    if (titled.website) return titled

    return ensurePlaceWebsite(titled, country, language)
  }

  let place = named

  const queries = [cleaned, [cleaned, keyword].filter(Boolean).join(' ')].filter(
    (query, index, all) => query && all.indexOf(query) === index
  )

  for (const query of queries) {
    const rows = await fetchSerperPlacesData(query, 1, country, language)
    const next = normalizePlace(rows[0])

    if (!next?.title && !next?.address) continue

    place = {
      title: next.title || place?.title || cleaned,
      address: next.address || place?.address || '',
      latitude: next.latitude ?? place?.latitude ?? null,
      longitude: next.longitude ?? place?.longitude ?? null,
      phone: next.phone || place?.phone || '',
      website: next.website || place?.website || '',
      relatedWebsite: next.relatedWebsite || place?.relatedWebsite || '',
      rating: next.rating || place?.rating || '',
      ratingCount: next.ratingCount || place?.ratingCount || '',
      cid: next.cid || place?.cid || ''
    }

    if (place.latitude != null && place.longitude != null) break
  }

  if ((place?.latitude == null || place?.longitude == null) && cleaned) {
    const geoQueries = [
      [place?.title || cleaned, place?.address].filter(Boolean).join(', '),
      cleaned,
      [cleaned, keyword].filter(Boolean).join(', ')
    ].filter((query, index, all) => query && all.indexOf(query) === index)

    for (const query of geoQueries) {
      const geo = await geocodePlace(query, country)

      if (!geo) continue

      place = {
        title: place?.title || cleaned,
        address: place?.address || geo.address || '',
        latitude: geo.latitude,
        longitude: geo.longitude,
        phone: place?.phone || geo.phone || '',
        website: place?.website || (isOfficialWebsite(geo.website) ? geo.website : ''),
        relatedWebsite: place?.relatedWebsite || (geo.website && !isOfficialWebsite(geo.website) ? geo.website : ''),
        rating: place?.rating || '',
        ratingCount: place?.ratingCount || '',
        cid: place?.cid || ''
      }
      break
    }
  }

  return ensurePlaceWebsite(place || { title: cleaned }, country, language)
}

export function applyExactLocationLink(text, mapLink, address) {
  const source = String(text || '')
  const href = String(mapLink || '').trim()

  if (!source || !href) return source

  const safeHref = escAttr(href)

  const lineRe = new RegExp(
    `^([ \\t]*(?:[-*][ \\t]+)?(?:\\*\\*)?(?:${LOCATION_LABEL})(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*)(.*)$`,
    'gim'
  )

  let replaced = false
  let next = source.replace(lineRe, (full, prefix, rest) => {
    replaced = true
    const anchor = String(rest).match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)
    const markdown = String(rest).match(/\[([^\]]+)\]\([^)]*\)/)
    const label = cleanLabel(anchor?.[1] || markdown?.[1] || rest, address)

    return `${prefix}<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escAttr(label)}</a>`
  })

  if (!replaced) {
    const htmlRe = new RegExp(
      `((?:<(?:strong|b)>)?(?:${LOCATION_LABEL})(?:<\\/(?:strong|b)>)?\\s*:\\s*)(?:<a\\b[^>]*>[\\s\\S]*?<\\/a>|[^<\\n]+)`,
      'gi'
    )

    next = next.replace(htmlRe, (full, prefix) => {
      const anchor = full.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)
      const plain = full.slice(String(prefix || '').length)
      const label = cleanLabel(anchor?.[1] || plain, address)

      replaced = true

      return `${prefix}<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escAttr(label)}</a>`
    })
  }

  if (!next.includes(safeHref) && !next.includes(href)) {
    next = next.replace(
      /<a\b([^>]*?)href=(["'])(?:#|https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com)[^"']*)\2([^>]*)>/gi,
      full => {
        const current = (full.match(/href=(["'])([\s\S]*?)\1/i) || [])[2] || ''

        if (/[?&](?:query|q)=-?\d+(?:\.\d+)?(?:%2C|,)-?\d+/i.test(current)) return full

        replaced = true

        return full.replace(/href=(["'])[\s\S]*?\1/i, `href="${safeHref}"`)
      }
    )
  }

  return next
}

function mapsToggleOn(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export async function generateLocalRoundupOutline(body, genAI) {
  const { prompt, settings } = body

  const {
    model,
    targetKeyword,
    language,
    country,
    automaticExternalLinks,
    includeFaq,
    includeKeyTakeaways,
    useDescendingOrder,
    enableSupplementalInformation,
    numberOfPlaces,
    enableAutoLength,
    listNumberingFormat
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const outlineModel = genAI.getGenerativeModel({
    model: model || 'gemini-3.1-flash-lite',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: Generate a highly engaging article outline. You MUST return a JSON object with four keys: "metaTitle" (SEO title, max 60 chars), "metaDescription" (SEO desc, max 160 chars), "title" (A catchy, click-worthy, viral H1 Title based on the keyword) and "outline" (A flat JSON array of objects). Schema: { "metaTitle": "...", "metaDescription": "...", "title": "Catchy Title Here", "outline": [{ "type": "h2", "text": "Introduction" }, { "type": "h3", "text": "Subheading" }] }\n\nCRITICAL OUTLINE RULES:\n- The "title" MUST contain the exact target keyword: "${targetKeyword}".\n- The VERY FIRST "h2" object in the outline array MUST contain the exact target keyword: "${targetKeyword}" in its "text" field.\n- The VERY LAST "h2" object in the outline array MUST be a concluding heading and MUST also contain the exact target keyword: "${targetKeyword}" in its "text" field.`
  })

  const itemCount = enableAutoLength ? 10 : parseInt(numberOfPlaces) || 10

  const placesData = await fetchSerperPlacesData(targetKeyword || prompt, itemCount, country, language)
  let placesInstruction = ''

  const format = listNumberingFormat || '1.'

  let numberingArray = []

  for (let i = 1; i <= itemCount; i++) {
    numberingArray.push(format === 'none' ? '' : format.replace('1', i))
  }

  if (useDescendingOrder) numberingArray.reverse()

  const explicitNumberingStr =
    format === 'none'
      ? 'Do not use numbering.'
      : `Use EXACTLY these prefixes in this order for your list items: ${numberingArray.join(', ')}`

  if (placesData.length > 0) {
    const placeNames = placesData
      .map((p, i) => {
        const prefix = numberingArray[i] ? `${numberingArray[i]} ` : ''

        return `${prefix}${p.title}`
      })
      .join('\n')

    placesInstruction = `You MUST use EXACTLY these locations for the core H2 headings in order:\n${placeNames}`
  } else {
    placesInstruction = `Generate exactly ${itemCount} H2 headings representing specific real-world locations related to the topic. Number them.${explicitNumberingStr}`
  }

  let fetchedExternalLinks = []
  let faqInstruction = ''
  let relatedInstruction = ''
  let takeawaysInstruction = ''

  if (automaticExternalLinks || includeFaq) {
    const outlineData = await fetchSerperOutlineData(targetKeyword)

    if (automaticExternalLinks) {
      fetchedExternalLinks = outlineData.authorityLinks
    }

    if (includeFaq) {
      if (outlineData.faqs.length > 0) {
        faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled exactly "Frequently Asked Questions". Under this H2, you MUST nest exactly these questions directly from Google as H3 subheadings:\n${outlineData.faqs
          .slice(0, 5)
          .map(q => `- ${q}`)
          .join('\n')}`
      } else {
        faqInstruction = `\nCRITICAL REQUIREMENT - FAQ SECTION: You MUST include an H2 heading titled "Frequently Asked Questions" and nest 3-5 highly relevant questions as H3 subheadings.`
      }
    }

    if (outlineData.related.length > 0) {
      relatedInstruction = `\nSEO OPTIMIZATION: Naturally incorporate topics from these related Google searches into your H2 and H3 headings where relevant: ${outlineData.related.slice(0, 5).join(', ')}.`
    }
  }

  if (includeKeyTakeaways) {
    takeawaysInstruction = `\nCRITICAL REQUIREMENT - KEY TAKEAWAYS: The second H2 heading (immediately after the Introduction) MUST be titled exactly "Key Takeaways". Do NOT nest any H3 subheadings under it.`
  }

  let lengthInstruction = `CRITICAL: Generate exactly ${itemCount} location items.`
  let structureInstruction = `
          === STRICT LOCAL ROUNDUP STRUCTURE RULES ===
          1. The FIRST H2 heading MUST be an "Introduction".
          2. The next H2 headings MUST be the core locations:
          ${placesInstruction}
          - CRITICAL: Do NOT nest any H3 subheadings under the location items.
          3. ${enableSupplementalInformation ? 'After the locations, add exactly TWO additional H2 informational sections (e.g., "What to look for"). Nest 2-3 H3 headings under each.' : 'Do NOT add extra informational sections at the bottom.'}
          4. ${faqInstruction}
          5. ${takeawaysInstruction}
          6. ${relatedInstruction}
        `

  const outlinePrompt = `Article Topic: ${targetKeyword || prompt}\n\n${lengthInstruction}\n${structureInstruction}`

  let parsedData = null
  let lastOutlineError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await outlineModel.generateContent(outlinePrompt)
      const raw = result.response.text()

      parsedData = JSON.parse(raw)

      if (!parsedData?.outline || !Array.isArray(parsedData.outline) || parsedData.outline.length === 0) {
        throw new Error('Outline JSON missing outline array')
      }

      break
    } catch (err) {
      lastOutlineError = err
      const msg = String(err?.message || err)

      const isRateLimit =
        /429|rate.?limit|quota|resource.?exhausted|503|high demand|unavailable|overloaded|try again later/i.test(msg)

      if (isRateLimit) {
        console.warn('[Outline] Gemini quota — using Groq/Mistral')

        const alt = await callLightLLM({
          system: 'Return only valid JSON with keys metaTitle, metaDescription, title, outline.',
          prompt:
            outlinePrompt +
            '\n\nReturn JSON: {"metaTitle":"","metaDescription":"","title":"","outline":[{"type":"h2","text":""}]}',
          json: true,
          max_tokens: 1200
        })

        const parsed = parseJsonSafe(alt?.text)

        if (parsed?.outline?.length) {
          parsedData = parsed
          break
        }

        throw new Error('RATE_LIMIT: Gemini and Groq could not produce an outline. Wait ~60s.')
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 800 * attempt))
        continue
      }

      throw new Error(`OUTLINE_PARSE_FAILED: Could not produce a valid outline after ${attempt} attempts. ${msg}`)
    }
  }

  if (!parsedData) {
    throw lastOutlineError || new Error('OUTLINE_PARSE_FAILED')
  }

  if (placesData && placesData.length > 0) {
    let currentPlaceIndex = 0

    for (const item of parsedData.outline) {
      if (item.type !== 'h2' || !isPlaceHeading(item.text)) continue
      if (currentPlaceIndex >= placesData.length) break

      const place = await ensurePlaceWebsite(
        await ensurePlaceCoordinates(placesData[currentPlaceIndex], country, targetKeyword || prompt),
        country,
        language
      )

      const prefix = numberingArray[currentPlaceIndex] ? `${numberingArray[currentPlaceIndex]} ` : ''

      item.text = `${prefix}${place?.title || placesData[currentPlaceIndex].title}`
      if (place) item.place = place
      currentPlaceIndex++
    }
  }

  const [unsplashRes, pexelsRes, pixabayRes] = await Promise.all([
    fetchUnsplashImage(targetKeyword),
    fetchPexelsImage(targetKeyword),
    fetchPixabayImage(targetKeyword)
  ])

  let candidates = [...unsplashRes, ...pexelsRes, ...pixabayRes].filter(img => img && img.url)
  let heroImageUrl = ''
  let heroImageId = null
  let heroImageSource = null
  let fallbackToAiImageTag = false
  let scoredCandidates = []

  if (candidates.length > 0) {
    scoredCandidates = candidates.map(c => ({
      ...c,
      score: calculateRelevanceScore(c.alt || '', targetKeyword, targetKeyword)
    }))

    scoredCandidates.sort((a, b) => b.score - a.score)

    if (scoredCandidates[0].score >= 2.0) {
      heroImageUrl = scoredCandidates[0].url
      heroImageId = scoredCandidates[0].id ?? null
      heroImageSource = scoredCandidates[0].source || null
      console.log(`[Hero Image] Selected ${scoredCandidates[0].source} (Score: ${scoredCandidates[0].score})`)
    } else {
      console.log(
        `[Hero Image] Top image score (${scoredCandidates[0].score}) below 2.0. Invoking AI generation logic.`
      )
      fallbackToAiImageTag = true
    }
  } else {
    fallbackToAiImageTag = true
  }

  if (fallbackToAiImageTag) {
    const safetyBackup = scoredCandidates.length > 0 ? scoredCandidates[0].url : ''

    try {
      const fallbackImage = await generateFallbackImage(`High quality, realistic photograph of ${targetKeyword}`)

      if (fallbackImage && fallbackImage.url) {
        heroImageUrl = fallbackImage.url
      }
    } catch (error) {
      heroImageUrl = safetyBackup
      console.log(`[Hero Image] AI Fallback failed to generate a URL.`)
    }

    console.log(`[Hero Image] AI Generation Result: ${heroImageUrl ? 'Success' : 'Failed - Using Safety Backup'}`)
  }

  return {
    success: true,
    title: parsedData.title,
    outline: parsedData.outline,
    externalLinks: fetchedExternalLinks,
    heroImage: heroImageUrl,
    heroImageId,
    heroImageSource,
    metaTitle: parsedData.metaTitle,
    metaDescription: parsedData.metaDescription
  }
}

export async function generateLocalRoundupSection(body, genAI) {
  const {
    heading,
    settings,
    externalLinks,
    internalLinks,
    sectionIndex,
    outlineContext,
    usedImageUrls = [],
    usedExternalLinks = []
  } = body

  const {
    model,
    targetKeyword,
    articleTitle,
    language,
    country,
    toneOfVoice,
    customToneOfVoice,
    pointOfView,
    useRealTimeSearchData,
    realTimeDataSource,
    deepSearch,
    improveReadability,
    seoOptimization,
    manualKeywords,
    aiImagesAndVideos,
    generateUniqueMapImages,
    enableFirstHandExperience,
    uploadedMedia,
    usedInternalLinks = []
  } = settings

  const langObj = languages ? languages[language] : null
  const langName = langObj ? langObj.name : language || 'English'
  const countryObj = countries ? countries.find(c => c.code === country) : null
  const countryName = countryObj ? countryObj.name : country || 'United States'
  const baseSystemInstruction = getBaseSystemInstruction(langName, countryName)

  const modelConfig = {
    model: deepSearch ? 'deep-research-preview-04-2026' : model || 'gemini-3.5-flash',
    systemInstruction: `${baseSystemInstruction}\n\nSPECIAL INSTRUCTION: You are an expert copywriter. Write highly engaging, SEO-optimized content.`
  }

  const isWebSearch = !realTimeDataSource || realTimeDataSource === 'search'

  if (useRealTimeSearchData && isWebSearch) {
    modelConfig.tools = [
      {
        googleSearchRetrieval: { dynamicRetrievalConfig: { mode: 'MODE_DYNAMIC', dynamicThreshold: 0.3 } }
      }
    ]
  }

  const sectionModel = genAI.getGenerativeModel(modelConfig)

  let realTimeInstruction = await getRealTimeInstruction(
    useRealTimeSearchData,
    realTimeDataSource,
    articleTitle,
    targetKeyword,
    heading
  )
  let extLinkInstruction = settings.automaticExternalLinks
    ? getExternalLinkInstruction(externalLinks, usedExternalLinks)
    : '\nCRITICAL FORMATTING: Do NOT include or generate any external URLs or links in this section under any circumstances.'
  let { instruction: linkInstruction, selectedUrl: internalLinkUrl } = await getLinkInstruction(
    internalLinks,
    heading,
    genAI,
    usedInternalLinks
  )
  let seoInstruction = await getSeoInstruction(seoOptimization, manualKeywords, targetKeyword)
  let { mediaInstruction, assignedMediaElement, mediaUrl } = await getMediaInstruction(
    uploadedMedia,
    sectionIndex,
    aiImagesAndVideos,
    articleTitle,
    targetKeyword,
    heading,
    genAI,
    usedImageUrls,
    settings
  )
  let toneInstruction = getToneInstruction(toneOfVoice, customToneOfVoice)
  let povInstruction = getPovInstruction(pointOfView)
  let readabilityInstruction = getReadabilityInstruction(improveReadability)

  const isPlaceSection = isPlaceHeading(heading)

  let narrativeRequirement = ''
  let placeDataStr = ''
  let mapLink = ''
  let mapAddress = ''
  let mapTitle = placeNameFromHeading(heading)
  let mapHtml = ''
  let placeWebsite = ''

  if (isPlaceSection) {
    const place = await resolvePlace({
      heading,
      keyword: targetKeyword || '',
      country,
      language,
      outlineContext
    })

    mapTitle = place?.title || mapTitle
    mapAddress = place?.address || ''
    placeWebsite = place?.website || ''
    mapLink = googleMapsUrl({
      lat: place?.latitude,
      lng: place?.longitude,
      label: [mapTitle, mapAddress || targetKeyword || ''].filter(Boolean).join(', ')
    })

    if (mapsToggleOn(generateUniqueMapImages) && place?.latitude != null && place?.longitude != null) {
      mapHtml = buildMapImageHtml({
        src: yandexStaticMapUrl(place.latitude, place.longitude),
        href: mapLink,
        title: mapTitle || heading
      })
      mediaInstruction += `\n[NOTE: A map snapshot of this exact place is inserted after the section. Do NOT output any map image, iframe, or map HTML. The Location link MUST use this exact URL and no other: ${mapLink}]`
    } else if (mapLink) {
      mediaInstruction += `\n[NOTE: The Location link MUST use this exact URL and no other: ${mapLink}. Do not use "#" or a generic Google Maps URL.]`
    }

    if (place) {
      placeDataStr = `
          REAL LOCATION DATA TO USE (do not invent different values):
          - Ratings: ${place.rating ? `${place.rating} / 5 (${place.ratingCount || place.ratingCount === 0 ? place.ratingCount : 'n/a'} reviews)` : 'Not Available'}
          - Address: ${place.address || 'Address Not Available'}
          - Map URL (use this exact URL for the Location link): ${mapLink}
          - Phone: ${place.phone || 'Not Available'}
          - Website (own site, or the closest related page; only if present): ${place.website || 'NONE — do not mention a website'}
        `
    }

    narrativeRequirement = enableFirstHandExperience
      ? 'Write a compelling, authentic 2-paragraph review from a first-person perspective ("I", "my"). CRITICAL: You MUST drastically vary your opening sentences and narrative structure. DO NOT repetitively start paragraphs with generic phrases like "When I visited," "I recently went to," or "My experience." Instead, dive naturally into the review by immediately describing a specific sensory detail, an interaction with the staff, the immediate atmosphere, or a unique observation. Make it read like a dynamic, genuine blog post.'
      : 'Write a highly detailed, objective description (2 paragraphs) of this location, its atmosphere, and its best offerings. Maintain a professional, third-person perspective.'
  }

  const websiteBullet = placeWebsite
    ? `* **Visit Website:** <a href="${escUrlAttr(placeWebsite)}" target="_blank" rel="noopener noreferrer">View Website</a>`
    : ''

  const websiteRule = placeWebsite
    ? 'The Visit Website href above is the best page found for this place: its own site when one exists, otherwise the closest related page. Output that anchor exactly. Do not invent or swap the URL.'
    : 'Do NOT output a Visit Website, View Website, Official Website, or Website URL line. No website was found for this place. Never invent a website URL.'

  let sectionStructureRequirements =
    `
              CRITICAL LOCAL ROUNDUP LAYOUT:
              You are writing the section for the location: "${heading}".
              ${placeDataStr}

              1. First, ${narrativeRequirement}
              2. Then, you MUST output an exact bulleted list exactly matching this HTML/Markdown format. Ensure the links are properly formatted HTML ` +
    '`<a>`' +
    ` tags:

              * **Ratings:** [Insert Rating Data]
              * **Location:** <a href="${mapLink || '[Insert Map URL]'}" target="_blank" rel="noopener noreferrer">${mapAddress || '[Insert Address]'}</a>
              * **Contact Info:** [Insert Phone]
              ${websiteBullet}

              ${websiteRule}
              Do NOT add any H3s or other text after the bullet points. Follow this structure strictly.
            `

  const activeSEOKeyword = targetKeyword || articleTitle || heading
  const lsiData = await fetchPeopleAlsoSearchFor(activeSEOKeyword)
  const lsiString = `Google Keywords: [${lsiData.google.join(', ')}]. Bing Keywords: [${lsiData.bing.join(', ')}].`

  const keywordSEOInstructions = `
    CRITICAL SEO & FORMATTING REQUIREMENTS:
    - Target Keyword: "${activeSEOKeyword}"
    - LSI / Related Keywords: [${lsiString}]

    1. KEYWORD PLACEMENT & BOLDING: You MUST use the exact Target Keyword multiple times naturally throughout this section to ensure strong topic relevance. If this section is the Introduction or Conclusion, this is absolutely MANDATORY. Format the target keyword in bold (**${activeSEOKeyword}**) every time it is used.
    2. LSI INTEGRATION: You MUST naturally integrate 1 to 2 of the provided LSI keywords into the paragraphs or subheadings of this section. CRITICAL: Use each LSI keyword a MAXIMUM of 1 or 2 times to avoid keyword stuffing. Ensure the main Target Keyword is used more frequently than any single LSI keyword.
    3. LSI BOLDING: Every time you use an LSI keyword, you MUST format it in bold (e.g., **LSI keyword**).
    4. LIST FORMATTING: If you use bullet points or ordered list items anywhere in this section, each individual list item MUST be 2 to 3 sentences long to provide detailed value. Do NOT write single-sentence or one-liner list items.
  `

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
        ${keywordSEOInstructions}
      `

  let result = null

  try {
    result = await sectionModel.generateContent(sectionPrompt)
  } catch (error) {
    const msg = (error?.message || String(error) || '').toLowerCase()

    const shouldFallback =
      /429|quota|rate.?limit|resource.?exhausted|503|high demand|unavailable|overloaded|try again later|fetch failed/i.test(
        msg
      )

    if (!shouldFallback) throw error

    console.warn('[Section] Gemini quota hit — writing this section with Groq/Mistral')

    const alt = await callLightLLM({
      system: 'You are an expert SEO article writer. Return only the section body in markdown. No preamble, no JSON.',
      prompt: sectionPrompt.slice(0, 6000),
      max_tokens: 1400,
      waitOn429: false
    })

    if (!alt?.text) {
      console.error('[Section] All providers exhausted. Skipping this heading.')

      return {
        success: false,
        skipped: true,
        heading,
        error: 'RATE_LIMIT',
        message: 'Gemini, Groq, and Mistral are all rate-limited. Wait ~60s and regenerate this section.'
      }
    }

    result = { response: { text: () => alt.text } }
  }

  let text = result.response.text()

  if (isPlaceSection && mapLink) text = applyExactLocationLink(text, mapLink, mapAddress || mapTitle)
  if (isPlaceSection) text = applyExactWebsiteLink(text, placeWebsite)
  else text = applyExactWebsiteLink(text, '')

  return {
    success: true,
    text,
    mediaHtml: assignedMediaElement,
    mapHtml,
    mediaUrl: mediaUrl,
    internalLinkUrl: internalLinkUrl,
    preserveLinks: [placeWebsite, mapLink].filter(Boolean)
  }
}

/** English CTA. Non-English articles use the map below; unknown languages keep this exact string. */
export const CHECK_PRICE_LABEL_EN = 'Check Price on Amazon'

const CHECK_PRICE_LABELS = {
  ar: 'تحقق من السعر على أمازون.',
  cs: 'Zkontrolujte cenu na Amazonu.',
  da: 'Tjek prisen på Amazon.',
  de: 'Preis auf Amazon prüfen.',
  el: 'Ελέγξτε την τιμή στο Amazon.',
  en: CHECK_PRICE_LABEL_EN,
  es: 'Consulta el precio en Amazon.',
  fi: 'Tarkista hinta Amazonissa.',
  fr: 'Vérifiez le prix sur Amazon.',
  he: 'בדקו את המחיר באמזון.',
  hi: 'Amazon पर कीमत देखें.',
  hu: 'Nézd meg az árat az Amazonon.',
  id: 'Cek harga di Amazon.',
  it: 'Controlla il prezzo su Amazon.',
  ja: 'Amazonで価格を確認',
  ko: 'Amazon에서 가격 확인',
  nl: 'Bekijk de prijs op Amazon.',
  no: 'Sjekk prisen på Amazon.',
  pl: 'Sprawdź cenę na Amazon.',
  pt: 'Confira o preço na Amazon.',
  ro: 'Verifică prețul pe Amazon.',
  ru: 'Проверьте цену на Amazon.',
  sv: 'Kolla priset på Amazon.',
  th: 'ตรวจสอบราคาบน Amazon',
  tr: "Amazon'da fiyatı kontrol edin.",
  uk: 'Перевірте ціну на Amazon.',
  vi: 'Kiểm tra giá trên Amazon.',
  zh: '在亚马逊查看价格。'
}

const CTA_TEXT_RE = /check\s*price|buy on amazon|view on amazon|voir le prix|precio en amazon|preis auf amazon/i

export function cleanRewriteKeyword(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^#+\s*/, '')
    .replace(/^(?:title|h1)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function extractAsin(value) {
  const raw = String(value || '')

  const match =
    raw.match(/(?:dp|gp\/product|o|v|item|ASIN|product)\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    raw.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i)

  return match ? match[1].toUpperCase() : ''
}

function languageCode(language) {
  const raw = String(language || '')
    .trim()
    .toLowerCase()

  if (!raw) return 'en'
  if (CHECK_PRICE_LABELS[raw]) return raw

  const base = raw.split(/[-_]/)[0]

  return CHECK_PRICE_LABELS[base] ? base : raw.startsWith('en') ? 'en' : base
}

export function getCheckPriceLabel(language) {
  const code = languageCode(language)

  if (!code || code === 'en') return CHECK_PRICE_LABEL_EN

  return CHECK_PRICE_LABELS[code] || CHECK_PRICE_LABEL_EN
}

function isAmazonHost(hostname) {
  return /(^|\.)amazon\.[a-z.]+$|(^|\.)amzn\.(to|com)$/i.test(hostname || '')
}

export function isAmazonHref(href) {
  try {
    return isAmazonHost(new URL(href).hostname)
  } catch {
    return /amazon\.|amzn\.to/i.test(String(href || ''))
  }
}

/**
 * Keep an existing affiliate tag. Rebuild from the ASIN only when the raw link cannot be parsed.
 * forceTag is used only when the writer explicitly set a tracking id.
 */
export function resolveAffiliateUrl({ url, asin, domain = 'www.amazon.com', partnerTag = '', forceTag = '' } = {}) {
  const raw = String(url || '').trim()
  let parsed = null

  if (raw && raw !== '#') {
    try {
      parsed = new URL(raw)
    } catch {
      parsed = null
    }
  }

  const foundAsin =
    extractAsin(raw) ||
    extractAsin(asin) ||
    String(asin || '')
      .trim()
      .toUpperCase()
  const existingTag = parsed?.searchParams.get('tag') || ''
  const tag = forceTag || existingTag || partnerTag || ''

  if (!parsed || (parsed && !isAmazonHost(parsed.hostname) && foundAsin)) {
    if (!foundAsin) return parsed && isAmazonHost(parsed.hostname) ? parsed.toString() : ''

    const host = String(domain || 'www.amazon.com')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')

    const built = new URL(`https://${host}/dp/${foundAsin}`)

    if (parsed) {
      parsed.searchParams.forEach((value, key) => {
        if (key.toLowerCase() !== 'tag') built.searchParams.set(key, value)
      })
    }

    if (tag) built.searchParams.set('tag', tag)

    return built.toString()
  }

  if (tag && !parsed.searchParams.get('tag')) parsed.searchParams.set('tag', tag)
  if (forceTag) parsed.searchParams.set('tag', forceTag)

  return parsed.toString()
}

function protectUrl(url) {
  return String(url || '').replace(/_/g, '%5F')
}

/**
 * Shared Check Price anchor. Returns '' when neither a usable affiliate URL nor an ASIN exists.
 * @param {string} url
 * @param {{ language?: string, asin?: string, domain?: string, partnerTag?: string, forceTag?: string }} [options]
 */
export function buildCheckPriceButton(url, options = {}) {
  const href = resolveAffiliateUrl({
    url,
    asin: options.asin,
    domain: options.domain,
    partnerTag: options.partnerTag,
    forceTag: options.forceTag
  })

  if (!href) return ''

  const label = getCheckPriceLabel(options.language)

  return `<a href="${escapeHtml(protectUrl(href))}" target="_blank" rel="sponsored noopener" class="check-price-btn affigenie-check-price" style="text-decoration:none;background-color:#6366f1;color:#ffffff !important;font-weight:700;font-size:15px;line-height:1.25;padding:12px 16px;border-radius:8px;display:inline-block;max-width:100%;box-sizing:border-box;white-space:normal;word-break:normal;overflow-wrap:break-word;text-align:center;min-height:44px;border:1px solid #4f46e5;">${escapeHtml(label)}</a>`
}

export function renderResponsiveTable({ headers = [], rows = [] } = {}) {
  const head = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')

  const body = rows
    .map(row => {
      const cells = (Array.isArray(row) ? row : [])
        .map((cell, index) => {
          const label = escapeHtml(headers[index] || '')

          return `<td data-label="${label}">${cell ?? ''}</td>`
        })
        .join('')

      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<table class="affigenie-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** Capitalize the first letter of each word. Leaves existing capitals and apostrophes alone (Men's, UGG). */
export function titleCaseWords(value) {
  return String(value || '').replace(
    /(^|[^A-Za-z0-9'])([a-z])/g,
    (_, prefix, letter) => prefix + letter.toUpperCase()
  )
}

export function renderTopPickCards(products = [], options = {}) {
  const blocks = []
  const badges = ['Top Pick', 'Best Value', 'Best Overall']

  products.forEach((product, index) => {
    const rawName = product.productName || product.title || 'Amazon Product'
    const name = escapeHtml(titleCaseWords(rawName))
    const imageUrl = String(product.imageUrl || product.image || '').trim()
    const image =
      /^https?:/i.test(imageUrl) || imageUrl.startsWith('data:')
        ? `<img src="${escapeHtml(protectUrl(imageUrl))}" alt="${name}" />`
        : ''
    const features = (Array.isArray(product.features) ? product.features : [])
      .map(item => String(item || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 3)
    const featureHtml = features.length
      ? `<p><strong>Top features</strong></p>\n\n<ul>${features.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : ''
    const badge = badges[index]
      ? `<p class="affigenie-top-pick-badge"><strong>${escapeHtml(badges[index])}</strong></p>`
      : ''
    const heading = index === 0 ? '<h2 class="affigenie-top-pick">Top Pick</h2>' : ''
    const rating = product.rating ? `<p><strong>Rating:</strong> ${escapeHtml(String(product.rating))}</p>` : ''
    const button = buildCheckPriceButton(product.amazonUrl || product.url, { ...options, asin: product.asin })
    const buttonHtml = button ? `<p>${button}</p>` : ''

    blocks.push([heading, badge, image, `<h3>${name}</h3>`, rating, featureHtml, buttonHtml].filter(Boolean).join('\n\n'))

    if (index < products.length - 1) blocks.push('<hr class="affigenie-top-pick-separator" />')
  })

  return blocks.join('\n\n')
}

export function getAffigenieArticleCss() {
  return `
h2.affigenie-top-pick,.ProseMirror h2.affigenie-top-pick{font-size:2.25rem!important;line-height:1.1!important;font-weight:800!important;letter-spacing:-0.03em!important;margin:0 0 12px!important;color:#111827!important}
p.affigenie-top-pick-badge,.ProseMirror p.affigenie-top-pick-badge{display:inline-block!important;margin:0 0 8px!important;padding:4px 10px!important;border-radius:999px!important;background:#111827!important;color:#ffffff!important;font-size:13px!important;font-weight:700!important;line-height:1.3!important}
hr.affigenie-top-pick-separator,.ProseMirror hr.affigenie-top-pick-separator{display:block!important;clear:both!important;border:0!important;border-top:2px solid #d1d5db!important;margin:28px 0!important;height:0!important;background:transparent!important}
table.affigenie-table{width:100%;max-width:100%;border-collapse:collapse;table-layout:auto;display:table;overflow:visible;margin:24px 0}
table.affigenie-table th,table.affigenie-table td{word-break:normal;overflow-wrap:break-word;white-space:normal;vertical-align:middle;text-align:left}
#cheetah-article-wrapper table.affigenie-table{table-layout:auto!important;display:table!important;overflow:visible!important;width:100%!important}
.affigenie-check-price,.check-price-btn{white-space:normal!important;word-break:normal!important;overflow-wrap:break-word!important;max-width:100%!important;box-sizing:border-box!important;line-height:1.25!important;min-height:44px!important;text-align:center!important}
@media (max-width:640px){
  table.affigenie-table,#cheetah-article-wrapper table.affigenie-table{display:block!important;width:100%!important;max-width:100%!important;table-layout:auto!important;overflow:visible!important;border:0!important}
  table.affigenie-table thead{display:none!important}
  table.affigenie-table tbody,table.affigenie-table tr,table.affigenie-table td{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}
  table.affigenie-table tr{margin:0 0 16px!important;border:1px solid #e5e7eb!important;border-radius:12px!important;padding:12px!important;background:#fff!important}
  table.affigenie-table td{border:0!important;border-right:none!important;padding:8px 0!important;text-align:left!important;font-size:16px!important;line-height:1.45!important;word-break:normal!important;overflow-wrap:break-word!important;white-space:normal!important}
  table.affigenie-table td::before{content:attr(data-label);display:block;font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#1e40af;margin:0 0 4px}
  table.affigenie-table td:empty::before{content:none}
  #cheetah-article-wrapper table.affigenie-table td:first-child,#cheetah-article-wrapper table.affigenie-table td{width:100%!important;min-width:0!important;max-width:100%!important}
  table.affigenie-table img,#cheetah-article-wrapper table.affigenie-table img{width:80px!important;max-width:120px!important;height:auto!important}
  table.affigenie-table .affigenie-check-price,table.affigenie-table .check-price-btn,.affigenie-check-price,.check-price-btn{display:block!important;width:100%!important;max-width:100%!important;white-space:normal!important}
}
`.trim()
}

export function getAffigenieArticleStyles() {
  return `<style id="affigenie-article-styles">${getAffigenieArticleCss()}</style>`
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function attrValue(tag, name) {
  const match = String(tag || '').match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i'))

  return match ? (match[2] ?? match[3] ?? match[4] ?? '') : ''
}

function findAmazonHref(html) {
  const re = /href\s*=\s*("([^"]*)"|'([^']*)')/gi
  let match

  while ((match = re.exec(String(html || '')))) {
    const href = (match[2] || match[3] || '').replace(/&amp;/g, '&')

    if (href && href !== '#' && isAmazonHref(href)) return href
  }

  return ''
}

function isPriceCta(attrs, inner) {
  const className = attrValue(attrs, 'class')
  const text = stripTags(inner)

  return /check-price|affigenie-check-price|cta-button/i.test(className) || CTA_TEXT_RE.test(text)
}

function normalizeCtas(html, options) {
  return String(html || '').replace(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi, (full, attrs, inner) => {
    if (!isPriceCta(attrs, inner)) return full

    const href = attrValue(attrs, 'href').replace(/&amp;/g, '&')

    if (href && href !== '#' && !isAmazonHref(href)) return full

    const button = buildCheckPriceButton(href === '#' ? '' : href, options)

    return button || full
  })
}

function cellsOf(rowHtml) {
  const cells = []
  const re = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let match

  while ((match = re.exec(rowHtml))) {
    cells.push({ tag: match[1].toLowerCase(), attrs: match[2] || '', html: match[3] })
  }

  return cells
}

function ensureRowButton(cells, options) {
  const blob = cells.map(cell => cell.html).join(' ')

  if (/affigenie-check-price|check-price-btn/i.test(blob)) return cells

  const href = findAmazonHref(blob)
  const asin = extractAsin(blob)
  const button = buildCheckPriceButton(href, { ...options, asin: asin || options.asin })

  if (!button || !cells.length) return cells

  const next = cells.map(cell => ({ ...cell }))
  const last = next[next.length - 1]

  if (last.tag === 'td') last.html = `${last.html}${button}`

  return next
}

function upgradeTables(html, options) {
  return String(html || '').replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (full, attrs, inner) => {
    const rows = []
    const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi
    let rowMatch

    while ((rowMatch = rowRe.exec(inner))) rows.push({ attrs: rowMatch[1] || '', inner: rowMatch[2] })
    if (!rows.length) return full

    const parsed = rows.map(row => cellsOf(row.inner))
    const headerIndex = parsed.findIndex(cells => cells.length && cells.every(cell => cell.tag === 'th'))

    const headers =
      headerIndex >= 0 ? parsed[headerIndex].map(cell => stripTags(cell.html)) : parsed[0]?.map(() => '') || []

    const renderedRows = parsed.map((cells, rowIndex) => {
      const isHeader = rowIndex === headerIndex
      const withButton = isHeader ? cells : ensureRowButton(cells, options)

      const htmlCells = withButton
        .map((cell, cellIndex) => {
          let cellAttrs = cell.attrs || ''
          const label = headers[cellIndex] || ''

          if (!isHeader && cell.tag === 'td' && label && !/data-label\s*=/i.test(cellAttrs)) {
            cellAttrs += ` data-label="${escapeHtml(label)}"`
          }

          return `<${cell.tag}${cellAttrs}>${cell.html}</${cell.tag}>`
        })
        .join('')

      return `<tr${rows[rowIndex].attrs}>${htmlCells}</tr>`
    })

    const headerHtml = headerIndex >= 0 ? renderedRows[headerIndex] : ''
    const bodyHtml = renderedRows.filter((_, rowIndex) => rowIndex !== headerIndex).join('')

    let nextAttrs = attrs || ''

    if (!/class\s*=/i.test(nextAttrs)) nextAttrs += ' class="affigenie-table"'
    else if (!/affigenie-table/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/class\s*=\s*(['"])([\s\S]*?)\1/i, (all, quote, cls) => {
        return `class=${quote}${cls} affigenie-table${quote}`
      })
    }

    return `<table${nextAttrs}>${headerHtml ? `<thead>${headerHtml}</thead>` : ''}<tbody>${bodyHtml}</tbody></table>`
  })
}

const ARTICLE_TYPE_ALIASES = {
  standard: 'blog',
  rewrite: 'blog',
  'amazon-roundup-rewrite': 'amazon-roundup',
  'amazon-review-rewrite': 'amazon-review'
}

export function canonicalArticleType(type) {
  const key = String(type || '')
    .trim()
    .toLowerCase()

  if (!key) return ''

  return ARTICLE_TYPE_ALIASES[key] || key
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(String(text || ''))
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])

  return btoa(binary)
}

export function buildArticleIdentityMarker(type, settings) {
  const writerType = String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  const articleType = canonicalArticleType(writerType).replace(/[^a-z0-9-]/g, '')

  if (!articleType) return ''

  let encoded = ''

  try {
    encoded = encodeBase64(JSON.stringify(settings ?? {})).replace(/[^A-Za-z0-9+/=]/g, '')
  } catch {
    encoded = ''
  }

  return `<div data-affigenie-marker="1" data-affigenie-type="${articleType}" data-affigenie-writer-type="${writerType}" data-affigenie-settings="${encoded}" style="display:none!important;height:0;width:0;overflow:hidden;font-size:0;line-height:0;mso-hide:all;" aria-hidden="true"><!-- affigenie-article-type:${articleType} affigenie-writer-type:${writerType} affigenie-article-settings:${encoded} -->affigenie-article-type:${articleType}</div>`
}

const BLOG_REWRITE_TYPES = new Set(['', 'unknown', 'blog'])

export function rewriteAcceptsSource(writerType, detectedType) {
  const source = canonicalArticleType(detectedType)

  if (writerType === 'amazon-roundup-rewrite') return source === 'amazon-roundup'
  if (writerType === 'amazon-review-rewrite') return source === 'amazon-review'
  if (writerType === 'rewrite') return BLOG_REWRITE_TYPES.has(source)

  return true
}

export function rewriteSourceError(writerType) {
  if (writerType === 'amazon-roundup-rewrite') {
    return 'This URL is not an Amazon product roundup. Amazon roundup rewrite only accepts Amazon roundup articles.'
  }

  if (writerType === 'amazon-review-rewrite') {
    return 'This URL is not an Amazon single-product review. This rewrite only accepts Amazon single-product review articles.'
  }

  if (writerType === 'rewrite') {
    return 'This URL is not a blog article. Rewrite Blog only accepts blog articles, not Amazon single-product reviews or other article types.'
  }

  return ''
}

export function linkMapSnapshots(html) {
  return String(html || '').replace(
    /<img\b[^>]*\bdata-map-href=(["'])([\s\S]*?)\1[^>]*>/gi,
    (tag, _quote, href, offset, source) => {
      if (!href || href === '#') return tag

      const before = String(source || '').slice(Math.max(0, offset - 220), offset)

      if (/<a\b[^>]*>\s*$/i.test(before)) return tag

      return `<a href="${href}" target="_blank" rel="noopener noreferrer" data-map-link="true">${tag}</a>`
    }
  )
}

export function prepareArticleHtml(html, options = {}) {
  const normalized = normalizeCtas(html, options)

  return upgradeTables(normalized, options)
}

export function withRequiredCheckPrice(text, options = {}) {
  const source = String(text || '')

  if (/affigenie-check-price|check-price-btn/i.test(source)) return source
  if (/<a\b[^>]*>[^<]*check\s*price[^<]*<\/a>/i.test(source)) return source

  const button = buildCheckPriceButton(options.url || '', options)

  if (!button) return source

  return `${source}\n\n<p>${button}</p>`
}

export function finalizeArticleHtml(html, options = {}) {
  let prepared = linkMapSnapshots(prepareArticleHtml(html, options))

  if (options.articleType) {
    prepared = prepared.replace(/<div\b[^>]*data-affigenie-marker=["']1["'][^>]*>[\s\S]*?<\/div>/gi, '')
    const marker = buildArticleIdentityMarker(options.articleType, options.settings)

    if (marker) prepared = `${marker}\n${prepared}`
  }

  if (prepared.includes('id="affigenie-article-styles"')) return prepared

  return `${getAffigenieArticleStyles()}\n${prepared}`
}

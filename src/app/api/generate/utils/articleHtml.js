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

export function renderTopPickCards(products = [], options = {}) {
  const cards = products
    .map((product, index) => {
      const name = escapeHtml(product.productName || 'Amazon Product')
      const image = product.imageUrl
        ? `<img src="${escapeHtml(protectUrl(product.imageUrl))}" alt="${name}" style="display:block;width:100%;max-width:420px;height:auto;object-fit:contain;border-radius:10px;margin:12px auto;" />`
        : ''
      const rating = product.rating ? `<p><strong>Rating:</strong> ${escapeHtml(product.rating)}</p>` : ''
      const features = Array.isArray(product.features) ? product.features.slice(0, 3) : []
      const pros = features.length
        ? `<p><strong>Pros:</strong> ${features.map(escapeHtml).join(' · ')}</p>`
        : '<p><strong>Pros:</strong> Amazon-listed details are available for review.</p>'
      const cons = '<p><strong>Cons:</strong> Confirm product limitations and fit on the Amazon listing.</p>'
      const verdict = `<p>${index === 0 ? 'Our leading option based on its relevance to this roundup and the available listing details.' : 'A worthwhile alternative; compare its listing details against your needs.'}</p>`
      const button = buildCheckPriceButton(product.amazonUrl, { ...options, asin: product.asin })

      return `<article class="affigenie-product-card" style="box-sizing:border-box;width:100%;max-width:100%;margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">${index === 0 ? '<div style="display:inline-block;background:#eef2ff;color:#3730a3;font-weight:700;padding:6px 10px;border-radius:999px;margin-bottom:8px;">Top Pick</div>' : ''}${image}<h3>${name}</h3>${rating}${verdict}${pros}${cons}<div style="width:100%;max-width:100%;">${button}</div></article>`
    })
    .join('')

  return `<div class="affigenie-product-cards" style="width:100%;max-width:100%;">${cards}</div>`
}

export function getAffigenieArticleCss() {
  return `
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

export function prepareArticleHtml(html, options = {}) {
  const normalized = normalizeCtas(html, options)

  return upgradeTables(normalized, options)
}

export function withRequiredCheckPrice(text, options = {}) {
  const source = String(text || '')

  if (/affigenie-check-price|check-price-btn/i.test(source) || /check price/i.test(source)) return source

  const button = buildCheckPriceButton(options.url || '', options)

  if (!button) return source

  return `${source}\n\n${button}`
}

export function finalizeArticleHtml(html, options = {}) {
  const prepared = prepareArticleHtml(html, options)

  if (prepared.includes('id="affigenie-article-styles"')) return prepared

  return `${getAffigenieArticleStyles()}\n${prepared}`
}

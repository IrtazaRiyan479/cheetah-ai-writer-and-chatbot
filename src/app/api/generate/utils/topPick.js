import { escapeHtml, buildCheckPriceButton } from './articleHtml'

function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, letter => letter.toUpperCase())
}

export function renderTopPickCards(products = [], options = {}) {
  const safe = escapeHtml
  const cards = products.map((product, index) => {
    const name = safe(titleCase(product.productName || product.title || `Product ${index + 1}`))
    const image = product.imageUrl || product.image || ''
    const imageHtml = image
      ? `<div style="flex:0 0 160px;max-width:160px;"><img src="${safe(String(image).replace(/_/g, '%5F'))}" alt="${name}" style="width:100%;height:auto;object-fit:contain;border-radius:10px;" /></div>`
      : ''
    const verdict = safe(product.verdict || product.shortVerdict || product.summary || '')
    const rating = product.rating ? `<p style="margin:6px 0;"><strong>Rating:</strong> ${safe(String(product.rating))}</p>` : ''
    const pros = Array.isArray(product.pros) && product.pros.length
      ? `<p style="margin:6px 0;"><strong>Pros:</strong> ${product.pros.map(item => safe(String(item))).join(' · ')}</p>`
      : ''
    const cons = Array.isArray(product.cons) && product.cons.length
      ? `<p style="margin:6px 0;"><strong>Cons:</strong> ${product.cons.map(item => safe(String(item))).join(' · ')}</p>`
      : ''
    const button = buildCheckPriceButton(product.amazonUrl || product.url, { ...options, asin: product.asin })
    const badge =
      index === 0
        ? '<h2 class="affigenie-top-pick" style="margin:0 0 14px;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.03em;color:#111827;">Top Pick</h2>'
        : ''

    return `<article class="affigenie-product-card" style="box-sizing:border-box;max-width:100%;margin:20px 0;padding:18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      ${badge}
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;">
        ${imageHtml}
        <div style="flex:1 1 220px;min-width:0;">
          <h3 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:800;">${name}</h3>
          ${rating}${verdict ? `<p style="margin:6px 0;">${verdict}</p>` : ''}${pros}${cons}
          <div style="width:100%;max-width:100%;margin-top:12px;">${button}</div>
        </div>
      </div>
    </article>`
  }).join('\n')

  return `<div class="affigenie-product-cards">${cards}</div>`
}

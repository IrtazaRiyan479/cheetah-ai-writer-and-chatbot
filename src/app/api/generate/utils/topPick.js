import { escapeHtml, buildCheckPriceButton } from './articleHtml'

export function renderTopPickCards(products = [], options = {}) {
  const safe = escapeHtml
  const cards = products.map((product, index) => {
    const name = safe(product.productName || product.title || `Product ${index + 1}`)
    const image = product.imageUrl || product.image || ''
    const imageHtml = image ? `<img src="${safe(image.replace(/_/g, '%5F'))}" alt="${name}" style="width:100%;max-width:100%;height:auto;object-fit:contain;border-radius:10px;" />` : ''
    const verdict = safe(product.verdict || product.shortVerdict || product.summary || '')
    const rating = product.rating ? `<p><strong>Rating:</strong> ${safe(product.rating)}</p>` : ''
    const pros = Array.isArray(product.pros) && product.pros.length ? `<p><strong>Pros:</strong> ${product.pros.map(safe).join(' · ')}</p>` : ''
    const cons = Array.isArray(product.cons) && product.cons.length ? `<p><strong>Cons:</strong> ${product.cons.map(safe).join(' · ')}</p>` : ''
    const button = buildCheckPriceButton(product.amazonUrl || product.url, { ...options, asin: product.asin })

    return `<article class="affigenie-product-card" style="box-sizing:border-box;max-width:100%;margin:20px 0;padding:18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
      ${index === 0 ? '<div class="affigenie-top-pick" style="display:inline-block;background:#eef2ff;color:#3730a3;font-weight:700;padding:6px 10px;border-radius:999px;margin-bottom:12px;">Top Pick</div>' : ''}
      ${imageHtml}<h3>${name}</h3>${rating}${verdict ? `<p>${verdict}</p>` : ''}${pros}${cons}<div style="width:100%;max-width:100%;">${button}</div>
    </article>`
  }).join('\n')

  return `<div class="affigenie-product-cards">${cards}</div>`
}

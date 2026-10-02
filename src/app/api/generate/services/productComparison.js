import { callLLM } from '../utils/llm'
import { parseJsonSafe } from '../utils/lightLLM'
import { fetchSerperOutlineData, pickRelevantImages, buildBrandedHero } from '../utils/helpers'
import { buildCheckPriceButton, escapeHtml, extractAsin, renderResponsiveTable, resolveAffiliateUrl } from '../utils/articleHtml'
import { fetchInternalAmazonData, formatAmazonProducts } from './amazonRoundUp'

function productLabel(url, index) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const marker = parts.findIndex(part => ['dp', 'gp', 'product', 'item'].includes(part.toLowerCase()))
    const slug = marker > 0 ? parts[marker - 1] : ''
    const name = decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    return name && !/^[A-Z0-9]{10}$/i.test(name) ? name : `Product ${index + 1}`
  } catch { return `Product ${index + 1}` }
}

export function validateProductComparisonUrls(value) {
  const urls = Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : []
  if (urls.length < 2 || urls.length > 3) return { ok: false, urls }
  for (const value of urls) {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, urls }
    } catch { return { ok: false, urls } }
  }
  return { ok: true, urls }
}

function amazonDomain(url, settings) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return settings.amazonDomain || 'www.amazon.com' }
}

async function fetchProduct(url, index, settings) {
  const asin = extractAsin(url)
  const keyword = asin || productLabel(url, index)
  const domain = amazonDomain(url, settings)
  const raw = await fetchInternalAmazonData(keyword, { ...settings, amazonDomain: domain })
  const candidates = formatAmazonProducts(raw, { ...settings, numberOfProducts: 20, amazonDomain: domain }) || []
  const result = candidates.find(item => asin && String(item.asin || '').toUpperCase() === asin.toUpperCase()) || candidates[0]
  if (!result) throw new Error(`No Amazon product matched comparison URL ${index + 1}.`)
  const rating = raw?.data?.searchResult?.items?.find(item => String(item.asin || '').toUpperCase() === String(result.asin || '').toUpperCase())?.customerReviews?.starRating || null
  const source = raw?.data?.searchResult?.items?.find(item => String(item.asin || '').toUpperCase() === String(result.asin || '').toUpperCase())
  const image = result.imageUrl || ''
  const partnerTag = settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || ''

  return {
    ...result,
    imageUrl: image,
    amazonUrl: resolveAffiliateUrl({ url: result.amazonUrl || url, asin: result.asin || asin, domain, partnerTag, forceTag: settings.amazonTrackingId || '' }),
    rating,
    ratingCount: source?.customerReviews?.count || null,
    features: Array.isArray(result.features) ? result.features : []
  }
}

export async function generateProductComparisonOutline(body) {
  const settings = body.settings || {}
  const validation = validateProductComparisonUrls(settings.productComparisonUrls)
  if (!validation.ok) throw new Error('Provide two or three valid Amazon product URLs.')
  const keyword = body.targetKeyword || settings.targetKeyword || validation.urls.map(productLabel).join(' vs ')
  const metaResponse = await callLLM({
    system: 'Create concise SEO metadata for a product comparison. Return JSON only and do not invent product facts.',
    prompt: `Create title, metaTitle, metaDescription for a comparison of ${validation.urls.map(productLabel).join(', ')}. Topic: ${keyword}. Return JSON.`,
    json: true,
    maxTokens: 400
  })
  const metadata = parseJsonSafe(metaResponse.text) || {}
  const title = metadata.title || `${validation.urls.map(productLabel).join(' vs ')}: Product Comparison`
  const outlineResponse = await callLLM({
    system: 'Return JSON only. Create a concise article outline for a product comparison.',
    prompt: `For ${keyword}, return JSON {outline:[{type:"h2",text:"...",sectionType:"intro"}, {type:"h2",text:"...",sectionType:"comparison-article",subheadings:[{type:"h3",text:"...",sectionType:"product"}]}]}. There must be an intro, one comparison-article H2 containing H3s in this exact order: Product 1 features/pros/cons/customer feedback; Product 2 same; Product 3 same only if present; product comparison; FAQ; final verdict. Product names: ${validation.urls.map(productLabel).join(', ')}.`,
    json: true,
    maxTokens: 900
  })
  const outlineData = parseJsonSafe(outlineResponse.text) || {}
  const [products, serp, relevantImages] = await Promise.all([
    Promise.all(validation.urls.map((url, index) => fetchProduct(url, index, settings))),
    fetchSerperOutlineData(keyword).catch(() => null),
    pickRelevantImages(title, keyword, 5).catch(() => [])
  ])
  const productHeadings = products.map((product, index) => ({ type: 'h3', text: `${index + 1}. ${product.productName}: Features, Pros, Cons & Amazon Customer Feedback`, sectionType: 'product', productIndex: index }))
  const orderedSubheadings = [
    ...productHeadings,
    { type: 'h3', text: `${products.map(product => product.productName).join(' vs ')}: Comparison`, sectionType: 'comparison' },
    { type: 'h3', text: `Frequently Asked Questions About ${keyword}`, sectionType: 'faq' },
    { type: 'h3', text: `Final Verdict: ${keyword}`, sectionType: 'verdict' }
  ]
  const outline = Array.isArray(outlineData.outline) ? outlineData.outline : []
  const intro = outline.find(item => item.sectionType === 'intro') || { type: 'h2', text: `Introduction to ${keyword}`, sectionType: 'intro' }
  const comparison = { type: 'h2', text: `Product Comparison: ${keyword}`, sectionType: 'comparison-article', subheadings: orderedSubheadings, comparisonData: { products, serp, images: relevantImages.slice(1, 1 + extraImagesNeeded) } }
  const heroImage = await buildBrandedHero({ title, siteName: settings.siteName || settings.clientSite || settings.website || 'AffiGenie', backgroundUrl: relevantImages[0]?.url || '' }).catch(() => '')
  const productImageCount = products.filter(product => product.imageUrl).length
  const extraImagesNeeded = Math.max(0, Math.min(2, 4 - productImageCount - 1))

  return {
    success: true,
    title,
    metaTitle: metadata.metaTitle || title.slice(0, 60),
    metaDescription: metadata.metaDescription || `Compare ${products.map(product => product.productName).join(', ')} by their listed features, pros, and cons.`,
    outline: [intro, comparison],
    heroImage,
    heroImageId: null,
    heroImageSource: relevantImages[0] ? 'branded-photo' : 'branded-gradient',
    comparisonShared: { products, serp, images: relevantImages.slice(1, 1 + extraImagesNeeded) }
  }
}

function cta(product, settings) {
  return buildCheckPriceButton(product.amazonUrl, { language: settings.language, asin: product.asin, domain: amazonDomain(product.amazonUrl, settings), partnerTag: settings.amazonTrackingId || process.env.AMAZON_PARTNER_TAG || '' })
}

async function generateWithOneRetry(prompt, system, json = false, maxTokens = 900) {
  let firstError
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await callLLM({ system, prompt, json, maxTokens }) } catch (error) { firstError ||= error }
  }
  throw firstError || new Error('Section generation failed.')
}

function prosConsTable(pros, cons) {
  return renderResponsiveTable({
    headers: ['Pros', 'Cons'],
    rows: [[`<ul>${pros.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`, `<ul>${cons.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`]]
  })
}

export async function generateProductComparisonSection(body) {
  const settings = body.settings || {}
  const outline = Array.isArray(body.outlineContext) ? body.outlineContext : []
  const section = outline.find(item => item.text === body.heading) || {}
  const comparisonSection = outline.find(item => item.sectionType === 'comparison-article') || section || outline[0] || {}
  const products = body.shared?.products || settings.comparisonShared?.products || comparisonSection.comparisonData?.products || []
  if (products.length < 2 || products.length > 3) throw new Error('Product comparison data must contain two or three products.')
  const keyword = body.targetKeyword || settings.targetKeyword || body.heading || ''
  if (section.sectionType === 'intro') {
    const response = await generateWithOneRetry(`Write a concise introduction for ${keyword}, introducing a factual comparison of ${products.map(product => product.productName).join(', ')}. Do not invent facts or include cards/tables.`, 'Write only the article introduction.', false, 500)
    return { success: true, text: response.text }
  }
  const subheadings = comparisonSection.subheadings || body.subheadings || []
  const html = []

  for (let index = 0; index < products.length; index++) {
    const product = products[index]
    const heading = subheadings[index]?.text || `${index + 1}. ${product.productName}`
    const prompt = `Evaluate ${product.productName} for ${keyword}. Facts: price ${product.price}; listed features ${product.features.join(' | ') || 'not provided'}; rating ${product.rating || 'not provided'}; rating count ${product.ratingCount || 'not provided'}. Do not invent reviews or product data. Return JSON: features[], pros[], cons[], customerFeedback, shortVerdict. Feedback must be based only on provided review/rating data; otherwise say unavailable.`
    try {
      const response = await generateWithOneRetry(prompt, 'Return factual product evaluation JSON only.', true)
      const data = parseJsonSafe(response.text) || {}
      const features = Array.isArray(data.features) && data.features.length ? data.features : product.features.slice(0, 4)
      const pros = Array.isArray(data.pros) ? data.pros : []
      const cons = Array.isArray(data.cons) ? data.cons : []
      const image = product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.productName)}" style="width:100%;max-width:420px;height:auto;object-fit:contain;border-radius:12px;margin:18px auto;display:block;" />` : ''
      const rating = product.rating ? `<p><strong>Rating:</strong> ${escapeHtml(product.rating)}${product.ratingCount ? ` (${escapeHtml(product.ratingCount)} ratings)` : ''}</p>` : ''
      html.push(`<h3>${escapeHtml(heading)}</h3>${image}<p><strong>Price:</strong> ${escapeHtml(product.price)}</p>${rating}<h4>Features</h4><ul>${features.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h4>Pros and Cons</h4>${prosConsTable(pros, cons)}<h4>Amazon Customer Feedback</h4><p>${escapeHtml(data.customerFeedback || 'Customer feedback data was not available.')}</p><p>${escapeHtml(data.shortVerdict || '')}</p><div style="width:100%;max-width:100%;">${cta(product, settings)}</div>`)
    } catch {
      html.push(`<h3>${escapeHtml(heading)}</h3><p>This product section could not be generated. Retry this section to try again.</p>`)
    }
  }

  const comparisonHeading = subheadings[products.length]?.text || 'Side-by-Side Comparison'
  try {
    const response = await generateWithOneRetry(`Compare these products only using supplied facts. Return JSON {rows:[{keyFeatures,strengths,tradeoffs}]}. ${JSON.stringify(products.map(product => ({ name: product.productName, price: product.price, features: product.features, rating: product.rating })))}`, 'Return factual comparison JSON only.', true, 1000)
    const result = parseJsonSafe(response.text) || {}
    const rows = products.map((product, index) => {
      const row = result.rows?.[index] || {}
      return [escapeHtml(product.productName), escapeHtml(product.price), escapeHtml(row.keyFeatures || product.features.slice(0, 3).join('; ')), escapeHtml(row.strengths || ''), escapeHtml(row.tradeoffs || ''), cta(product, settings)]
    })
    html.push(`<h3>${escapeHtml(comparisonHeading)}</h3>${renderResponsiveTable({ headers: ['Product', 'Price', 'Key Features', 'Strengths', 'Tradeoffs', 'Check Price'], rows })}`)
  } catch { html.push(`<h3>${escapeHtml(comparisonHeading)}</h3><p>Comparison generation failed. Retry this section to try again.</p>`) }

  const faqHeading = subheadings[products.length + 1]?.text || `Frequently Asked Questions About ${keyword}`
  try {
    const response = await generateWithOneRetry(`Write four FAQs in HTML about ${products.map(product => product.productName).join(', ')}. Use only these facts and mark unavailable information: ${JSON.stringify(products.map(product => ({ name: product.productName, price: product.price, features: product.features, rating: product.rating })))}`, 'Write factual FAQ HTML with h4 questions and p answers.', false, 900)
    html.push(`<h3>${escapeHtml(faqHeading)}</h3>${response.text}`)
  } catch { html.push(`<h3>${escapeHtml(faqHeading)}</h3><p>FAQ generation failed. Retry this section to try again.</p>`) }

  const verdictHeading = subheadings[products.length + 2]?.text || `Final Verdict: ${keyword}`
  try {
    const response = await generateWithOneRetry(`Return JSON {winnerIndex,verdict,bestFor[]} for these products, based only on the supplied facts. ${JSON.stringify(products.map(product => ({ name: product.productName, price: product.price, features: product.features, rating: product.rating })))}`, 'Return factual final verdict JSON only.', true, 700)
    const verdict = parseJsonSafe(response.text) || {}
    const winnerIndex = Math.max(0, Math.min(products.length - 1, Number(verdict.winnerIndex) || 0))
    html.push(`<h3>${escapeHtml(verdictHeading)}</h3><p>${escapeHtml(verdict.verdict || 'Compare the listed product information against your needs.')}</p><ul>${products.map((product, index) => `<li><strong>${escapeHtml(product.productName)}:</strong> ${escapeHtml(verdict.bestFor?.[index] || 'Review the listed features and price.')}</li>`).join('')}</ul><div style="width:100%;max-width:100%;">${cta(products[winnerIndex], settings)}</div>`)
  } catch { html.push(`<h3>${escapeHtml(verdictHeading)}</h3><p>Final verdict generation failed. Retry this section to try again.</p>`) }

  const extraImages = body.shared?.images || settings.comparisonShared?.images || []
  const imageMarkup = extraImages.slice(0, 2).map(image => `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt || keyword)}" style="width:100%;max-width:100%;height:auto;border-radius:12px;margin:18px 0;display:block;" />`).join('')
  return { success: true, text: `${imageMarkup}${html.join('\n')}` }
}

const FILLER = new Set([
  'a', 'an', 'the', 'simple', 'basic', 'generic', 'standard', 'normal', 'just', 'make', 'create', 'build',
  'me', 'please', 'want', 'i', 'app', 'tool', 'widget', 'my', 'need', 'give', 'for', 'to', 'of', 'and',
  'affigenie', 'magnet', 'lead'
])

const TITLE_STOP = new Set([
  ...FILLER,
  'with', 'your', 'you', 'from', 'into', 'this', 'that', 'calculator', 'estimator', 'converter', 'planner',
  'checker', 'generator', 'quiz'
])

export function isGenericCalculator(prompt) {
  const words = String(prompt || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !FILLER.has(word))
  const unique = [...new Set(words)]

  if (unique.length === 1 && unique[0] === 'calculator') return true
  if (unique.length === 2 && unique.includes('calculator') && unique.some(word => ['arithmetic', 'math', 'maths'].includes(word))) {
    return true
  }

  return false
}

export function inferKind(prompt, kind) {
  if (kind === 'formula' || kind === 'assistant') return kind
  if (isGenericCalculator(prompt)) return 'formula'

  return 'assistant'
}

export function stepsFor(kind) {
  if (kind === 'arithmetic') {
    return [{ id: 'local', label: 'Build a general-purpose calculator in the browser' }]
  }

  if (kind === 'formula') {
    return [
      { id: 'inputs', label: 'Choose the inputs' },
      { id: 'logic', label: 'Write the calculation' }
    ]
  }

  return [
    { id: 'inputs', label: 'Choose the questions' },
    { id: 'logic', label: 'Write the result instructions' }
  ]
}

export function significantWords(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !TITLE_STOP.has(word))
    )
  ]
}

export function literalTitle(prompt, title) {
  const cleaned = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const promptWords = significantWords(prompt)
  const titleWords = significantWords(cleaned)
  const allowed = new Set(promptWords)
  const extras = titleWords.filter(word => !allowed.has(word))
  const missing = promptWords.filter(word => !cleaned.toLowerCase().includes(word))

  if (!cleaned || extras.length || missing.length) return String(prompt || '').trim().slice(0, 80) || 'Your tool'

  return cleaned
}

export function literalDescription(prompt, description, kind) {
  const text = String(description || '').replace(/\s+/g, ' ').trim().slice(0, 240)
  const words = significantWords(prompt)
  const hay = text.toLowerCase()

  if (text && (!words.length || words.some(word => hay.includes(word)))) return text

  return kind === 'formula' ? 'Enter the values to calculate the result.' : 'Fill in the fields to generate a result.'
}

export function evaluateFormula(formula, scope) {
  const src = String(formula || '').replace(/\s+/g, '')

  if (!src || !scope) return null

  let index = 0
  const peek = () => src[index]

  function parseExpr() {
    let left = parseTerm()

    if (left == null) return null

    while (peek() === '+' || peek() === '-') {
      const op = src[index++]
      const right = parseTerm()

      if (right == null) return null
      left = op === '+' ? left + right : left - right
    }

    return left
  }

  function parseTerm() {
    let left = parseFactor()

    if (left == null) return null

    while (peek() === '*' || peek() === '/') {
      const op = src[index++]
      const right = parseFactor()

      if (right == null || (op === '/' && right === 0)) return null
      left = op === '*' ? left * right : left / right
    }

    return left
  }

  function parseFactor() {
    if (peek() === '+') {
      index += 1

      return parseFactor()
    }

    if (peek() === '-') {
      index += 1
      const value = parseFactor()

      return value == null ? null : -value
    }

    if (peek() === '(') {
      index += 1
      const value = parseExpr()

      if (value == null || peek() !== ')') return null
      index += 1

      return value
    }

    if ((peek() >= '0' && peek() <= '9') || peek() === '.') {
      const start = index

      while ((src[index] >= '0' && src[index] <= '9') || src[index] === '.') index += 1
      if (src.slice(start, index).split('.').length > 2) return null
      const value = Number(src.slice(start, index))

      return Number.isFinite(value) ? value : null
    }

    const start = index

    while (src[index] && /[A-Za-z0-9_]/.test(src[index])) index += 1
    const name = src.slice(start, index)

    if (!name || !Object.prototype.hasOwnProperty.call(scope, name)) return null
    const value = Number(scope[name])

    return Number.isFinite(value) ? value : null
  }

  const result = parseExpr()

  if (result == null || index !== src.length || !Number.isFinite(result)) return null

  return result
}

export function validateFormula(formula, inputs) {
  const text = String(formula || '').replace(/\s+/g, '')

  if (!text) return { ok: false, reason: 'Formula is empty.' }
  if (text.length > 300) return { ok: false, reason: 'Formula is too long.' }
  if (!/^[\d+\-*/().A-Za-z_]+$/.test(text)) return { ok: false, reason: 'Formula has unsupported characters.' }

  const refs = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []
  const ids = new Set((inputs || []).map(input => input.id))
  const unknown = [...new Set(refs.filter(ref => !ids.has(ref)))]

  if (!refs.length) return { ok: false, reason: 'Formula must use the input ids.' }
  if (unknown.length) return { ok: false, reason: `Formula uses unknown names: ${unknown.join(', ')}.` }

  const unused = (inputs || []).filter(input => !refs.includes(input.id)).map(input => input.id)

  if (unused.length) return { ok: false, reason: `Formula does not use: ${unused.join(', ')}.` }

  const samples = [2, 4, 8]
  const runs = samples.some(sample => {
    const scope = Object.fromEntries((inputs || []).map(input => [input.id, sample]))

    return evaluateFormula(text, scope) != null
  })

  if (!runs) return { ok: false, reason: 'Formula does not evaluate.' }

  return { ok: true, formula: text }
}

/**
 * Turn any thrown or returned failure into a readable string.
 * Never returns "[object Object]".
 * @param {unknown} error
 * @returns {string}
 */
export function serializeError(error) {
  const seen = new WeakSet()

  const walk = (value, depth) => {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'bigint') return value.toString()
    if (depth > 5) return ''

    if (Array.isArray(value)) {
      const parts = value.map(item => walk(item, depth + 1)).filter(Boolean)

      return parts.join('; ')
    }

    if (typeof value !== 'object') return ''
    if (seen.has(value)) return ''
    seen.add(value)

    if (typeof value.message === 'string' && value.message.trim() && value.message !== '[object Object]') {
      const status = value.status || value.statusCode || value.response?.status
      const code = value.code && value.code !== value.message ? ` (${value.code})` : ''

      return `${status ? `HTTP ${status}: ` : ''}${value.message.trim()}${code}`
    }

    const nested =
      value.error ||
      value.response?.data ||
      value.data ||
      value.cause ||
      value.details ||
      value.body

    if (nested && nested !== value) {
      const nestedText = walk(nested, depth + 1)

      if (nestedText) return nestedText
    }

    const status = value.status || value.statusCode || value.response?.status
    const code = value.code || value.error_code || value.type

    if (status || code) {
      return [status ? `HTTP ${status}` : '', code ? String(code) : ''].filter(Boolean).join(': ')
    }

    try {
      const json = JSON.stringify(value, (key, item) => {
        if (key === 'stack' || key === 'config' || key === 'request') return undefined
        if (item && typeof item === 'object') {
          if (seen.has(item)) return undefined
          seen.add(item)
        }

        return item
      })

      if (json && json !== '{}' && json !== '[]') return json.slice(0, 500)
    } catch {
      // circular or non-serializable
    }

    return ''
  }

  const text = walk(error, 0)

  if (!text || text === '[object Object]') return 'Unknown error'

  return text.replace(/\[object Object\]/g, 'Unknown error').slice(0, 800)
}

import { serializeError } from '@/utils/serializeError'

export function parseProviderKeyList(value) {
  const values = String(value || '').split(/[\n,;]+/)
  const seen = new Set()

  return values.map(value => value.trim()).filter(value => {
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

export function listProviderKeys(primaryListName, { numberedPrefix, legacySingles = [] } = {}) {
  const values = [process.env[primaryListName] || '']
  if (numberedPrefix) {
    for (let index = 1; index <= 20; index++) values.push(process.env[`${numberedPrefix}${index}`] || '')
  }
  for (const name of legacySingles) values.push(process.env[name] || '')
  return parseProviderKeyList(values.join('\n'))
}

function failureCode(error) {
  return String(error?.status || error?.statusCode || serializeError(error).match(/(?:HTTP\s*)?(\d{3})/i)?.[1] || 'error')
}

export async function withProviderKey(keys, fn) {
  const ordered = [...new Set((keys || []).map(value => String(value || '').trim()).filter(Boolean))]
  if (!ordered.length) return null
  let lastError

  for (let index = 0; index < ordered.length; index++) {
    try {
      const result = await fn(ordered[index], { index, total: ordered.length })
      if (result == null || result === '') throw new Error('Provider returned an empty response.')
      return result
    } catch (error) {
      lastError = error
      console.warn(`provider key ${index + 1}/${ordered.length} failed (${failureCode(error)})`)
    }
  }

  throw new Error(serializeError(lastError))
}

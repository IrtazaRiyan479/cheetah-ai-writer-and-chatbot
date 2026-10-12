export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function passwordIssue(value) {
  const password = String(value || '')
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include uppercase, lowercase, and a number.'
  }
  return ''
}

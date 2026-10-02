import { createHmac, createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

export const ADMIN_COOKIE = 'affigenie_admin_unlock'
export const ADMIN_COOKIE_MAX_AGE = 8 * 60 * 60

function secret() { return process.env.ADMIN_PANEL_KEY || '' }
function equalSecret(input, expected) {
  return timingSafeEqual(createHash('sha256').update(String(input || '')).digest(), createHash('sha256').update(String(expected || '')).digest()) && Boolean(expected)
}
function signature(expiry, key) { return createHmac('sha256', key).update(`admin:${expiry}`).digest('hex') }

export function createAdminCookieValue(key, expiry = Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE) {
  return `${expiry}.${signature(expiry, key)}`
}

function validAdminCookie(value, key) {
  if (!value || !key) return false
  const [expiryText, suppliedSignature] = String(value).split('.')
  const expiry = Number(expiryText)
  if (!Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || !suppliedSignature) return false
  const expected = createHash('sha256').update(signature(expiry, key)).digest()
  const supplied = createHash('sha256').update(suppliedSignature).digest()
  return timingSafeEqual(expected, supplied)
}

export function verifyAdminCookie(value, key = secret()) { return validAdminCookie(value, key) }

export async function requireDbAdmin() {
  const session = await getServerSession(authOptions)
  const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })
  if (!user || user.role !== 'admin') return { error: NextResponse.json({ success: false, error: serializeError(new Error('Admin access required.')) }, { status: 403 }) }
  return { user }
}

export async function requireAdmin(request) {
  const gate = await requireDbAdmin()
  if (gate.error) return gate
  if (!validAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value, secret())) {
    return { error: NextResponse.json({ success: false, error: serializeError(new Error('Admin console is locked.')) }, { status: 403 }) }
  }
  return gate
}

export function adminCookieOptions(maxAge = ADMIN_COOKIE_MAX_AGE) {
  return { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge }
}
export function compareAdminKey(input, expected) { return equalSecret(input, expected) }
export function adminKeyConfigured() { return Boolean(secret()) }
export function setAdminCookie(response, key) {
  response.cookies.set(ADMIN_COOKIE, createAdminCookieValue(key), adminCookieOptions())
  return response
}
export function clearAdminCookie(response) {
  response.cookies.set(ADMIN_COOKIE, '', adminCookieOptions(0))
  return response
}

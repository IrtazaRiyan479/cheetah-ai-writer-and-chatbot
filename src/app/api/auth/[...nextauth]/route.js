import NextAuth from 'next-auth'
import { getToken } from 'next-auth/jwt'

import { authOptions } from '@/libs/auth'

const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60
const BROWSER_SESSION_MAX_AGE = 12 * 60 * 60

async function shouldRemember(req) {
  const url = new URL(req.url)
  if (req.method === 'POST' && url.pathname.includes('/callback/credentials')) {
    const text = await req.clone().text()
    return new URLSearchParams(text).get('remember') === 'true'
  }
  if (url.pathname.includes('/google')) return true
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return true
    return token.remember !== false
  } catch {
    return true
  }
}

function asSessionCookie(cookie) {
  if (!/session-token/i.test(cookie)) return cookie
  return cookie.replace(/;\s*Expires=[^;]*/gi, '').replace(/;\s*Max-Age=[^;]*/gi, '')
}

async function handler(req, ctx) {
  const remember = await shouldRemember(req)
  const auth = NextAuth({
    ...authOptions,
    session: {
      ...authOptions.session,
      maxAge: remember ? REMEMBER_MAX_AGE : BROWSER_SESSION_MAX_AGE
    }
  })
  const res = await auth(req, ctx)
  if (remember) return res

  const headers = new Headers(res.headers)
  const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
  if (!setCookies.length) {
    const raw = headers.get('set-cookie')
    if (raw) setCookies.push(raw)
  }
  if (!setCookies.length) return res

  headers.delete('set-cookie')
  for (const cookie of setCookies) headers.append('set-cookie', asSessionCookie(cookie))
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

export { handler as GET, handler as POST }

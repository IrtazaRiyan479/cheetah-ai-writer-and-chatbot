import 'server-only'

import { PrismaClient } from '@prisma/client'

import { i18n } from '@/configs/i18n'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export async function stripeRequest(path, { method = 'GET', params } = {}) {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.')

  const options = {
    method,
    headers: { Authorization: `Bearer ${secretKey}` }
  }

  if (params && method !== 'GET') {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    options.body = new URLSearchParams(params).toString()
  }

  const url = new URL(`${STRIPE_API_BASE}/${path}`)

  if (params && method === 'GET') {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`)
  }

  return data
}

export async function saveStripeCustomerId(userId, customerId) {
  return prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
}

export async function syncStripeSubscription(subscription, customerId) {
  if (!subscription?.id) return null

  const customer = typeof customerId === 'string' ? customerId : customerId?.id || subscription.customer
  const metadataUserId = subscription.metadata?.userId

  const user = metadataUserId
    ? await prisma.user.findUnique({ where: { id: metadataUserId } })
    : await prisma.user.findFirst({
        where: {
          OR: [
            ...(customer ? [{ stripeCustomerId: customer }] : []),
            { stripeSubscriptionId: subscription.id }
          ]
        }
      })

  if (!user) {
    console.warn(`[stripe] No local user found for subscription ${subscription.id}`)

    return null
  }

  const status = String(subscription.status || 'none')
  const hasProAccess = status === 'active' || status === 'trialing'
  const isAdmin = user.role === 'admin' || user.plan === 'admin'

  return prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customer || user.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      plan: isAdmin ? 'admin' : hasProAccess ? 'pro' : 'free',
      role: user.role === 'admin' ? 'admin' : hasProAccess ? 'pro' : 'free'
    }
  })
}

export async function syncStripeCustomer(customerId) {
  if (!customerId) return null

  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } })

  if (!user || user.role === 'admin') return user

  return prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'free',
      plan: 'free',
      subscriptionStatus: 'deleted',
      stripeSubscriptionId: null,
      stripeCustomerId: null
    }
  })
}

export function getAppUrl(request) {
  const configuredUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL

  if (configuredUrl) return configuredUrl.replace(/\/$/, '')

  return new URL(request.url).origin
}

export function getLocalizedAppUrl(request, path) {
  const referer = request.headers.get('referer')
  let locale = i18n.defaultLocale

  if (referer) {
    try {
      const firstSegment = new URL(referer).pathname.split('/').filter(Boolean)[0]

      if (i18n.locales.includes(firstSegment)) locale = firstSegment
    } catch {
      // Use the default locale when Referer is not a valid URL.
    }
  }

  return `${getAppUrl(request)}/${locale}/${String(path || '').replace(/^\//, '')}`
}
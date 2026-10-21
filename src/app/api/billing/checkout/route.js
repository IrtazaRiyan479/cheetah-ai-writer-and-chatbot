import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { getLocalizedAppUrl, saveStripeCustomerId, stripeRequest } from '@/libs/stripe'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 })
    if (!user.email)
      return NextResponse.json({ success: false, error: 'An email address is required.' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const requested = body.plan === 'enterprise' || body.plan === 'max' ? 'enterprise' : 'pro'

    const packDefaults = {
      pro: { amount: 7.5, words: 50000, name: 'Pro' },
      enterprise: { amount: 16, words: 200000, name: 'Max' }
    }

    const { PrismaClient } = await import('@prisma/client')
    const prisma = global.prisma || new PrismaClient()

    if (process.env.NODE_ENV !== 'production') global.prisma = prisma

    const setting = await prisma.appSetting.findUnique({ where: { key: 'pricingCopy' } }).catch(() => null)
    const pricing = setting ? JSON.parse(setting.value) : []
    const planCopy = Array.isArray(pricing) ? pricing.find(item => item.key === requested) : null
    const fallback = packDefaults[requested]
    const savedAmount = Number(planCopy?.displayAmount)
    const amount = Number.isFinite(savedAmount) && savedAmount > 0 ? savedAmount : fallback.amount
    const words = Math.max(1, Math.round(Number(planCopy?.words) || fallback.words))
    const plan = requested === 'enterprise' ? 'max' : 'pro'

    const currency =
      String(planCopy?.currency || process.env.STRIPE_CURRENCY || 'usd')
        .toLowerCase()
        .trim() || 'usd'

    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripeRequest('customers', {
        method: 'POST',
        params: { email: user.email, name: user.name || '', 'metadata[userId]': user.id }
      })

      customerId = customer.id
      await saveStripeCustomerId(user.id, customerId)
    }

    const pricingUrl = getLocalizedAppUrl(request, 'pricing')

    const checkout = await stripeRequest('checkout/sessions', {
      method: 'POST',
      params: {
        mode: 'payment',
        customer: customerId,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': currency,
        'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
        'line_items[0][price_data][product_data][name]': `${planCopy?.name || fallback.name} word pack`,
        'line_items[0][price_data][product_data][description]': `${words.toLocaleString()} words. They never expire.`,
        'managed_payments[enabled]': 'false',
        success_url: `${pricingUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${pricingUrl}?checkout=cancelled`,
        client_reference_id: user.id,
        'metadata[userId]': user.id,
        'metadata[plan]': plan,
        'metadata[words]': String(words)
      }
    })

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.')

    return NextResponse.json({ success: true, url: checkout.url })
  } catch (error) {
    console.error('[stripe] checkout session creation failed:', error?.message || error)

    return NextResponse.json({ success: false, error: error?.message || 'Unable to start checkout.' }, { status: 500 })
  }
}

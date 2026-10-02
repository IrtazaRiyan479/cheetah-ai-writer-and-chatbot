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
    if (!user.email) return NextResponse.json({ success: false, error: 'An email address is required.' }, { status: 400 })

    if (user.role === 'admin' || user.plan === 'admin') {
      return NextResponse.json({ success: false, error: 'Admin accounts do not need a subscription.' }, { status: 400 })
    }

    if (user.plan === 'pro' || user.role === 'pro') {
      return NextResponse.json({ success: false, error: 'Your account already has Pro. Use Manage Billing to update your subscription.' }, { status: 409 })
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'Stripe checkout is not configured. Set STRIPE_PRO_PRICE_ID.' },
        { status: 503 }
      )
    }

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
        mode: 'subscription',
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${pricingUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${pricingUrl}?checkout=cancelled`,
        client_reference_id: user.id,
        'metadata[userId]': user.id,
        'subscription_data[metadata][userId]': user.id
      }
    })

    if (!checkout.url) throw new Error('Stripe did not return a checkout URL.')

    return NextResponse.json({ success: true, url: checkout.url })
  } catch (error) {
    console.error('[stripe] checkout session creation failed:', error?.message || error)

    return NextResponse.json({ success: false, error: error?.message || 'Unable to start checkout.' }, { status: 500 })
  }
}
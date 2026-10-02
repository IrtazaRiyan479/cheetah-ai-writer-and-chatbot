import { createHmac, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { stripeRequest, syncStripeCustomer, syncStripeSubscription } from '@/libs/stripe'

export const runtime = 'nodejs'

function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false

  const parts = signatureHeader.split(',').map(part => part.split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)

  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))

  if (ageSeconds > 300) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false

    const actualBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')

    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  })
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    return NextResponse.json({ success: false, error: 'Stripe webhook is not configured.' }, { status: 503 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return NextResponse.json({ success: false, error: 'Invalid Stripe webhook signature.' }, { status: 400 })
  }

  let event

  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid webhook payload.' }, { status: 400 })
  }

  try {
    const object = event.data?.object

    switch (event.type) {
      case 'checkout.session.completed': {
        if (object?.mode === 'subscription' && object.subscription) {
          const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription.id

          const subscription =
            typeof object.subscription === 'object' ? object.subscription : await stripeRequest(`subscriptions/${subscriptionId}`)

          await syncStripeSubscription(subscription, object.customer)
        }

        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(object, object.customer)
        break
      case 'customer.deleted':
        await syncStripeCustomer(object.id)
        break
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe] webhook handling failed:', event.type, error?.message || error)

    return NextResponse.json({ success: false, error: 'Webhook processing failed.' }, { status: 500 })
  }
}
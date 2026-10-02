import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { getLocalizedAppUrl, stripeRequest } from '@/libs/stripe'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 })

    if (!user.stripeCustomerId) {
      return NextResponse.json({ success: false, error: 'No Stripe customer is linked to this account.' }, { status: 400 })
    }

    const accountUrl = getLocalizedAppUrl(request, 'account')

    const portal = await stripeRequest('billing_portal/sessions', {
      method: 'POST',
      params: {
        customer: user.stripeCustomerId,
        return_url: accountUrl
      }
    })

    if (!portal.url) throw new Error('Stripe did not return a customer portal URL.')

    return NextResponse.json({ success: true, url: portal.url })
  } catch (error) {
    console.error('[stripe] customer portal session creation failed:', error?.message || error)

    return NextResponse.json({ success: false, error: error?.message || 'Unable to open billing portal.' }, { status: 500 })
  }
}
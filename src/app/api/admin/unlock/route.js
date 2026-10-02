import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'
import { adminKeyConfigured, compareAdminKey, setAdminCookie } from '../_auth'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: serializeError(new Error('Admin access required.')) }, { status: 403 })
    }

    if (!adminKeyConfigured()) {
      return NextResponse.json({ success: false, error: 'Admin unlock is not configured.' }, { status: 503 })
    }

    const body = await request.json()
    const key = String(body?.key || '')

    if (!compareAdminKey(key, process.env.ADMIN_PANEL_KEY)) {
      return NextResponse.json({ success: false, error: 'Invalid unlock key.' }, { status: 403 })
    }

    return setAdminCookie(NextResponse.json({ success: true }), process.env.ADMIN_PANEL_KEY)
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

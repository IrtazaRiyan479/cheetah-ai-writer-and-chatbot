import { NextResponse } from 'next/server'

import { clearAdminCookie, requireAdmin } from '../_auth'
import { serializeError } from '@/utils/serializeError'

export async function POST(request) {
  try {
    const gate = await requireAdmin(request)
    if (gate.error) return gate.error
    return clearAdminCookie(NextResponse.json({ success: true }))
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

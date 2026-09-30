import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

    if (!user) return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 })

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return NextResponse.json({ success: false, error: 'Current password and a new password of at least 8 characters are required.' }, { status: 400 })
    }

    if (!user.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect.' }, { status: 403 })
    }

    const { PrismaClient } = await import('@prisma/client')
    const prisma = global.prisma || new PrismaClient()
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 10) } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

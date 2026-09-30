import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    wordsUsed: user.wordsUsed,
    wordsLimit: user.wordsLimit
  }
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

  if (!user) return { error: NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 }) }
  if (user.role !== 'admin') return { error: NextResponse.json({ success: false, error: 'Admin only.' }, { status: 403 }) }

  return { user }
}

export async function GET() {
  const gate = await requireAdmin()

  if (gate.error) return gate.error

  const users = await prisma.user.findMany({ orderBy: { email: 'asc' } })

  return NextResponse.json({ success: true, users: users.map(publicUser) })
}

export async function POST(request) {
  try {
    const gate = await requireAdmin()

    if (gate.error) return gate.error

    const { name, email, password, role = 'free' } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 })
    }

    const created = await prisma.user.create({
      data: {
        name: name || email,
        email,
        password: await bcrypt.hash(password, 10),
        role: ['free', 'pro', 'admin'].includes(role) ? role : 'free',
        plan: ['free', 'pro', 'admin'].includes(role) ? role : 'free'
      }
    })

    return NextResponse.json({ success: true, user: publicUser(created) })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireAdmin()

    if (gate.error) return gate.error

    const { id, password, role, wordsLimit } = await request.json()
    const target = await prisma.user.findUnique({ where: { id } })

    if (!target) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 })

    if (role && role !== 'admin' && target.role === 'admin' && gate.user.id === target.id) {
      return NextResponse.json({ success: false, error: 'You cannot remove your own admin access.' }, { status: 403 })
    }

    const data = {}

    if (password) data.password = await bcrypt.hash(password, 10)
    if (role && ['free', 'pro', 'admin'].includes(role)) {
      data.role = role
      data.plan = role
    }
    if (Number.isFinite(Number(wordsLimit))) data.wordsLimit = Number(wordsLimit)

    const updated = await prisma.user.update({ where: { id }, data })

    return NextResponse.json({ success: true, user: publicUser(updated) })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const gate = await requireAdmin()

    if (gate.error) return gate.error

    const id = new URL(request.url).searchParams.get('id')
    const target = await prisma.user.findUnique({ where: { id } })

    if (!target) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 })
    if (target.id === gate.user.id) {
      return NextResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 403 })
    }

    if (target.role === 'admin') {
      const admins = await prisma.user.count({ where: { role: 'admin' } })

      if (admins <= 1) {
        return NextResponse.json({ success: false, error: 'Cannot delete the last admin.' }, { status: 403 })
      }
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

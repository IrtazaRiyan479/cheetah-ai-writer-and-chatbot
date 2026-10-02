import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { requireAdmin } from '../_auth'
import { FREE_WORD_CAP } from '@/libs/entitlement'
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
    wordsLimit: user.wordsLimit,
    stripeCustomerId: user.stripeCustomerId || null
  }
}

function responseError(error, status = 500) {
  return NextResponse.json({ success: false, error: serializeError(error) }, { status })
}

export async function GET(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const [users, setting] = await Promise.all([
      prisma.user.findMany({ orderBy: { email: 'asc' } }),
      prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } })
    ])
    const cap = Math.max(0, Number(setting?.value ?? FREE_WORD_CAP))

    return NextResponse.json({ success: true, users: users.map(user => ({ ...publicUser(user), wordsLimit: user.wordsLimitCustomized ? user.wordsLimit : cap })) })
  } catch (error) {
    return responseError(error)
  }
}

export async function POST(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const { name, email, password, role = 'free', wordsLimit } = await request.json()

    if (!email || !password) return responseError(new Error('Email and password are required.'), 400)
    if (String(password).length < 8) return responseError(new Error('Password must be at least 8 characters.'), 400)
    if (!['free', 'pro', 'admin'].includes(role)) return responseError(new Error('Invalid role.'), 400)
    if (wordsLimit !== undefined && wordsLimit !== '' && (!Number.isInteger(Number(wordsLimit)) || Number(wordsLimit) < 0)) return responseError(new Error('Word limit must be a non-negative whole number.'), 400)

    const defaultCapSetting = await prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } })
    const defaultCap = Math.max(0, Number(defaultCapSetting?.value ?? FREE_WORD_CAP))
    const created = await prisma.user.create({
      data: {
        name: name || email,
        email,
        password: await bcrypt.hash(password, 10),
        role,
        plan: role,
        wordsLimit: Number.isInteger(Number(wordsLimit)) && wordsLimit !== '' && Number(wordsLimit) >= 0 ? Number(wordsLimit) : defaultCap,
        wordsLimitCustomized: wordsLimit !== undefined && wordsLimit !== ''
      }
    })

    return NextResponse.json({ success: true, user: publicUser(created) })
  } catch (error) {
    return responseError(error)
  }
}

export async function PATCH(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const { id, password, role, wordsLimit, name, email } = await request.json()
    const target = await prisma.user.findUnique({ where: { id } })

    if (!target) return responseError(new Error('User not found.'), 404)

    if (role !== undefined && !['free', 'pro', 'admin'].includes(role)) return responseError(new Error('Invalid role.'), 400)
    if (role && role !== 'admin' && target.role === 'admin') {
      if (target.id === gate.user.id) return responseError(new Error('You cannot remove your own admin access.'), 403)
      const admins = await prisma.user.count({ where: { role: 'admin' } })

      if (admins <= 1) return responseError(new Error('Cannot remove the last admin.'), 403)
    }
    if (target.id === gate.user.id && role && role !== 'admin') {
      return responseError(new Error('You cannot lock yourself out of the admin console.'), 403)
    }
    if (wordsLimit !== undefined && (!Number.isInteger(Number(wordsLimit)) || Number(wordsLimit) < 0)) {
      return responseError(new Error('Word limit must be a non-negative whole number.'), 400)
    }

    const data = {}

    if (password && String(password).length < 8) return responseError(new Error('Password must be at least 8 characters.'), 400)
    if (password) data.password = await bcrypt.hash(password, 10)
    if (role) {
      data.role = role
      data.plan = role
    }
    if (wordsLimit !== undefined) {
      data.wordsLimit = Number(wordsLimit)
      data.wordsLimitCustomized = true
    }
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email

    const updated = await prisma.user.update({ where: { id }, data })

    return NextResponse.json({ success: true, user: publicUser(updated) })
  } catch (error) {
    return responseError(error)
  }
}

export async function DELETE(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const id = new URL(request.url).searchParams.get('id')
    const target = await prisma.user.findUnique({ where: { id } })

    if (!target) return responseError(new Error('User not found.'), 404)
    if (target.id === gate.user.id) return responseError(new Error('You cannot delete your own account.'), 403)

    if (target.role === 'admin') {
      const admins = await prisma.user.count({ where: { role: 'admin' } })

      if (admins <= 1) return responseError(new Error('Cannot delete the last admin.'), 403)
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return responseError(error)
  }
}

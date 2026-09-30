import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { serializeError } from '@/utils/serializeError'

import { users } from './users'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    plan: user.plan
  }
}

export async function POST(req) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: ['Email and password are required'] }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({ where: { email } })

    if (dbUser?.password && (await bcrypt.compare(password, dbUser.password))) {
      return NextResponse.json(publicUser(dbUser))
    }

    const legacy = users.find(user => user.email === email && user.password === password)

    if (!legacy) {
      return NextResponse.json({ message: ['Email or Password is invalid'] }, { status: 401 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const synced = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: legacy.name,
        image: legacy.image,
        password: hashed,
        role: 'admin',
        plan: 'admin'
      }
    })

    return NextResponse.json(publicUser(synced))
  } catch (error) {
    return NextResponse.json({ message: [serializeError(error)] }, { status: 500 })
  }
}

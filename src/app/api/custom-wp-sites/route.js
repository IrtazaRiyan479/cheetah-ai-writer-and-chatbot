import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from "next-auth/next"
// Adjust the auth import based on your exact NextAuth config location

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })

    const sites = await prisma.customWPSite.findMany({
      where: { userId: user.id }
    })

    return NextResponse.json({ sites })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    const body = await request.json()
    const { name, url, username, password } = body

    if (!name || !url || !username || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const newSite = await prisma.customWPSite.create({
      data: {
        userId: user.id,
        name,
        url,
        username,
        password
      }
    })

    return NextResponse.json({ success: true, site: newSite })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to save site" }, { status: 500 })
  }
}

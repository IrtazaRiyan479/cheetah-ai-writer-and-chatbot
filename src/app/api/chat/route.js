import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { time: 'asc' }
    })
    return NextResponse.json(messages)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { senderId, message } = await request.json()
    const newMsg = await prisma.chatMessage.create({
      data: { senderId, message }
    })
    return NextResponse.json(newMsg)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await prisma.chatMessage.deleteMany({})
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 })
  }
}

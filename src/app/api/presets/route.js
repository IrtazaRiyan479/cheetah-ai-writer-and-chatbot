import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET: Fetch all presets
export async function GET() {
  try {
    const presets = await prisma.preset.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json(presets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch presets' }, { status: 500 })
  }
}

// POST: Create a new preset
export async function POST(request) {
  try {
    const { name, settings } = await request.json()
    const newPreset = await prisma.preset.create({
      data: { name, settings: JSON.stringify(settings) }
    })
    return NextResponse.json(newPreset)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create preset' }, { status: 500 })
  }
}

// PUT: Update an existing preset
export async function PUT(request) {
  try {
    const { id, settings } = await request.json()
    const updatedPreset = await prisma.preset.update({
      where: { id },
      data: { settings: JSON.stringify(settings) }
    })
    return NextResponse.json(updatedPreset)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update preset' }, { status: 500 })
  }
}

// DELETE: Remove a preset
export async function DELETE(request) {
  try {
    const { id } = await request.json()
    await prisma.preset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete preset' }, { status: 500 })
  }
}

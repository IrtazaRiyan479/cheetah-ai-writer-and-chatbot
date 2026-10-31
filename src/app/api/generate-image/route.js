import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate, getDbUser } from '@/libs/entitlement'
import { runWithPaidKeys } from '@/app/api/generate/utils/providerKeys'
import { getImageModel, normalizeAspect, normalizeStyle } from '@/configs/imageModels'
import { serializeError } from '@/utils/serializeError'

import { generateProviderImage } from './providers'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: serializeError(new Error('Sign in required.')) },
        { status: 401 }
      )
    }

    const history = await prisma.generatedImage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, images: history })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

    if (!user) {
      return NextResponse.json(
        { success: false, error: serializeError(new Error('Sign in required.')) },
        { status: 401 }
      )
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: serializeError(new Error('Admin access required.')) },
        { status: 403 }
      )
    }

    await prisma.generatedImage.deleteMany({})

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

function readReference(uploadedImage) {
  if (!uploadedImage) return null

  const value = String(uploadedImage)
  const comma = value.indexOf(',')
  const header = comma > 0 ? value.slice(0, comma) : ''
  const mimeMatch = header.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64$/i)

  if (!mimeMatch) throw new Error('Reference image must be a PNG, JPEG, or WebP file.')

  const mime = mimeMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeMatch[1].toLowerCase()
  const base64 = value.slice(comma + 1).replace(/\s/g, '')

  if (!base64) throw new Error('Reference image was empty.')

  return { mime, base64, dataUri: `data:${mime};base64,${base64}` }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)

  const gate = await assertCanGenerate({
    userId: session?.user?.id,
    email: session?.user?.email,
    featureKey: 'image-standalone',
    estimatedWords: 0
  })

  if (!gate.ok) return NextResponse.json({ success: false, error: serializeError(gate.error) }, { status: gate.status })

  let body

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, error: serializeError(new Error('Invalid image request.')) },
      { status: 400 }
    )
  }

  const selected = getImageModel(body?.model)

  if (!selected) {
    return NextResponse.json(
      { success: false, error: serializeError(new Error('Select a supported image model.')) },
      { status: 400 }
    )
  }

  let reference

  try {
    reference = readReference(body?.uploadedImage)
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 400 })
  }

  const style = normalizeStyle(body?.style)
  const aspect = normalizeAspect(body?.size)
  const lossless = Boolean(body?.lossless)
  const count = Math.min(4, Math.max(1, Number(body?.numImages) || 1))
  let instruction = String(body?.prompt || '').trim()

  if (!instruction && reference) instruction = 'Create a high-quality variation of the reference image.'
  if (!instruction) {
    return NextResponse.json(
      { success: false, error: serializeError(new Error('A prompt or an uploaded image is required.')) },
      { status: 400 }
    )
  }

  const finalPrompt = `${style} style. ${instruction}. Show only the requested subject. Do not add flowers, mountains, landscapes, abstract backgrounds, or unrelated scenes. Do not draw words or titles.`
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = payload => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

      return runWithPaidKeys(Boolean(gate.usePaidKeys), async () => {
        try {
          send({ status: 'processing', promptUsed: finalPrompt, modelUsed: selected.label, modelId: selected.id })

          const jobs = Array.from({ length: count }, async () => {
            try {
              const generated = await generateProviderImage({
                selected,
                prompt: finalPrompt,
                aspect,
                reference,
                lossless
              })

              if (!generated?.base64) throw new Error('No image was returned by the model for this request.')

              const mime = generated.mime || 'image/png'
              let finalBase64 = `data:${mime};base64,${generated.base64}`

              if (!lossless && process.env.TINYPNG_API_KEY) {
                try {
                  const tinyKey = Buffer.from(`api:${process.env.TINYPNG_API_KEY}`).toString('base64')
                  const imageBuffer = Buffer.from(generated.base64, 'base64')
                  const shrinkRes = await fetch('https://api.tinify.com/shrink', {
                    method: 'POST',
                    headers: { Authorization: `Basic ${tinyKey}`, 'Content-Type': mime },
                    body: imageBuffer
                  })
                  const shrinkData = await shrinkRes.json()

                  if (!shrinkData.error && shrinkData.output?.url) {
                    const compRes = await fetch(shrinkData.output.url)
                    const compBuffer = await compRes.arrayBuffer()
                    const compressedMime = (compRes.headers.get('content-type') || mime).split(';')[0].trim() || mime

                    finalBase64 = `data:${compressedMime};base64,${Buffer.from(compBuffer).toString('base64')}`
                  }
                } catch (compressionError) {
                  console.error(
                    'TinyPNG request failed',
                    compressionError?.status || compressionError?.statusCode || 'unknown',
                    serializeError(compressionError).slice(0, 180)
                  )
                }
              }

              const dbRecord = await prisma.generatedImage.create({
                data: {
                  userId: session.user.id,
                  image: finalBase64,
                  prompt: finalPrompt,
                  title: `Model: ${selected.label}`,
                  description: finalPrompt
                }
              })

              send({ success: true, image: dbRecord, modelId: selected.id })
            } catch (err) {
              send({ success: false, error: serializeError(err), modelId: selected.id })
            }
          })

          await Promise.all(jobs)
          send({ done: true, modelId: selected.id })
          controller.close()
        } catch (error) {
          console.error(
            'Global Generation Error',
            error?.status || error?.statusCode || 'unknown',
            serializeError(error).slice(0, 180)
          )
          send({ success: false, error: serializeError(error), modelId: selected.id })
          controller.close()
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}

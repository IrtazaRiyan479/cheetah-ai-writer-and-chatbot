import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'

import { authOptions } from '@/libs/auth'
import { assertCanGenerate, getDbUser } from '@/libs/entitlement'
import { geminiGenerateContent } from '@/app/api/generate/utils/geminiKeys'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: serializeError(new Error('Sign in required.')) }, { status: 401 })
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
      return NextResponse.json({ success: false, error: serializeError(new Error('Sign in required.')) }, { status: 401 })
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: serializeError(new Error('Admin access required.')) }, { status: 403 })
    }

    await prisma.generatedImage.deleteMany({})

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
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

  const body = await req.json()
  const { prompt, model, style, size, numImages, lossless, uploadedImage } = body

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const modelMapping = {
          'nano-banana': 'gemini-3-pro-image',
          'gpt-2-fast': 'gemini-3.1-flash-image',
          'dalle-3-pro': 'gemini-2.5-flash-image',
          'midjourney-v6': 'gemini-3-pro-image'
        }

        const displayNames = {
          'nano-banana': 'Nano Banana',
          'gpt-2-fast': 'GPT-2 Fast',
          'dalle-3-pro': 'DALL-E 3 Pro',
          'midjourney-v6': 'Midjourney V6'
        }

        const backendModel = modelMapping[model] || 'gemini-2.5-flash-image'
        let finalPrompt = prompt

        if (uploadedImage) {
          const base64Data = uploadedImage.includes(',') ? uploadedImage.split(',')[1] : uploadedImage
          const mimeType = uploadedImage.match(/data:(.*?);base64/)?.[1] || 'image/jpeg'

          const userInstructions = finalPrompt
            ? `The user's specific instructions are: "${finalPrompt}".`
            : 'Create a visually similar, high-quality variation of this image.'

          const visionPayload = {
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this image. The user wants to generate a new AI image based on it. ${userInstructions} Write a highly detailed, descriptive text prompt for an AI image generator to fulfill this request. Respond ONLY with the prompt text, nothing else.`
                  },
                  { inlineData: { mimeType, data: base64Data } }
                ]
              }
            ]
          }

          try {
            const flashData = await geminiGenerateContent({ model: 'gemini-3.1-flash-lite', body: visionPayload })
            finalPrompt = flashData.candidates?.[0]?.content?.parts?.[0]?.text || finalPrompt
          } catch {
            // Retain the user's original prompt when image analysis is unavailable.
          }
        }

        if (!finalPrompt) throw new Error('A prompt or an uploaded image is required.')
        if (lossless) finalPrompt = `${finalPrompt}, 8k resolution, ultra-crisp, uncompressed style`
        finalPrompt = `${style} style. ${finalPrompt}. Show only the requested subject. Do not add flowers, mountains, landscapes, abstract backgrounds, or unrelated scenes. Do not draw words or titles.`

        const initPayload = JSON.stringify({
          status: 'processing',
          promptUsed: finalPrompt,
          modelUsed: displayNames[model]
        })

        controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`))

        const requestBody = {
          contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
          generationConfig: { imageConfig: { aspectRatio: size } }
        }

        const fetchPromises = Array.from({ length: Number(numImages) || 1 }).map(async () => {
          try {
            const data = await geminiGenerateContent({ model: backendModel, body: requestBody })

            let originalBase64 = null

            data.candidates?.forEach(candidate => {
              candidate.content?.parts?.forEach(part => {
                if (part.inlineData?.data) originalBase64 = part.inlineData.data
                else if (part.inline_data?.data) originalBase64 = part.inline_data.data
              })
            })

            if (!originalBase64) throw new Error('No image was returned by the model for this request.')

            let finalBase64 = `data:image/png;base64,${originalBase64}`

            if (!lossless) {
              try {
                const tinyKey = Buffer.from(`api:${process.env.TINYPNG_API_KEY}`).toString('base64')
                const imageBuffer = Buffer.from(originalBase64, 'base64')

                const shrinkRes = await fetch('https://api.tinify.com/shrink', {
                  method: 'POST',
                  headers: { Authorization: `Basic ${tinyKey}`, 'Content-Type': 'image/png' },
                  body: imageBuffer
                })

                const shrinkData = await shrinkRes.json()

                if (!shrinkData.error) {
                  const compRes = await fetch(shrinkData.output.url)
                  const compBuffer = await compRes.arrayBuffer()

                  finalBase64 = `data:image/png;base64,${Buffer.from(compBuffer).toString('base64')}`
                }
              } catch (compressionError) {
                console.error('TinyPNG request failed', compressionError?.status || compressionError?.statusCode || 'unknown', serializeError(compressionError).slice(0, 180))
              }
            }

            const dbRecord = await prisma.generatedImage.create({
              data: {
                userId: session.user.id,
                image: finalBase64,
                prompt: finalPrompt,
                title: `Model: ${displayNames[model]}`,
                description: finalPrompt
              }
            })

            const successPayload = JSON.stringify({ success: true, image: dbRecord })

            controller.enqueue(encoder.encode(`data: ${successPayload}\n\n`))
          } catch (err) {
            const errorPayload = JSON.stringify({ success: false, error: serializeError(err) })

            controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`))
          }
        })

        await Promise.all(fetchPromises)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (error) {
        console.error('Global Generation Error', error?.status || error?.statusCode || 'unknown', serializeError(error).slice(0, 180))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ success: false, error: serializeError(error) })}\n\n`))
        controller.close()
      }
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

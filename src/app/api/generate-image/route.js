import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET() {
  try {
    const history = await prisma.generatedImage.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, images: history })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await prisma.generatedImage.deleteMany({})

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req) {
  const body = await req.json()
  const { prompt, model, style, size, numImages, lossless, uploadedImage } = body

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const GEMINI_API_KEY = process.env.GEMINI_FREE_API_KEY

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

          const flashRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_FREE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(visionPayload)
            }
          )

          if (flashRes.ok) {
            const flashData = await flashRes.json()

            finalPrompt = flashData.candidates?.[0]?.content?.parts?.[0]?.text || finalPrompt
          }
        }

        if (!finalPrompt) throw new Error('A prompt or an uploaded image is required.')
        if (lossless) finalPrompt = `${finalPrompt}, 8k resolution, ultra-crisp, uncompressed style`
        finalPrompt = `${style} style. ${finalPrompt}`

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
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${backendModel}:generateContent?key=${GEMINI_FREE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              }
            )

            const data = await res.json()

            if (!res.ok) throw new Error(data.error?.message || 'Error from Gemini API')

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
                console.error('TinyPNG Error, falling back to original:', compressionError)
              }
            }

            const dbRecord = await prisma.generatedImage.create({
              data: {
                image: finalBase64,
                prompt: finalPrompt,
                title: `Model: ${displayNames[model]}`,
                description: finalPrompt
              }
            })

            const successPayload = JSON.stringify({ success: true, image: dbRecord })

            controller.enqueue(encoder.encode(`data: ${successPayload}\n\n`))
          } catch (err) {
            const errorPayload = JSON.stringify({ success: false, error: err.message })

            controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`))
          }
        })

        await Promise.all(fetchPromises)

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (error) {
        console.error('Global Generation Error:', error)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`))
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

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export async function GET() {
  try {
    const history = await prisma.generatedImage.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, images: history });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.generatedImage.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { prompt, model, style, size, numImages, lossless, uploadedImage } = await req.json();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

   const modelMapping = {
      'nano-banana': 'imagen-4.0-generate-001',
      'gpt-2-fast': 'imagen-4.0-fast-generate-001',
      'dalle-3-pro': 'imagen-4.0-ultra-generate-001',
      'midjourney-v6': 'imagen-4.0-ultra-generate-001'
    };

    const backendModel = modelMapping[model] || 'imagen-4.0-generate-001';

    // 1. Process Frontend Toggles into Prompt Engineering
    let finalPrompt = prompt;

    if (uploadedImage) {
      const base64Data = uploadedImage.includes(',') ? uploadedImage.split(',')[1] : uploadedImage;
      const mimeType = uploadedImage.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';

      const userInstructions = finalPrompt
        ? `The user's specific instructions are: "${finalPrompt}".`
        : 'Create a visually similar, high-quality variation of this image.';

      const visionPayload = {
        contents: [{
          parts: [
            { text: `Analyze this image. The user wants to generate a new AI image based on it. ${userInstructions} Write a highly detailed, descriptive text prompt for an AI image generator to fulfill this request. Respond ONLY with the prompt text, nothing else.` },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }]
      };

      const flashRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visionPayload)
      });

      if (flashRes.ok) {
        const flashData = await flashRes.json();
        finalPrompt = flashData.candidates?.[0]?.content?.parts?.[0]?.text || finalPrompt;
      }
    }

    if (!finalPrompt) throw new Error("A prompt or an uploaded image is required.");

    if (lossless) {
      finalPrompt = `${finalPrompt}, 8k resolution, ultra-crisp, uncompressed style`;
    }

    finalPrompt = `${style} style. ${finalPrompt}`;

    const requestBody = {
      instances: [{ prompt: finalPrompt }],
      parameters: {
        sampleCount: Number(numImages) || 1,
        aspectRatio: size
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${backendModel}:predict?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error from Gemini API');
    }

    const data = await response.json();

    const savedImages = await Promise.all(data.predictions?.map(async (p) => {
      const originalBase64 = p.bytesBase64Encoded;
      let finalBase64 = `data:image/png;base64,${originalBase64}`;

      if (!lossless) {
        try {
          const tinyKey = Buffer.from(`api:${process.env.TINYPNG_API_KEY}`).toString('base64');
          const imageBuffer = Buffer.from(originalBase64, 'base64');

          const shrinkRes = await fetch('https://api.tinify.com/shrink', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${tinyKey}`, 'Content-Type': 'image/png' },
            body: imageBuffer
          });

          const shrinkData = await shrinkRes.json();
          if (!shrinkData.error) {
            const compRes = await fetch(shrinkData.output.url);
            const compBuffer = await compRes.arrayBuffer();
            finalBase64 = `data:image/png;base64,${Buffer.from(compBuffer).toString('base64')}`;
          }
        } catch (compressionError) {
          console.error("TinyPNG Error, falling back to original:", compressionError);
        }
      }

      const dbRecord = await prisma.generatedImage.create({
        data: {
          image: finalBase64,
          prompt: finalPrompt,
          title: `Model: ${backendModel}`,
          description: finalPrompt
        }
      });

      return dbRecord;
    }) || []);

    return NextResponse.json({ success: true, images: savedImages, modelUsed: backendModel, promptUsed: finalPrompt });

  } catch (error) {
    console.error('Image Generation Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

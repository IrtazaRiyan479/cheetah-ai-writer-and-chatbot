import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { prompt, model, style, size, numberOfImages, enhancePrompt, lossless } = await req.json();

    const modelMapping = {
      'nano-banana': 'imagen-3.0-generate-001',
      'gpt-2-fast': 'imagen-3.0-fast-generate-001',
      'dalle-3-pro': 'imagen-3.0-generate-001',
      'midjourney-v6': 'imagen-3.0-generate-001'
    };

    const backendModel = modelMapping[model] || 'imagen-3.0-generate-001';

    // 1. Process Frontend Toggles into Prompt Engineering
    let finalPrompt = prompt;

    if (enhancePrompt) {
      finalPrompt = `Masterpiece, award-winning, highly detailed, visually stunning, ${finalPrompt}`;
    }

    if (lossless) {
      finalPrompt = `${finalPrompt}, 8k resolution, ultra-crisp, uncompressed style`;
    }

    finalPrompt = `${style} style. ${finalPrompt}`;

    // 2. Format Payload
    const requestBody = {
      instances: [{ prompt: finalPrompt }],
      parameters: {
        sampleCount: Number(numberOfImages) || 1,
        aspectRatio: size // Handled perfectly via frontend sizing strings like "16:9" or "1:1"
      }
    };

    // 3. Make API Call
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing from environment variables.');
    }

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

    // 4. Return valid base64 image streams
    const images = data.predictions?.map(p => `data:image/png;base64,${p.bytesBase64Encoded}`) || [];

    return NextResponse.json({ success: true, images, modelUsed: backendModel });

  } catch (error) {
    console.error('Image Generation Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

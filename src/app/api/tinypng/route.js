import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 payload is required' }, { status: 400 });
    }

    const credentials = Buffer.from(`api:${process.env.TINYPNG_API_KEY}`).toString('base64');

    // Strip "data:image/png;base64," if it exists so we just have raw base64 string
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    const response = await fetch('https://api.tinify.com/shrink', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'image/png' // Tell TinyPNG we are sending binary image data
      },
      body: buffer
    });

    const data = await response.json();

    if (!response.ok) {
       throw new Error(data.message || 'Compression failed');
    }

    return NextResponse.json({ success: true, compressedUrl: data.output.url });

  } catch (error) {
    console.error('TinyPNG Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to compress image' }, { status: 500 });
  }
}

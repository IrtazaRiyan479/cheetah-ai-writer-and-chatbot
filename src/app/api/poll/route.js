import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const interaction = await ai.interactions.get(id);

    if (interaction.status === "completed") {
      return NextResponse.json({ status: "completed", text: interaction.output_text });
    } else if (interaction.status === "failed") {
      return NextResponse.json({ status: "failed", error: "Deep search failed." });
    }

    // If it is still 'in_progress' or 'processing', just return processing
    return NextResponse.json({ status: "processing" });

  } catch (error) {
    console.error("Polling Error:", error);
    return NextResponse.json({ status: "failed", error: error.message });
  }
}

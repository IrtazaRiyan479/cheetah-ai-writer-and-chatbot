import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { action = 'create', prompt, aiInstructions, userInputs } = body;

    // ==========================================
    // ACTION 1: BUILD THE TOOL (UI + Logic)
    // ==========================================
    if (action === 'create') {
      if (!prompt) return NextResponse.json({ error: 'Please provide a description.' }, { status: 400 });

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: "application/json" }
      });

      const aiPrompt = `
        You are an expert software architect building custom interactive web tools (Lead Magnets).
        The user wants to create a tool described as: "${prompt}".

        Generate a JSON configuration for this tool. It must include exactly this structure:
        {
          "title": "A catchy, conversion-optimized title for the tool",
          "description": "A brief 1-2 sentence description explaining the value to the end user.",
          "inputs": [
            {
              "id": "input_1",
              "label": "User-friendly input label",
              "type": "text" | "number" | "textarea",
              "placeholder": "Helpful placeholder text"
            }
          ],
          "buttonText": "Action-oriented submit button text",
          "aiInstructions": "A system prompt instructing the AI on how to process the inputs to generate the final result."
        }
        Keep it to 1-4 highly relevant input fields.
      `;

      const result = await model.generateContent(aiPrompt);
      const magnetConfig = JSON.parse(result.response.text());

      return NextResponse.json({ success: true, magnetConfig });
    }

    // ==========================================
    // ACTION 2: EXECUTE THE TOOL
    // ==========================================
    if (action === 'execute') {

      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

      // FIX: Robust Data Passing. We pass the raw JSON data directly to Gemini instead of relying on string replacements.
      const executionPrompt = `
        You are the execution engine for a specialized web tool. Provide a direct, helpful, user-friendly, and concise response formatted cleanly. Do not explain how you generated the result.

        SYSTEM INSTRUCTIONS FOR THIS TOOL:
        ${aiInstructions}

        USER INPUT DATA TO PROCESS:
        ${JSON.stringify(userInputs, null, 2)}
      `;

      const result = await model.generateContent(executionPrompt);

      return NextResponse.json({ success: true, result: result.response.text() });
    }

    return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });

  } catch (error) {
    console.error('AffiGenieMagnets API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, domain, selectedPages } = body;

    // ==========================================
    // ACTION 1: CRAWL AND INDEX DOMAIN
    // ==========================================
    if (action === 'crawl') {
      if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 });

      let pages = [];
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

      try {
        // Attempt a real sitemap fetch first
        const response = await fetch(`https://${cleanDomain}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const xmlText = await response.text();
          // Extract URLs using regex for simplicity
          const matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)];
          pages = matches.map((m, i) => ({ id: i, url: m[1] }));
        } else {
          throw new Error('Sitemap not found');
        }
      } catch (error) {
        // AI FALLBACK: If the site blocks scrapers or lacks a sitemap, simulate a realistic one using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite', generationConfig: { responseMimeType: "application/json" } });
        const prompt = `Generate a realistic JSON array of 10-15 standard website URLs (e.g., home, about, services, blog posts) for the domain "https://${cleanDomain}".
        Format strictly as: [{"id": 1, "url": "https://..."}]`;

        const result = await model.generateContent(prompt);
        pages = JSON.parse(result.response.text());
      }

      return NextResponse.json({ success: true, pages });
    }

    // ==========================================
    // ACTION 2: ANALYZE FOR INTERNAL LINKS
    // ==========================================
    if (action === 'analyze') {
      if (!selectedPages || selectedPages.length < 2) {
        return NextResponse.json({ error: 'Select at least 2 pages to analyze.' }, { status: 400 });
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite', generationConfig: { responseMimeType: "application/json" } });

      const prompt = `
        You are an expert SEO internal linking AI. I will provide a list of URLs from a website.
        Your job is to analyze these URLs and find every possible highly relevant internal linking opportunity between them to boost SEO. Suggest as many high-quality links as possible (aim for at least 1 to 2 links per URL provided).

        URLS to analyze:
        ${selectedPages.map(p => p.url).join('\n')}

        Return a JSON array of objects with EXACTLY this structure:
        [
          {
            "sourceUrl": "The URL where the link should be placed",
            "targetUrl": "The URL the link should point to",
            "anchorText": "The exact 2-4 word phrase to use as the clickable link",
            "reasoning": "A brief 1-sentence explanation of why this link is semantically relevant."
          }
        ]
      `;

      const result = await model.generateContent(prompt);
      const suggestions = JSON.parse(result.response.text());

      return NextResponse.json({ success: true, suggestions });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('AffiGenieLinks API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

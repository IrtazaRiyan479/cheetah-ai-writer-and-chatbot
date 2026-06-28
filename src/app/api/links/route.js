import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, domain, selectedPages } = body;

    if (action === 'crawl') {
      if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 });

      let cleanDomain = String(domain || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

      if (!cleanDomain.startsWith('www.')) {
        cleanDomain = `www.${cleanDomain}`;
      }

      const sitemapPaths = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml'];
      let extractedUrls = [];
      let sitemapFound = false;

      for (const path of sitemapPaths) {
        try {
          const response = await fetch(`https://${cleanDomain}${path}`, { headers: browserHeaders, signal: AbortSignal.timeout(6000) });
          if (response.ok) {
            sitemapFound = true;
            const xmlText = await response.text();
            let matches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)];
            extractedUrls = matches.map(m => m[1]);

            const isSitemapIndex = extractedUrls.some(url => url.endsWith('.xml'));
            if (isSitemapIndex) {
              const subSitemaps = extractedUrls.filter(url => url.includes('post-sitemap') || url.includes('page-sitemap') || url.includes('wp-sitemap-posts'));
              extractedUrls = [];

              for (const subMap of subSitemaps) {
                const subResponse = await fetch(subMap, { headers: browserHeaders, signal: AbortSignal.timeout(6000) });
                if (subResponse.ok) {
                  const subXmlText = await subResponse.text();
                  const subMatches = [...subXmlText.matchAll(/<loc>(.*?)<\/loc>/g)];
                  extractedUrls.push(...subMatches.map(m => m[1]));
                }
              }
            }
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!sitemapFound || extractedUrls.length === 0) {
         return NextResponse.json({ success: false, error: 'No standard XML sitemap found.' }, { status: 404 });
      }

      extractedUrls = extractedUrls.filter(url => {
        if (!url) return false;
        const path = new URL(url).pathname;
        return path.length > 1 && !url.endsWith('.xml') && !url.includes('/wp-content/uploads/');
      });

      extractedUrls = [...new Set(extractedUrls)];

      const checkLiveness = async (url) => {
        try {
          const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
          return res.ok ? url : null;
        } catch (e) {
          return null;
        }
      };

      const liveUrls = (await Promise.all(extractedUrls.map(checkLiveness))).filter(Boolean);
      const pages = liveUrls.map((url, i) => ({ id: i, url }));

      return NextResponse.json({ success: true, pages });
    }

    if (action === 'analyze') {
      if (!selectedPages || selectedPages.length === 0) {
        return NextResponse.json({ error: 'No pages provided.' }, { status: 400 });
      }

      const pagesWithContent = [];

      for (const page of selectedPages) {
        try {
          await new Promise(resolve => setTimeout(resolve, 250));

          const res = await fetch(page.url, {
            headers: browserHeaders,
            signal: AbortSignal.timeout(8000)
          });

          if (!res.ok) {
            pagesWithContent.push({ url: page.url, content: "" });
            continue;
          }

          const html = await res.text();
          const $ = cheerio.load(html);
          let textContent = '';
          $('p, h2, h3, li').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 20) textContent += text + '\n';
          });

          pagesWithContent.push({ url: page.url, content: textContent.substring(0, 6000).trim() });
        } catch (e) {
          pagesWithContent.push({ url: page.url, content: "" });
        }
      }

      const validPages = pagesWithContent.filter(p => p.content.length > 50);
      if (validPages.length === 0) {
        return NextResponse.json({ error: 'Could not extract text.' }, { status: 400 });
      }

      const allTargetUrlsString = selectedPages.map(p => p.url).join('\n');
      const BATCH_SIZE = 5;

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < validPages.length; i += BATCH_SIZE) {
              const batch = validPages.slice(i, i + BATCH_SIZE);
              const expectedMinLinks = batch.length * 2;
              const expectedMaxLinks = batch.length * 4;

        const prompt = `
        You are a strict data-extraction script operating on right-or-wrong logic.
        Your task is to analyze the provided batch of ${batch.length} source pages and find exact substrings within their "PAGE CONTENT" that can link to any URL in the global "ALLOWED TARGET URLS" list.

        CRITICAL RULES:
        1. EXACT TEXT MATCHING: The "anchorText" you select MUST physically exist exactly as written in the provided "PAGE CONTENT" for that specific Source URL. Do not change casing or alter words.
        2. ZERO HALLUCINATION: You MUST ONLY link to URLs explicitly listed in the global "ALLOWED TARGET URLS" list.
        3. NO SELF-LINKING: Do not link a Source URL to itself.
        4. MANDATORY VOLUME QUOTA: For this batch of ${batch.length} source pages, you MUST find and return between ${expectedMinLinks} and ${expectedMaxLinks} highly contextual internal linking suggestions. Thoroughly extract multiple link opportunities per page.

        ALLOWED TARGET URLS (GLOBAL LIST):
        ${allTargetUrlsString}

        BATCH PAGES TO ANALYZE (${batch.length} Pages):
        ${batch.map(p => `--- SOURCE URL: ${p.url} ---\nPAGE CONTENT:\n${p.content}\n`).join('\n\n')}

        Return a JSON array of objects with EXACTLY this structure:
        [
          {
            "sourceUrl": "The exact URL from the batch where the text was found",
            "targetUrl": "The exact URL from the allowed list the text should point to",
            "anchorText": "The EXACT case-sensitive 2-4 word phrase extracted physically from the page content",
            "reasoning": "A brief 1-sentence explanation of why this link makes sense."
          }
        ]
        `;

        const result = await model.generateContent(prompt);
              let rawText = String(result.response?.text() || '[]');
              rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

              const batchSuggestions = JSON.parse(rawText);

              if (Array.isArray(batchSuggestions) && batchSuggestions.length > 0) {
                const chunkData = JSON.stringify({ type: 'chunk', data: batchSuggestions }) + '\n';
                controller.enqueue(encoder.encode(chunkData));
              }
            }
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
            controller.close();
          } catch (error) {
            console.error('Stream processing error:', error);
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n'));
            controller.close();
          }
        }
      });

      // 3. Return the stream response
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

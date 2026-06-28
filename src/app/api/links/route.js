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

      // Extract URLs from sitemap
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

      // Filter invalid URLs
      extractedUrls = extractedUrls.filter(url => {
        if (!url) return false;
        const path = new URL(url).pathname;
        return path.length > 1 && !url.endsWith('.xml') && !url.includes('/wp-content/uploads/');
      });
      extractedUrls = [...new Set(extractedUrls)];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const checkLiveness = async (url) => {
              try {
                // Included browserHeaders to prevent 403s on HEAD requests
                const res = await fetch(url, { method: 'HEAD', headers: browserHeaders, signal: AbortSignal.timeout(4000) });
                return res.ok ? url : null;
              } catch (e) {
                return null;
              }
            };

            const BATCH_SIZE = 15;
            let globalPageIndex = 0;

            for (let i = 0; i < extractedUrls.length; i += BATCH_SIZE) {
              if (req.signal.aborted) {
                console.log('Crawl aborted by client.');
                break;
              }

              const batchUrls = extractedUrls.slice(i, i + BATCH_SIZE);

              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }

              const liveUrls = (await Promise.all(batchUrls.map(checkLiveness))).filter(Boolean);

              if (req.signal.aborted) {
                break;
              }

              if (liveUrls.length > 0) {
                const batchPages = liveUrls.map(url => ({ id: globalPageIndex++, url }));
                const chunkData = JSON.stringify({ type: 'chunk', data: batchPages }) + '\n';

                try {
                  controller.enqueue(encoder.encode(chunkData));
                } catch (enqueueError) {
                  console.warn('Stream closed mid-enqueue. Stopping loop.');
                  break;
                }
              }
            }

            if (!req.signal.aborted) {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                controller.close();
              } catch (e) {
              }
            }
          } catch (error) {
            console.error('Crawl stream processing error:', error);
            if (!req.signal.aborted) {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n'));
                controller.close();
              } catch (e) {}
            }
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
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

      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite',
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 }
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const BATCH_SIZE = 5;

            const allUrlsList = selectedPages.map(p => `- ${p.url}`).join('\n');

            for (let i = 0; i < selectedPages.length; i += BATCH_SIZE) {
              if (req.signal.aborted) {
                console.log('Analyze aborted by client.');
                break;
              }

              const batch = selectedPages.slice(i, i + BATCH_SIZE);
              const sourceUrlsList = batch.map(p => `- ${p.url}`).join('\n');

              const prompt = `
              You are an SEO expert specializing in internal linking.

              Here is the FULL pool of available target URLs on my website:
              ${allUrlsList}

              Your task is to generate internal links ONLY FOR these specific SOURCE URLs:
              ${sourceUrlsList}

              For EACH of the Source URLs, find 1-2 relevant Target URLs from the full pool.
              Do not link a page to itself.
              Create contextually relevant anchor text.

              Output strictly as a valid JSON array of objects with the following keys:
              [
                {
                  "sourceUrl": "The URL from the Source list",
                  "targetUrl": "The URL from the Full pool",
                  "anchorText": "2-4 word phrase",
                  "reasoning": "A brief 1-sentence explanation of why this link makes sense."
                }
              ]
              `;

              const result = await model.generateContent(prompt);

              if (req.signal.aborted) break;

              let rawText = String(result.response?.text() || '[]');
              rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

              try {
                const batchSuggestions = JSON.parse(rawText);

                if (Array.isArray(batchSuggestions) && batchSuggestions.length > 0) {
                  const chunkData = JSON.stringify({ type: 'chunk', data: batchSuggestions }) + '\n';
                  controller.enqueue(encoder.encode(chunkData));
                }
              } catch (parseError) {
                console.warn('Skipping batch due to JSON parse error from LLM');
              }
            }

            if (!req.signal.aborted) {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                controller.close();
              } catch (e) {}
            }
          } catch (error) {
            console.error('Analyze stream processing error:', error);
            if (!req.signal.aborted) {
              try {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n'));
                controller.close();
              } catch (e) {}
            }
          }
        }
      });

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

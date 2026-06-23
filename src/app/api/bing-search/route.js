import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { query } = await request.json();

        // DataForSEO requires base64 encoded Basic Auth credentials
        const credentials = Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');

        // Payload for a live Bing organic search
        const postData = [{
            "keyword": query,
            "language_code": "en",
            "location_code": 2840 // Location code for the United States
        }];

        const response = await fetch("https://api.dataforseo.com/v3/serp/bing/organic/live/advanced", {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            throw new Error(`DataForSEO HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // Extract the search results from DataForSEO's nested response structure
        const results = data.tasks?.[0]?.result?.[0]?.items || [];

        // Map to a clean, predictable array of objects
        const cleanResults = results.map(item => ({
            title: item.title,
            url: item.url,
            snippet: item.description
        }));

        return NextResponse.json({ results: cleanResults });

    } catch (error) {
        console.error("Search API Error:", error);
        return NextResponse.json({ error: "Failed to fetch search data" }, { status: 500 });
    }
}

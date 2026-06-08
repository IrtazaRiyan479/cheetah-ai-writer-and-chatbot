import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { keyword, domain, partnerTag } = await request.json();

    // ---------------------------------------------------------
    // 1. Get OAuth 2.0 Access Token from Creators API
    // ---------------------------------------------------------
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: 'amzn1.application-oa2-client.becc27b1cae54ec6b6950c8ea1101b8b',
        client_secret: 'amzn1.oa2-cs.v1.6003e9bc35967b3e96fcc2a3ac969c16cfb8b7cd5fdec07de734bbc89f6ff12c',
        scope: 'creatorsapi::default'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return NextResponse.json({
        error: 'Authentication Failed',
        details: tokenData
      }, { status: tokenRes.status });
    }

    const accessToken = tokenData.access_token;

    // ---------------------------------------------------------
    // 2. Fetch Products using the Access Token
    // ---------------------------------------------------------
    const searchRes = await fetch('https://creatorsapi.amazon/catalog/v1/searchItems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-marketplace': domain || 'www.amazon.com',
      },
      body: JSON.stringify({
        keywords: keyword || 'running shoes',
        partnerTag: partnerTag || 'babiescarrier-20',
        partnerType: 'Associates',

        resources: [
          'images.primary.large',
          'itemInfo.title',
          'offersV2.listings.price'
        ]
      })
    });

    const searchData = await searchRes.json();

    if (!searchRes.ok) {
       return NextResponse.json({
         error: 'SearchItems Failed',
         details: searchData
       }, { status: searchRes.status });
    }

    return NextResponse.json({ success: true, data: searchData });

  } catch (error) {
    console.error('Amazon API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

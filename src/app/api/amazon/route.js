import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { keyword, domain } = await request.json();

    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET,
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

    const searchRes = await fetch('https://creatorsapi.amazon/catalog/v1/searchItems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-marketplace': domain || 'www.amazon.com',
      },
      body: JSON.stringify({
        keywords: keyword || 'running shoes',
        partnerTag: process.env.AMAZON_PARTNER_TAG,
        partnerType: 'Associates',
        resources: [
          'browseNodeInfo.websiteSalesRank',
          'images.primary.large',
          'itemInfo.byLineInfo',
          'itemInfo.contentRating',
          'itemInfo.features',
          'itemInfo.title',
          'offersV2.listings.availability',
          'offersV2.listings.merchantInfo',
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

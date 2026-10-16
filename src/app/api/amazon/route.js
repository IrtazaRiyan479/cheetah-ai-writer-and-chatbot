import { NextResponse } from 'next/server';

const AMAZON_RESOURCES = [
  'browseNodeInfo.websiteSalesRank',
  'images.primary.large',
  'itemInfo.byLineInfo',
  'itemInfo.contentRating',
  'itemInfo.features',
  'itemInfo.title',
  'offersV2.listings.availability',
  'offersV2.listings.merchantInfo',
  'offersV2.listings.price'
];

function readItems(payload) {
  const items = payload?.itemResults?.items || payload?.itemsResult?.items || payload?.searchResult?.items || payload?.items;

  return Array.isArray(items) ? items : [];
}

export async function POST(request) {
  try {
    const { keyword, domain, asins } = await request.json();

    let safeDomain = domain || 'www.amazon.com';
    if (!safeDomain.startsWith('www.')) {
      safeDomain = `www.${safeDomain}`;
    }

    const itemIds = Array.isArray(asins)
      ? [...new Set(asins.map(id => String(id || '').trim().toUpperCase()).filter(id => /^[A-Z0-9]{10}$/.test(id)))].slice(0, 10)
      : [];

    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
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
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
      'x-marketplace': safeDomain || 'www.amazon.com'
    };

    if (itemIds.length) {
      const requestItems = resources =>
        fetch('https://creatorsapi.amazon/catalog/v1/getItems', {
          method: 'POST',
          signal: AbortSignal.timeout(25000),
          headers,
          body: JSON.stringify({
            itemIds,
            itemIdType: 'ASIN',
            marketplace: safeDomain || 'www.amazon.com',
            partnerTag: process.env.AMAZON_PARTNER_TAG,
            resources
          })
        })

      let getRes = await requestItems([...AMAZON_RESOURCES, 'images.variants.large'])
      let getData = await getRes.json()

      if (!getRes.ok) {
        getRes = await requestItems(AMAZON_RESOURCES)
        getData = await getRes.json()
      }

      if (!getRes.ok) {
        return NextResponse.json({
          error: 'GetItems Failed',
          details: getData
        }, { status: getRes.status });
      }

      const items = readItems(getData);

      return NextResponse.json({
        success: true,
        data: { ...getData, searchResult: { items } }
      });
    }

    const searchRes = await fetch('https://creatorsapi.amazon/catalog/v1/searchItems', {
      method: 'POST',
      signal: AbortSignal.timeout(25000),
      headers,
      body: JSON.stringify({
        keywords: keyword || 'running shoes',
        partnerTag: process.env.AMAZON_PARTNER_TAG,
        partnerType: 'Associates',
        resources: AMAZON_RESOURCES
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
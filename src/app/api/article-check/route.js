import { NextResponse } from 'next/server';
import { fetchArticleData, fetchRawArticleHtml } from '../generate/utils/helpers';
import { detectSourceArticleType } from '../generate/services/rewrite';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ success: false, error: 'Invalid URL format' }, { status: 400 });
    }

    const [data, rawHtml] = await Promise.all([fetchArticleData(url), fetchRawArticleHtml(url)]);

    if (data.success && data.text && data.text.trim().length > 100) {
      return NextResponse.json({
        success: true,
        title: data.title || 'Article extracted successfully',
        detectedType: detectSourceArticleType(`${rawHtml}\n${data.text || ''}`)
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to extract meaningful text from this URL. It may be protected.'
      });
    }
  } catch (error) {
    console.error('Article Validation Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to validate URL' }, { status: 500 });
  }
}
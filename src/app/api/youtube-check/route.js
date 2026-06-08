import { NextResponse } from 'next/server';
import { fetchYoutubeVideoData } from '../generate/utils/helpers';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ success: false, error: 'No URL provided' }, { status: 400 });

    const data = await fetchYoutubeVideoData(url);
    if (!data.success) {
      return NextResponse.json({ success: false, error: 'Could not fetch captions. Video might be private or missing subtitles.' });
    }

    return NextResponse.json({
      success: true,
      title: data.title,
      message: 'Video and captions successfully linked!'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to validate URL.' }, { status: 500 });
  }
}

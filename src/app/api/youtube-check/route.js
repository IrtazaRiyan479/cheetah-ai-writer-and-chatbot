import { NextResponse } from 'next/server'

import { fetchYoutubeVideoData } from '../generate/utils/youtubeCaptions'

export const maxDuration = 60

export async function POST(request) {
  try {
    const { url } = await request.json()

    if (!url || !String(url).trim()) {
      return NextResponse.json({ success: false, valid: false, error: 'No URL provided' }, { status: 400 })
    }

    const data = await fetchYoutubeVideoData(url)

    if (!data.success) {
      return NextResponse.json({
        success: false,
        valid: Boolean(data.valid),
        error: data.error || 'Could not fetch captions.',
        title: data.title || '',
        thumbnail: data.thumbnail || '',
        videoId: data.videoId || '',
        durationSeconds: data.durationSeconds || 0,
        durationLabel: data.durationLabel || '',
        source: data.source || ''
      })
    }

    return NextResponse.json({
      success: true,
      valid: true,
      title: data.title,
      thumbnail: data.thumbnail || '',
      videoId: data.videoId || '',
      durationSeconds: data.durationSeconds || 0,
      durationLabel: data.durationLabel || '',
      wordCount: data.wordCount || 0,
      transcript: data.transcript,
      source: data.source || '',
      message: 'Video and captions successfully linked!'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, valid: false, error: 'Failed to validate URL.' },
      { status: 500 }
    )
  }
}

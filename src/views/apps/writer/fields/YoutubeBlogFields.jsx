import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'
import { extractVideoId } from '@/utils/youtubeId'

import { FlagSwitch } from '../FeatureAccessContext'
import GatedSelect, { InternalLinkFields } from '../GatedSelect'

const YoutubeBlogFields = ({ settings, updateSetting }) => {
  const [statusText, setStatusText] = useState('')
  const [statusColor, setStatusColor] = useState('text-textSecondary')
  const [isValidating, setIsValidating] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    const url = settings.youtubeUrl
    const videoId = extractVideoId(url)

    if (!videoId) {
      setStatusText(url && /youtu/i.test(url) ? 'Paste a full YouTube video URL.' : '')
      setStatusColor('text-textSecondary')
      setIsValidating(false)

      return
    }

    const requestId = ++requestRef.current

    const validateUrl = async () => {
      setIsValidating(true)
      setStatusText('Checking the video and captions...')
      setStatusColor('text-textSecondary')

      try {
        const res = await fetch('/api/youtube-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
        const data = await res.json()

        if (requestId !== requestRef.current) return

        if (data.success) {
          const words = Number(data.wordCount) || 0
          const length = data.durationLabel ? `${data.durationLabel} · ` : ''

          setStatusText(
            `✓ Linked to "${data.title}" · ${length}${words.toLocaleString()} caption words. Directly Rewrite Captions turns those spoken lines into the article. They are not shown in a separate box.`
          )
          setStatusColor('text-success')
          updateSetting('targetKeyword', data.title || '')
          updateSetting('fetchedTranscript', data.transcript || '')
          updateSetting('fetchedVideoTitle', data.title || '')
          updateSetting('youtubeDurationSeconds', data.durationSeconds || 0)
          updateSetting('youtubeThumbnail', data.thumbnail || '')
          updateSetting('youtubeVideoId', data.videoId || videoId)
        } else if (data.valid) {
          setStatusText(`! ${data.error || 'This URL is valid, but captions could not be read. Try again.'}`)
          setStatusColor('text-warning')
          if (data.title) {
            updateSetting('targetKeyword', data.title)
            updateSetting('fetchedVideoTitle', data.title)
          }
          updateSetting('fetchedTranscript', '')
          updateSetting('youtubeDurationSeconds', data.durationSeconds || 0)
          updateSetting('youtubeThumbnail', data.thumbnail || '')
          updateSetting('youtubeVideoId', data.videoId || videoId)
        } else {
          setStatusText(`✕ ${data.error || 'Could not validate this YouTube URL.'}`)
          setStatusColor('text-error')
          updateSetting('fetchedTranscript', '')
          updateSetting('youtubeThumbnail', '')
          updateSetting('youtubeDurationSeconds', 0)
          updateSetting('youtubeVideoId', '')
        }
      } catch (error) {
        if (requestId !== requestRef.current) return

        setStatusText('✕ Error connecting to validation server.')
        setStatusColor('text-error')
      } finally {
        if (requestId === requestRef.current) setIsValidating(false)
      }
    }

    const timeoutId = setTimeout(validateUrl, 600)

    return () => clearTimeout(timeoutId)
  }, [settings.youtubeUrl])

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          YouTube URL
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://youtube.com/watch?v=...'
          value={settings.youtubeUrl}
          onChange={e => updateSetting('youtubeUrl', e.target.value)}
          error={statusColor === 'text-error'}
        />
        <div className='mt-2 flex items-center gap-2 min-h-[24px]'>
          {isValidating && <CircularProgress size={14} color='inherit' />}
          <Typography variant='caption' className={`font-medium ${statusColor}`}>
            {statusText}
          </Typography>
        </div>
        {settings.youtubeThumbnail ? (
          <img
            src={settings.youtubeThumbnail}
            alt={settings.fetchedVideoTitle || 'YouTube video'}
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, marginTop: 12 }}
          />
        ) : null}
      </Grid>

      <Grid size={{ xs: 12 }}>
        <div className='flex flex-col'>
          <FlagSwitch
            featureKey='enable-caption-rewriting'
            checked={settings.enableCaptionRewriting}
            onChange={value => updateSetting('enableCaptionRewriting', value)}
            label='Directly Rewrite Captions'
          />
          <Typography variant='caption' className='text-textSecondary ml-10 -mt-2'>
            On: the article is the rewritten captions, in video order, about as long as the video. Off: the article is a
            fresh post grounded in the video. There is no separate captions panel. Short videos still get 5 to 7
            sections; longer videos get a longer article.
          </Typography>
        </div>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <InternalLinkFields
          sites={settings.internalLinking}
          custom={settings.customInternalLink}
          onSites={value => updateSetting('internalLinking', value)}
          onCustom={value => updateSetting('customInternalLink', value)}
          siteOptions={clientSites}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Divider className='my-2' />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-tone'
          value={settings.toneOfVoice}
          onChange={value => updateSetting('toneOfVoice', value)}
          className={settings.toneOfVoice === 'custom' ? 'mbe-3' : ''}
        />
        {settings.toneOfVoice === 'custom' && (
          <TextField
            fullWidth
            size='small'
            placeholder='e.g. Sarcastic but informative...'
            value={settings.customToneOfVoice || ''}
            onChange={e => updateSetting('customToneOfVoice', e.target.value)}
          />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-language'
          value={settings.language}
          onChange={value => updateSetting('language', value)}
          options={languages.map(lang => ({ value: lang.code, label: lang.name }))}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-point-of-view'
          value={settings.pointOfView}
          onChange={value => updateSetting('pointOfView', value)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-country'
          value={settings.country}
          onChange={value => updateSetting('country', value)}
          options={countries.map(c => ({ value: c.code, label: c.name }))}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Divider className='my-2' />
      </Grid>

      <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
        <FlagSwitch
          featureKey='outline-editor'
          checked={settings.useOutlineEditor}
          onChange={value => updateSetting('useOutlineEditor', value)}
          label='Use Outline Editor'
        />
        <FlagSwitch
          featureKey='improve-readability'
          checked={settings.improveReadability}
          onChange={value => updateSetting('improveReadability', value)}
          label='Improve Readability'
        />
      </Grid>
    </>
  )
}

export default YoutubeBlogFields

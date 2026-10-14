import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'

import { FlagSwitch } from '../FeatureAccessContext'
import GatedSelect, { InternalLinkFields } from '../GatedSelect'

const YoutubeBlogFields = ({ settings, updateSetting }) => {
  const [statusText, setStatusText] = useState('')
  const [statusColor, setStatusColor] = useState('text-textSecondary')
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    const validateUrl = async () => {
      const url = settings.youtubeUrl
      if (!url || !url.includes('youtu')) {
        setStatusText('')
        return
      }

      setIsValidating(true)
      setStatusText('Connecting to YouTube...')
      setStatusColor('text-textSecondary')

      try {
        const res = await fetch('/api/youtube-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
        const data = await res.json()

        if (data.success) {
          setStatusText(`✓ Success: Linked to "${data.title}"`)
          setStatusColor('text-success')
          updateSetting('targetKeyword', data.title)
        } else {
          setStatusText(`✕ Error: ${data.error}`)
          setStatusColor('text-error')
        }
      } catch (error) {
        setStatusText('✕ Error connecting to validation server.')
        setStatusColor('text-error')
      } finally {
        setIsValidating(false)
      }
    }

    const timeoutId = setTimeout(validateUrl, 800)
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
            If ON, the AI acts like a transcriber formatting spoken words into an article.
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

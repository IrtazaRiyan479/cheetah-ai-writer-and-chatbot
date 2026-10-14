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
import GatedSelect, { GatedNumber, InternalLinkFields } from '../GatedSelect'

const RewriteFields = ({ settings, updateSetting }) => {
  const [statusText, setStatusText] = useState('')
  const [statusColor, setStatusColor] = useState('text-textSecondary')
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    const validateUrl = async () => {
      const url = settings.articleUrlToRewrite

      if (!url || !url.startsWith('http')) {
        setStatusText('')
        return
      }

      setIsValidating(true)
      setStatusText('Validating article URL...')
      setStatusColor('text-textSecondary')

      try {
        const res = await fetch('/api/article-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })

        const data = await res.json()

        if (res.ok && data.success) {
          const type = data.detectedType || ''
          updateSetting('sourceArticleType', type)
          if (settings.type === 'amazon-roundup-rewrite' && type === 'amazon-review') {
            setStatusText('This looks like a single-product review. Switch to Amazon review rewrite.')
            setStatusColor('text-error')
          } else if (settings.type === 'amazon-review-rewrite' && type === 'amazon-roundup') {
            setStatusText('This looks like an Amazon roundup. Switch to Amazon roundup rewrite.')
            setStatusColor('text-error')
          } else {
            setStatusText(`Successfully fetched: ${data.title}${type ? ` (${type})` : ''}`)
            setStatusColor('text-success')
            if (data.title) updateSetting('targetKeyword', data.title)
          }
        } else {
          setStatusText('Failed to fetch article data. Check URL or try another.')
          setStatusColor('text-error')
        }
      } catch (error) {
        setStatusText('Error connecting to the validation service.')
        setStatusColor('text-error')
      } finally {
        setIsValidating(false)
      }
    }

    const timeoutId = setTimeout(() => {
      validateUrl()
    }, 800)

    return () => clearTimeout(timeoutId)
  }, [settings.articleUrlToRewrite])

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Article URL to Rewrite
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://example.com/article'
          value={settings.articleUrlToRewrite || ''}
          onChange={e => updateSetting('articleUrlToRewrite', e.target.value)}
          InputProps={{
            endAdornment: isValidating ? <CircularProgress size={20} color='inherit' /> : null
          }}
        />
        {statusText && (
          <Typography variant='caption' className={`mt-1 block ${statusColor}`}>
            {statusText}
          </Typography>
        )}
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Target Keyword (Optional)
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='e.g. best running shoes for flat feet'
          value={settings.targetKeyword || ''}
          onChange={e => updateSetting('targetKeyword', e.target.value)}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-article-length'
          value={settings.articleLength || 'default'}
          onChange={value => updateSetting('articleLength', value)}
          className={settings.articleLength === 'custom' ? 'mbe-3' : ''}
          options={[
            { value: 'default', label: 'Default (match source)' },
            { value: 'custom', label: 'Custom Number of Sections' },
            { value: 'shorter', label: 'Shorter (2-3 Sections)' },
            { value: 'short', label: 'Short (3-5 Sections)' },
            { value: 'medium', label: 'Medium (5-7 Sections)' },
            { value: 'long', label: 'Long Form (7-10 Sections)' },
            { value: 'longer', label: 'Longer (10-12 Sections)' }
          ]}
        />
        {settings.articleLength === 'custom' ? (
          <TextField
            fullWidth
            size='small'
            type='number'
            label='Number of sections'
            value={settings.customSectionCount || ''}
            onChange={e => updateSetting('customSectionCount', e.target.value)}
          />
        ) : null}
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
          menuKey='menu-seo-optimization'
          value={settings.seoOptimization}
          onChange={value => updateSetting('seoOptimization', value)}
          className={settings.seoOptimization === 'manual' ? 'mbe-3' : ''}
        />
        {settings.seoOptimization === 'manual' && (
          <TextField
            fullWidth
            size='small'
            placeholder='Enter keywords separated by commas...'
            value={settings.manualKeywords || ''}
            onChange={e => updateSetting('manualKeywords', e.target.value)}
          />
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: settings.aiImagesAndVideos === 'auto' ? 4 : 6 }}>
        <GatedSelect
          menuKey='menu-royalty-media'
          value={settings.aiImagesAndVideos}
          onChange={value => updateSetting('aiImagesAndVideos', value)}
          className={String(settings.aiImagesAndVideos || '').startsWith('upload') ? 'mbe-3' : ''}
        />
      </Grid>

      {settings.aiImagesAndVideos === 'auto' && (
        <>
          <Grid size={{ xs: 12, sm: 2 }}>
            <GatedNumber
              featureKey='menu-image-limit'
              label='Image Limit'
              value={settings.numberOfImages}
              onChange={value => updateSetting('numberOfImages', value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 2 }}>
            <GatedNumber
              featureKey='menu-video-limit'
              label='YT Video Limit'
              value={settings.numberOfYoutubeVideos}
              onChange={value => updateSetting('numberOfYoutubeVideos', value)}
            />
          </Grid>
        </>
      )}

      <Grid size={{ xs: 12, sm: settings.aiImagesAndVideos === 'auto' ? 4 : 6 }}>
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
          menuKey='menu-country'
          value={settings.country}
          onChange={value => updateSetting('country', value)}
          options={countries.map(c => ({ value: c.code, label: c.name }))}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-point-of-view'
          value={settings.pointOfView}
          onChange={value => updateSetting('pointOfView', value)}
        />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Divider className='my-2' />
      </Grid>

      <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FlagSwitch
            featureKey='real-time-data'
            checked={settings.useRealTimeSearchData}
            onChange={value => updateSetting('useRealTimeSearchData', value)}
            label='Real-Time Data'
          />
          {settings.useRealTimeSearchData && (
            <GatedSelect
              menuKey='menu-realtime-source'
              value={settings.realTimeDataSource}
              onChange={value => updateSetting('realTimeDataSource', value)}
              className='mt-2 mbe-3'
            />
          )}
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <FlagSwitch
            featureKey='automatic-external-links'
            checked={settings.automaticExternalLinks}
            onChange={value => updateSetting('automaticExternalLinks', value)}
            label='Automatic External Links'
          />
          <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
            Finds and embeds highly relevant, authoritative outbound links via Google Search.
          </Typography>
        </Grid>

        <FlagSwitch
          featureKey='outline-editor'
          checked={settings.useOutlineEditor}
          onChange={value => updateSetting('useOutlineEditor', value)}
          label='Use Outline Editor'
        />
        <FlagSwitch
          featureKey='include-faq'
          checked={settings.includeFaq}
          onChange={value => updateSetting('includeFaq', value)}
          label='Include FAQ Section'
        />
        <FlagSwitch
          featureKey='include-key-takeaways'
          checked={settings.includeKeyTakeaways}
          onChange={value => updateSetting('includeKeyTakeaways', value)}
          label='Include Key Takeaways'
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

export default RewriteFields

import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect } from 'react'

import { clientSites } from '@/configs/clientSites'
import { languages } from '@/configs/languages'

import { FlagSwitch } from '../FeatureAccessContext'
import GatedSelect, { InternalLinkFields } from '../GatedSelect'

const AmazonReviewFields = ({ settings, updateSetting }) => {
  useEffect(() => {
    if (settings.amazonProductUrl && !settings.targetKeyword) {
      try {
        const urlObj = new URL(settings.amazonProductUrl)
        const pathParts = urlObj.pathname.split('/')
        const dpIndex = pathParts.findIndex(part => ['dp', 'product', 'item', 'ASIN'].includes(part))

        if (dpIndex > 1) {
          const slug = pathParts[dpIndex - 1]
          let productName = decodeURIComponent(slug).replace(/-/g, ' ')
          productName = productName.replace(/\b\w/g, l => l.toUpperCase())

          updateSetting('targetKeyword', productName)
        }
      } catch (error) {}
    }
  }, [settings.amazonProductUrl])

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Target Keyword (Optional)
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='e.g. Under Armour Charged Bandit Hiking'
          value={settings.targetKeyword}
          onChange={e => updateSetting('targetKeyword', e.target.value)}
        />
        <Typography variant='caption' color='text.secondary'>
          If left blank, we will attempt to extract the product name directly from the URL.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Amazon Product URL
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://amazon.com/dp/...'
          value={settings.amazonProductUrl}
          onChange={e => updateSetting('amazonProductUrl', e.target.value)}
        />
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
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Amazon Tracking ID (Optional)
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='your-tag-20'
          value={settings.amazonTrackingId}
          onChange={e => updateSetting('amazonTrackingId', e.target.value)}
        />
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

      <Grid size={{ xs: 12 }}>
        <Divider className='my-2' />
      </Grid>

      <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
        <FlagSwitch
          featureKey='enable-first-hand-experience'
          checked={settings.enableFirstHandExperience}
          onChange={value => updateSetting('enableFirstHandExperience', value)}
          label='Enable First-Hand Experience'
        />

        <div className='flex flex-col'>
          <FlagSwitch
            featureKey='enable-condensed-mode'
            checked={settings.enableCondensedMode}
            onChange={value => updateSetting('enableCondensedMode', value)}
            label='Enable Condensed Mode'
          />
          <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
            Creates a shorter, more concise article that doesn&apos;t waste the user&apos;s time.
          </Typography>
        </div>

        <Grid size={{ xs: 12, sm: 12 }}>
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
          featureKey='improve-readability'
          checked={settings.improveReadability}
          onChange={value => updateSetting('improveReadability', value)}
          label='Improve Readability'
        />
      </Grid>
    </>
  )
}

export default AmazonReviewFields

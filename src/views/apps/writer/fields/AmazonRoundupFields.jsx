import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect } from 'react'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'

import { FlagSwitch } from '../FeatureAccessContext'
import GatedSelect, { InternalLinkFields } from '../GatedSelect'

const AmazonRoundupFields = ({ settings, updateSetting }) => {
  useEffect(() => {
    if (settings.amazonSearchUrl) {
      try {
        const url = new URL(settings.amazonSearchUrl)
        const keyword = url.searchParams.get('k') || url.searchParams.get('field-keywords')
        if (keyword && keyword !== settings.targetKeyword) updateSetting('targetKeyword', keyword)
        if (url.hostname && url.hostname.replace(/^www\./, '') !== settings.amazonDomain) {
          updateSetting('amazonDomain', url.hostname.replace(/^www\./, ''))
        }
      } catch (error) {}
    }
  }, [settings.amazonSearchUrl, settings.targetKeyword, settings.amazonDomain, settings.amazonTrackingId, updateSetting])

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Target Keyword
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='e.g. best running shoes for flat feet'
          value={settings.targetKeyword}
          onChange={event => updateSetting('targetKeyword', event.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>
          Amazon Search URL (Optional)
        </Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://amazon.com/s?k=...'
          value={settings.amazonSearchUrl}
          onChange={event => updateSetting('amazonSearchUrl', event.target.value)}
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
          Number of Products
        </Typography>
        <TextField
          fullWidth
          type='number'
          size='small'
          value={settings.numberOfProducts}
          onChange={event => updateSetting('numberOfProducts', event.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-roundup-layout'
          value={settings.roundupLayout || 'table'}
          onChange={value => updateSetting('roundupLayout', value)}
        />
        <Typography variant='caption' color='text.secondary'>
          One layout per article. Product Table is the default. Top Pick is ranked cards, not a table.
        </Typography>
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
          onChange={event => updateSetting('amazonTrackingId', event.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-amazon-domain'
          value={settings.amazonDomain}
          onChange={value => updateSetting('amazonDomain', value)}
        />
        {settings.articleLength === 'custom' ? (
          <TextField
            fullWidth
            type='number'
            size='small'
            label='Custom Section Count'
            value={settings.customArticleLength || ''}
            inputProps={{ min: 1, max: 48 }}
            onChange={event =>
              updateSetting('customArticleLength', Math.min(48, Math.max(1, Number(event.target.value) || 1)))
            }
            sx={{ mt: 2 }}
          />
        ) : null}
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <GatedSelect
          menuKey='menu-tone'
          value={settings.toneOfVoice}
          onChange={value => updateSetting('toneOfVoice', value)}
          className={settings.toneOfVoice === 'custom' ? 'mbe-3' : ''}
        />
        {settings.toneOfVoice === 'custom' ? (
          <TextField
            fullWidth
            size='small'
            label='Custom Tone'
            value={settings.customToneOfVoice || ''}
            onChange={event => updateSetting('customToneOfVoice', event.target.value)}
            sx={{ mt: 2 }}
          />
        ) : null}
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
          options={countries.map(country => ({ value: country.code, label: country.name }))}
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
        <FlagSwitch
          featureKey='automatic-external-links'
          checked={settings.automaticExternalLinks}
          onChange={value => updateSetting('automaticExternalLinks', value)}
          label='Automatic External Links'
        />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Finds and embeds highly relevant, authoritative outbound links via Google Search.
        </Typography>
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

export default AmazonRoundupFields

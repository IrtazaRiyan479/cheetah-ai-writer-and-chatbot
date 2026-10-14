import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'

import { FlagSwitch } from '../FeatureAccessContext'
import GatedSelect, { InternalLinkFields } from '../GatedSelect'

const numberingOptions = descending => [
  { value: '1)', label: descending ? '10), 9), 8)' : '1), 2), 3)' },
  { value: '1.', label: descending ? '10., 9., 8.' : '1., 2., 3.' },
  { value: '1:', label: descending ? '10:, 9:, 8:' : '1:, 2:, 3:' },
  { value: 'none', label: 'None' }
]

const LocalRoundupFields = ({ settings, updateSetting }) => (
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
        onChange={e => updateSetting('targetKeyword', e.target.value)}
      />
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        Number of Places
      </Typography>
      <TextField
        fullWidth
        type='number'
        size='small'
        disabled={settings.enableAutoLength}
        value={settings.numberOfPlaces}
        onChange={e => updateSetting('numberOfPlaces', e.target.value)}
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
      <div className='flex flex-col'>
        <FlagSwitch
          featureKey='deep-search'
          checked={settings.deepSearch}
          onChange={value => updateSetting('deepSearch', value)}
          label='Deep Search'
        />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Uses up to 300% more credits, but significantly improves article quality by gathering more web sources.
        </Typography>
      </div>

      <FlagSwitch
        featureKey='enable-auto-length'
        checked={settings.enableAutoLength}
        onChange={value => updateSetting('enableAutoLength', value)}
        label='Enable Auto Length'
      />
      <FlagSwitch
        featureKey='generate-unique-map-images'
        checked={settings.generateUniqueMapImages}
        onChange={value => updateSetting('generateUniqueMapImages', value)}
        label='Generate Unique Map Images'
      />
      <FlagSwitch
        featureKey='enable-first-hand-experience'
        checked={settings.enableFirstHandExperience}
        onChange={value => updateSetting('enableFirstHandExperience', value)}
        label='Enable First-Hand Experience'
      />
      <FlagSwitch
        featureKey='enable-supplemental-information'
        checked={settings.enableSupplementalInformation}
        onChange={value => updateSetting('enableSupplementalInformation', value)}
        label='Enable Supplemental Information'
      />

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
      <FlagSwitch
        featureKey='use-descending-order'
        checked={settings.useDescendingOrder}
        onChange={value => updateSetting('useDescendingOrder', value)}
        label='Use Descending Order'
      />
      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <GatedSelect
              menuKey='menu-list-numbering'
              value={settings.listNumberingFormat}
              onChange={value => updateSetting('listNumberingFormat', value)}
              options={numberingOptions(settings.useDescendingOrder)}
            />
          </Grid>
        </Grid>
      </div>
    </Grid>
  </>
)

export default LocalRoundupFields

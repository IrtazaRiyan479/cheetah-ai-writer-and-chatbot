import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'

import { FlagSwitch, ProLabel, useFeatureAccess } from '../FeatureAccessContext'
import GatedSelect, { GatedNumber, InternalLinkFields } from '../GatedSelect'
import MediaUploader from '../MediaUploader'

const numberingOptions = descending => [
  { value: '1)', label: descending ? '10), 9), 8)' : '1), 2), 3)' },
  { value: '1.', label: descending ? '10., 9., 8.' : '1., 2., 3.' },
  { value: '1:', label: descending ? '10:, 9:, 8:' : '1:, 2:, 3:' },
  { value: 'none', label: 'None' }
]

const ListItemPromptField = ({ value, onChange }) => {
  const { modeOf, requireFeature } = useFeatureAccess()
  if (modeOf('menu-list-item-prompt') === 'off') return null

  return (
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        <ProLabel featureKey='menu-list-item-prompt'>List Item Custom Prompt</ProLabel>
      </Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        size='small'
        placeholder='e.g. Include pros and cons for each item, and focus on durability...'
        value={value || ''}
        onChange={event => {
          const next = event.target.value
          if (next.trim() && next.trim() !== 'only write a max of 200 words' && !requireFeature('menu-list-item-prompt')) return
          onChange(next)
        }}
      />
    </Grid>
  )
}

const ListicleFields = ({ settings, updateSetting }) => (
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
        Total List Items
      </Typography>
      <TextField
        fullWidth
        type='number'
        size='small'
        disabled={settings.enableAutoLength}
        value={settings.totalListItems}
        onChange={e => updateSetting('totalListItems', e.target.value)}
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

    {String(settings.aiImagesAndVideos || '').startsWith('upload') && (
      <Grid size={{ xs: 12 }}>
        <MediaUploader uploadType={settings.aiImagesAndVideos} onFilesUpdate={files => updateSetting('uploadedMedia', files)} />
      </Grid>
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

    <ListItemPromptField value={settings.listItemPrompt} onChange={value => updateSetting('listItemPrompt', value)} />

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
          featureKey='enable-auto-length'
          checked={settings.enableAutoLength}
          onChange={value => updateSetting('enableAutoLength', value)}
          label='Enable Auto Length (10 items + Info Sections)'
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
      </Grid>

      <FlagSwitch
        featureKey='outline-editor'
        checked={settings.useOutlineEditor}
        onChange={value => updateSetting('useOutlineEditor', value)}
        label='Use Outline Editor'
      />
      <FlagSwitch
        featureKey='enable-supplemental-information'
        checked={settings.enableSupplementalInformation || false}
        onChange={value => updateSetting('enableSupplementalInformation', value)}
        label='Enable Supplemental Information'
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

export default ListicleFields

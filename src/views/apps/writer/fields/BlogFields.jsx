import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { clientSites } from '@/configs/clientSites'
import { countries } from '@/configs/countries'
import { languages } from '@/configs/languages'

import { ProLabel, useFeatureAccess } from '../FeatureAccessContext'
import GatedSelect, { GatedNumber, InternalLinkFields } from '../GatedSelect'
import MediaUploader from '../MediaUploader'

const BlogFields = ({ settings, updateSetting }) => {
  const { requireFeature, modeOf } = useFeatureAccess()
  const gatedToggle = (featureKey, settingKey, checked) => {
    if (checked && !requireFeature(featureKey)) return
    updateSetting(settingKey, Boolean(checked))
  }
  const shown = featureKey => modeOf(featureKey) !== 'off'

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
          onChange={e => updateSetting('targetKeyword', e.target.value)}
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
          menuKey='menu-article-length'
          value={settings.articleLength}
          onChange={value => updateSetting('articleLength', value)}
          className={settings.articleLength === 'custom' ? 'mbe-3' : ''}
        />
        {settings.articleLength === 'custom' && (
          <TextField
            fullWidth
            type='number'
            size='small'
            placeholder='e.g. 5'
            value={settings.customArticleLength || ''}
            inputProps={{ min: 1, max: 48 }}
            onChange={e => {
              let value = e.target.value
              if (Number(value) > 48) value = 48
              else if (value !== '' && Number(value) < 1) value = 1
              updateSetting('customArticleLength', value)
            }}
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
        {shown('real-time-data') ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.useRealTimeSearchData}
                  onChange={e => gatedToggle('real-time-data', 'useRealTimeSearchData', e.target.checked)}
                />
              }
              label={
                <Typography className='font-medium text-textPrimary'>
                  <ProLabel featureKey='real-time-data'>Real-Time Data</ProLabel>
                </Typography>
              }
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
        ) : null}

        {shown('automatic-external-links') ? (
          <Grid size={{ xs: 12, sm: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.automaticExternalLinks}
                  onChange={e => gatedToggle('automatic-external-links', 'automaticExternalLinks', e.target.checked)}
                />
              }
              label={
                <Typography className='font-medium text-textPrimary'>
                  <ProLabel featureKey='automatic-external-links'>Automatic External Links</ProLabel>
                </Typography>
              }
            />
            <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
              Finds and embeds highly relevant, authoritative outbound links via Google Search.
            </Typography>
          </Grid>
        ) : null}

        {shown('deep-search') ? (
          <div className='flex flex-col'>
            <FormControlLabel
              control={
                <Switch checked={settings.deepSearch} onChange={e => gatedToggle('deep-search', 'deepSearch', e.target.checked)} />
              }
              label={
                <Typography className='font-medium text-textPrimary'>
                  <ProLabel featureKey='deep-search'>Deep Search</ProLabel>
                </Typography>
              }
            />
            <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
              Uses up to 300% more credits, but significantly improves article quality by gathering more web sources.
            </Typography>
          </div>
        ) : null}

        {shown('outline-editor') ? (
          <FormControlLabel
            control={
              <Switch
                checked={settings.useOutlineEditor}
                onChange={e => gatedToggle('outline-editor', 'useOutlineEditor', e.target.checked)}
              />
            }
            label={
              <Typography className='font-medium text-textPrimary'>
                <ProLabel featureKey='outline-editor'>Use Outline Editor</ProLabel>
              </Typography>
            }
          />
        ) : null}

        {shown('include-faq') ? (
          <FormControlLabel
            control={
              <Switch checked={settings.includeFaq} onChange={e => gatedToggle('include-faq', 'includeFaq', e.target.checked)} />
            }
            label={
              <Typography className='font-medium text-textPrimary'>
                <ProLabel featureKey='include-faq'>Include FAQ Section</ProLabel>
              </Typography>
            }
          />
        ) : null}
        {shown('include-key-takeaways') ? (
          <FormControlLabel
            control={
              <Switch
                checked={settings.includeKeyTakeaways}
                onChange={e => gatedToggle('include-key-takeaways', 'includeKeyTakeaways', e.target.checked)}
              />
            }
            label={
              <Typography className='font-medium text-textPrimary'>
                <ProLabel featureKey='include-key-takeaways'>Include Key Takeaways</ProLabel>
              </Typography>
            }
          />
        ) : null}
        {shown('improve-readability') ? (
          <FormControlLabel
            control={
              <Switch
                checked={settings.improveReadability}
                onChange={e => gatedToggle('improve-readability', 'improveReadability', e.target.checked)}
              />
            }
            label={
              <Typography className='font-medium text-textPrimary'>
                <ProLabel featureKey='improve-readability'>Improve Readability</ProLabel>
              </Typography>
            }
          />
        ) : null}
      </Grid>
    </>
  )
}

export default BlogFields

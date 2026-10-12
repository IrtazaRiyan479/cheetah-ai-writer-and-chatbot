import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import { clientSites } from '@/configs/clientSites'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import OutlinedInput from '@mui/material/OutlinedInput'
import Chip from '@mui/material/Chip'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import MediaUploader from '../MediaUploader'
import { FlagSwitch } from '../FeatureAccessContext'

const LocalRoundupFields = ({ settings, updateSetting }) => (
  <>
    {/* Top Section */}

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' value={settings.targetKeyword} onChange={(e) => updateSetting('targetKeyword', e.target.value)} />
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
          <Typography variant='subtitle2' className='font-medium mbe-1'>Number of Places</Typography>
          <TextField
            fullWidth
            type="number"
            size='small'
            disabled={settings.enableAutoLength}
            value={settings.numberOfPlaces}
            onChange={(e) => updateSetting('numberOfPlaces', e.target.value)}
          />
        </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Automatic Internal Linking</Typography>
      <FormControl fullWidth size='small' className='mbe-3'>
        <Select
          multiple
          value={Array.isArray(settings.internalLinking) ? settings.internalLinking : []}
          onChange={(e) => updateSetting('internalLinking', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
          input={<OutlinedInput size='small' />}
          renderValue={(selected) => (
            <div className='flex flex-wrap gap-1'>
              {selected.map((value) => (
                <Chip key={value} label={value} size="small" className='h-6' />
              ))}
            </div>
          )}
        >
          {clientSites.map((site) => (
            <MenuItem key={site} value={site}>
              <Checkbox checked={Array.isArray(settings.internalLinking) && settings.internalLinking.indexOf(site) > -1} />
              <ListItemText primary={site} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant='subtitle2' className='font-medium mbe-1'>Custom URLs (Comma Separated)</Typography>
      <TextField
        fullWidth
        size='small'
        placeholder='https://site1.com, https://site2.com'
        value={settings.customInternalLink || ''}
        onChange={(e) => updateSetting('customInternalLink', e.target.value)}
      />
    </Grid>

    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

   <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>SEO Optimization</Typography>

      {/* We add a bottom margin dynamically if the text box is about to appear below it */}
      <FormControl fullWidth size='small' className={settings.seoOptimization === 'manual' ? 'mbe-3' : ''}>
        <Select
          value={settings.seoOptimization}
          onChange={(e) => updateSetting('seoOptimization', e.target.value)}
        >
          <MenuItem value='default'>Default</MenuItem>
          <MenuItem value='manual'>Manual</MenuItem>
          <MenuItem value='ai'>AI-Powered</MenuItem>
        </Select>
      </FormControl>

      {/* Conditionally render manual keyword input */}
      {settings.seoOptimization === 'manual' && (
        <TextField
          fullWidth
          size='small'
          placeholder='Enter keywords separated by commas...'
          value={settings.manualKeywords || ''}
          onChange={(e) => updateSetting('manualKeywords', e.target.value)}
        />
      )}
    </Grid>
  <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Tone of Voice</Typography>
      <FormControl fullWidth size='small' className={settings.toneOfVoice === 'custom' ? 'mbe-3' : ''}>
        <Select value={settings.toneOfVoice} onChange={(e) => updateSetting('toneOfVoice', e.target.value)}>
          <MenuItem value='seo'>SEO Optimized (Confident, Knowledgeable, Neutral, and Clear)</MenuItem>
          <MenuItem value='excited'>Excited</MenuItem>
          <MenuItem value='professional'>Professional</MenuItem>
          <MenuItem value='friendly'>Friendly</MenuItem>
          <MenuItem value='formal'>Formal</MenuItem>
          <MenuItem value='casual'>Casual</MenuItem>
          <MenuItem value='humorous'>Humorous</MenuItem>
          <MenuItem value='custom'>Custom</MenuItem>
        </Select>
      </FormControl>

      {/* Conditionally render custom tone input */}
      {settings.toneOfVoice === 'custom' && (
        <TextField
          fullWidth
          size='small'
          placeholder='e.g. Sarcastic but informative...'
          value={settings.customToneOfVoice || ''}
          onChange={(e) => updateSetting('customToneOfVoice', e.target.value)}
        />
      )}
    </Grid>
   <Grid size={{ xs: 12, sm: 6 }}>
  <Typography variant='subtitle2' className='font-medium mbe-1'>Language</Typography>
  <FormControl fullWidth size='small'>
    <Select
      value={settings.language}
      onChange={(e) => updateSetting('language', e.target.value)}
    >
      {languages.map((lang) => (
        <MenuItem key={lang.code} value={lang.code}>
          {lang.name}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
</Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Country</Typography>
      <FormControl fullWidth size='small'>
        <Select
          value={settings.country}
          onChange={(e) => updateSetting('country', e.target.value)}
        >
          {countries.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
   <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Point of View</Typography>
      <FormControl fullWidth size='small'>
        <Select
          value={settings.pointOfView}
          onChange={(e) => updateSetting('pointOfView', e.target.value)}
        >
          <MenuItem value='first'>First Person (I, me, my)</MenuItem>
          {/* --- ADD THIS NEW OPTION --- */}
          <MenuItem value='first-plural'>First Person Plural (We, us, our)</MenuItem>
          <MenuItem value='second'>Second Person (You, your)</MenuItem>
          <MenuItem value='third'>Third Person (he, she, it, they)</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
     {/* REAL-TIME DATA & EXTERNAL LINKS */}
    <Grid size={{ xs: 12, sm: 6 }}>
      <FlagSwitch featureKey='real-time-data' checked={settings.useRealTimeSearchData} onChange={value => updateSetting('useRealTimeSearchData', value)} label='Real-Time Data' />
      {settings.useRealTimeSearchData && (
        <FormControl fullWidth size='small' className='mt-2 mbe-3'>
          <Select value={settings.realTimeDataSource} onChange={(e) => updateSetting('realTimeDataSource', e.target.value)}>
            <MenuItem value='search'>⭐ Web</MenuItem>
            <MenuItem value='news'>Google News</MenuItem>
            <MenuItem value='scholar'>Google Scholar</MenuItem>
          </Select>
        </FormControl>
      )}
    </Grid>

    <Grid size={{ xs: 12, sm: 12 }}>
      <FlagSwitch featureKey='automatic-external-links' checked={settings.automaticExternalLinks} onChange={value => updateSetting('automaticExternalLinks', value)} label='Automatic External Links' />
      <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
        Finds and embeds highly relevant, authoritative outbound links via Google Search.
      </Typography>
    </Grid>
      <div className='flex flex-col'>
              <FlagSwitch featureKey='deep-search' checked={settings.deepSearch} onChange={value => updateSetting('deepSearch', value)} label='Deep Search' />
              <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
                Uses up to 300% more credits, but significantly improves article quality by gathering more web sources.
              </Typography>
            </div>

      <FlagSwitch featureKey='enable-auto-length' checked={settings.enableAutoLength} onChange={value => updateSetting('enableAutoLength', value)} label='Enable Auto Length' />
      <FlagSwitch featureKey='generate-unique-map-images' checked={settings.generateUniqueMapImages} onChange={value => updateSetting('generateUniqueMapImages', value)} label='Generate Unique Map Images' />
      <FlagSwitch featureKey='enable-first-hand-experience' checked={settings.enableFirstHandExperience} onChange={value => updateSetting('enableFirstHandExperience', value)} label='Enable First-Hand Experience' />
      <FlagSwitch featureKey='enable-supplemental-information' checked={settings.enableSupplementalInformation} onChange={value => updateSetting('enableSupplementalInformation', value)} label='Enable Supplemental Information' />


      <FlagSwitch featureKey='outline-editor' checked={settings.useOutlineEditor} onChange={value => updateSetting('useOutlineEditor', value)} label='Use Outline Editor' />
      <FlagSwitch featureKey='include-faq' checked={settings.includeFaq} onChange={value => updateSetting('includeFaq', value)} label='Include FAQ Section' />
      <FlagSwitch featureKey='improve-readability' checked={settings.improveReadability} onChange={value => updateSetting('improveReadability', value)} label='Improve Readability' />
      <FlagSwitch featureKey='use-descending-order' checked={settings.useDescendingOrder} onChange={value => updateSetting('useDescendingOrder', value)} label='Use Descending Order' />
      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>List Numbering Format</Typography>
            <FormControl fullWidth size='small'>
              <Select value={settings.listNumberingFormat} onChange={(e) => updateSetting('listNumberingFormat', e.target.value)}>
                <MenuItem value='1)'>
                  {settings.useDescendingOrder ? '10), 9), 8)' : '1), 2), 3)'}
                </MenuItem>
                <MenuItem value='1.'>
                  {settings.useDescendingOrder ? '10., 9., 8.' : '1., 2., 3.'}
                </MenuItem>
                <MenuItem value='1:'>
                  {settings.useDescendingOrder ? '10:, 9:, 8:' : '1:, 2:, 3:'}
                </MenuItem>
                <MenuItem value='none'>None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>
      {/* --------------------------------------- */}
    </Grid>
  </>
)
export default LocalRoundupFields

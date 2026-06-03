import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import { clientSites } from '@/configs/clientSites'
import Checkbox from '@mui/material/Checkbox'
import ListItemText from '@mui/material/ListItemText'
import OutlinedInput from '@mui/material/OutlinedInput'
import Chip from '@mui/material/Chip'
import { languages } from '@/configs/languages'
import { countries } from '@/configs/countries'
import MediaUploader from '../MediaUploader' // Adjust the path based on where you saved it

const AmazonRoundupFields = ({ settings, updateSetting }) => (
  <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' value={settings.targetKeyword} onChange={(e) => updateSetting('targetKeyword', e.target.value)} />
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Search URL</Typography>
      <TextField fullWidth size='small' placeholder='https://amazon.com/s?k=...' value={settings.amazonSearchUrl} onChange={(e) => updateSetting('amazonSearchUrl', e.target.value)} />
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
      <Typography variant='subtitle2' className='font-medium mbe-1'>Number of Products</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.numberOfProducts} onChange={(e) => updateSetting('numberOfProducts', e.target.value)}>
          <MenuItem value='auto'>Auto</MenuItem>
          <MenuItem value='5'>5</MenuItem>
          <MenuItem value='10'>10</MenuItem>
          <MenuItem value='15'>15</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Tracking ID (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='your-tag-20' value={settings.amazonTrackingId} onChange={(e) => updateSetting('amazonTrackingId', e.target.value)} />
    </Grid>
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
      <Typography variant='subtitle2' className='font-medium mbe-1'>Article Length</Typography>
      <FormControl fullWidth size='small' className={settings.articleLength === 'custom' ? 'mbe-3' : ''}>
        <Select value={settings.articleLength} onChange={(e) => updateSetting('articleLength', e.target.value)}>
          <MenuItem value='default'>Default</MenuItem>
          <MenuItem value='custom'>Custom Number of Sections</MenuItem>
          <MenuItem value='shorter'>Shorter (2-3 Sections)</MenuItem>
          <MenuItem value='short'>Short (3-5 Sections)</MenuItem>
          <MenuItem value='medium'>Medium (5-7 Sections)</MenuItem>
          <MenuItem value='long'>Long Form (7-10 Sections)</MenuItem>
          <MenuItem value='longer'>Longer (10-12 Sections)</MenuItem>
        </Select>
      </FormControl>

      {/* Conditionally render custom section count input */}
       {settings.articleLength === 'custom' && (
        <TextField
          fullWidth
          type='number'
          size='small'
          placeholder='e.g. 5'
          value={settings.customArticleLength || ''}
          inputProps={{ min: 1, max: 48 }}
          onChange={(e) => {
            let value = e.target.value;

            // If the user types a number greater than 48, force it back to 48
            if (Number(value) > 48) {
              value = 48;
            }
            // Optional: prevent negative numbers or 0
            else if (value !== '' && Number(value) < 1) {
              value = 1;
            }

            updateSetting('customArticleLength', value);
          }}
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
      <FormControlLabel
        control={<Switch checked={settings.useRealTimeSearchData} onChange={(e) => updateSetting('useRealTimeSearchData', e.target.checked)} />}
        label={<Typography className='font-medium text-textPrimary'>Real-Time Data</Typography>}
      />
      {settings.useRealTimeSearchData && (
        <FormControl fullWidth size='small' className='mt-2 mbe-3'>
          <Select value={settings.realTimeDataSource} onChange={(e) => updateSetting('realTimeDataSource', e.target.value)}>
            <MenuItem value='search'>Default (Web)</MenuItem>
            <MenuItem value='news'>Google News</MenuItem>
            <MenuItem value='scholar'>Google Scholar</MenuItem>
          </Select>
        </FormControl>
      )}
    </Grid>

      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={(e) => updateSetting('useOutlineEditor', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableFirstHandExperience} onChange={(e) => updateSetting('enableFirstHandExperience', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableSupplementalInformation} onChange={(e) => updateSetting('enableSupplementalInformation', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable Supplemental Information</Typography>} />
      <FormControlLabel control={<Switch checked={settings.includeFaq} onChange={(e) => updateSetting('includeFaq', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch checked={settings.includeKeyTakeaways} onChange={(e) => updateSetting('includeKeyTakeaways', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include Key Takeaways</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={(e) => updateSetting('improveReadability', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />
    </Grid>
  </>
)
export default AmazonRoundupFields

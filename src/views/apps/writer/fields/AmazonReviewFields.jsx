import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'

const AmazonReviewFields = ({ settings, updateSetting }) => (
  <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Product URL</Typography>
      <TextField fullWidth size='small' placeholder='https://amazon.com/dp/...' value={settings.amazonProductUrl} onChange={(e) => updateSetting('amazonProductUrl', e.target.value)} />
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' value={settings.targetKeyword} onChange={(e) => updateSetting('targetKeyword', e.target.value)} />
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Automatic Internal Linking</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.internalLinking} onChange={(e) => updateSetting('internalLinking', e.target.value)}>
          <MenuItem value='unselected'>Unselected</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Tracking ID (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='your-tag-20' value={settings.amazonTrackingId} onChange={(e) => updateSetting('amazonTrackingId', e.target.value)} />
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>SEO Optimization</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.seoOptimization} onChange={(e) => updateSetting('seoOptimization', e.target.value)}>
          <MenuItem value='default'>Default</MenuItem>
          <MenuItem value='manual'>Manual</MenuItem>
          <MenuItem value='ai'>AI-Powered</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Article Length</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.articleLength} onChange={(e) => updateSetting('articleLength', e.target.value)}>
          <MenuItem value='shorter'>Shorter</MenuItem>
          <MenuItem value='default'>Default</MenuItem>
          <MenuItem value='longer'>Longer</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Tone of Voice</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.toneOfVoice} onChange={(e) => updateSetting('toneOfVoice', e.target.value)}>
          <MenuItem value='seo'>SEO Optimized</MenuItem>
          <MenuItem value='excited'>Excited</MenuItem>
          <MenuItem value='professional'>Professional</MenuItem>
          <MenuItem value='friendly'>Friendly</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Language</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.language} onChange={(e) => updateSetting('language', e.target.value)}>
          <MenuItem value='en-us'>English (US)</MenuItem>
          <MenuItem value='en-uk'>English (UK)</MenuItem>
          <MenuItem value='es'>Spanish</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Country</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.country} onChange={(e) => updateSetting('country', e.target.value)}>
          <MenuItem value='us'>United States</MenuItem>
          <MenuItem value='uk'>United Kingdom</MenuItem>
          <MenuItem value='ca'>Canada</MenuItem>
          <MenuItem value='au'>Australia</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Point of View</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.pointOfView} onChange={(e) => updateSetting('pointOfView', e.target.value)}>
          <MenuItem value='first'>First Person (I, me, my)</MenuItem>
          <MenuItem value='second'>Second Person (You, your)</MenuItem>
          <MenuItem value='third'>Third Person (he, she, it, they)</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={(e) => updateSetting('useOutlineEditor', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableFirstHandExperience} onChange={(e) => updateSetting('enableFirstHandExperience', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />

      <div className='flex flex-col'>
        <FormControlLabel control={<Switch checked={settings.enableCondensedMode} onChange={(e) => updateSetting('enableCondensedMode', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable Condensed Mode</Typography>} />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Creates a shorter, more concise article that doesn't waste the user's time.
        </Typography>
      </div>

      <FormControlLabel control={<Switch checked={settings.includeFaq} onChange={(e) => updateSetting('includeFaq', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={(e) => updateSetting('improveReadability', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />
    </Grid>
  </>
)
export default AmazonReviewFields

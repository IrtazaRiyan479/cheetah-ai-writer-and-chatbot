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

const ListicleFields = ({ settings, updateSetting }) => (
  <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' value={settings.targetKeyword} onChange={(e) => updateSetting('targetKeyword', e.target.value)} />
    </Grid>

<Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Total List Items</Typography>
      <TextField
        fullWidth
        type="number"
        size='small'
        disabled={settings.enableAutoLength}
        value={settings.totalListItems}
        onChange={(e) => updateSetting('totalListItems', e.target.value)}
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
      <Typography variant='subtitle2' className='font-medium mbe-1'>Royalty Free Images & Youtube Videos</Typography>
      <FormControl fullWidth size='small' className={settings.aiImagesAndVideos.startsWith('upload') ? 'mbe-3' : ''}>
        <Select
          value={settings.aiImagesAndVideos}
          onChange={(e) => updateSetting('aiImagesAndVideos', e.target.value)}
        >
          <MenuItem value='none'>None</MenuItem>
          <MenuItem value='auto'>Royalty Free Images</MenuItem>
          <MenuItem disabled>──────────</MenuItem>
          <MenuItem value='upload-images'>Upload Custom Images</MenuItem>
          {/* <MenuItem value='upload-videos'>Upload Custom Videos</MenuItem>
          <MenuItem value='upload-both'>Upload Both Images & Videos</MenuItem> */}
        </Select>
      </FormControl>
    </Grid>

    {/* Conditionally render the real Materialize File Uploader */}
    {settings.aiImagesAndVideos.startsWith('upload') && (
      <Grid size={{ xs: 12 }}>
         <MediaUploader uploadType={settings.aiImagesAndVideos} onFilesUpdate={(files) => updateSetting('uploadedMedia', files)} />
      </Grid>
    )}
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

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>List Item Custom Prompt</Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        size='small'
        placeholder='e.g. Include pros and cons for each item, and focus on durability...'
        value={settings.listItemPrompt || 'only write a max of 200 words'}
        onChange={(e) => updateSetting('listItemPrompt', e.target.value)}
      />
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

    <Grid size={{ xs: 12, sm: 6 }}>
      <FormControlLabel
        control={<Switch checked={settings.enableAutoLength} onChange={(e) => updateSetting('enableAutoLength', e.target.checked)} />}
        label={<Typography className='font-medium text-textPrimary'>Enable Auto Length (10 items + Info Sections)</Typography>}
      />
      <FormControlLabel
        control={<Switch checked={settings.automaticExternalLinks} onChange={(e) => updateSetting('automaticExternalLinks', e.target.checked)} />}
        label={<Typography className='font-medium text-textPrimary'>Automatic External Links</Typography>}
      />
      <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
        Finds and embeds highly relevant, authoritative outbound links via Google Search.
      </Typography>
    </Grid>

      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={(e) => updateSetting('useOutlineEditor', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
     <FormControlLabel
        control={<Switch checked={settings.enableSupplementalInformation || false} onChange={(e) => updateSetting('enableSupplementalInformation', e.target.checked)} />}
        label={<Typography className='font-medium text-textPrimary'>Enable Supplemental Information</Typography>}
      />
      <FormControlLabel control={<Switch checked={settings.includeFaq} onChange={(e) => updateSetting('includeFaq', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={(e) => updateSetting('improveReadability', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />

      <FormControlLabel
        control={<Switch checked={settings.useDescendingOrder} onChange={(e) => updateSetting('useDescendingOrder', e.target.checked)} />}
        label={<Typography className='font-medium text-textPrimary'>Use Descending Order</Typography>}
      />
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
    </Grid>
  </>
)
export default ListicleFields

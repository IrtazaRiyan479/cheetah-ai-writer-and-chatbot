import Grid from '@mui/material/Grid'
import { useState, useEffect } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'
import { FlagSwitch } from '../FeatureAccessContext'

const RewriteFields = ({ settings, updateSetting }) => {
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('text-textSecondary');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const validateUrl = async () => {
      const url = settings.articleUrlToRewrite;

      if (!url || !url.startsWith('http')) {
        setStatusText('');
        return;
      }

      setIsValidating(true);
      setStatusText('Validating article URL...');
      setStatusColor('text-textSecondary');

      try {
        const res = await fetch('/api/article-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const data = await res.json();

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
          setStatusText('Failed to fetch article data. Check URL or try another.');
          setStatusColor('text-error');
        }
      } catch (error) {
        setStatusText('Error connecting to the validation service.');
        setStatusColor('text-error');
      } finally {
        setIsValidating(false);
      }
    };

    const timeoutId = setTimeout(() => {
      validateUrl();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [settings.articleUrlToRewrite]);

  return (
  <>
    <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>Article URL to Rewrite</Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://example.com/article'
          value={settings.articleUrlToRewrite || ''}
          onChange={(e) => updateSetting('articleUrlToRewrite', e.target.value)}
          InputProps={{
            endAdornment: isValidating ? <CircularProgress size={20} color="inherit" /> : null,
          }}
        />
        {statusText && (
          <Typography variant='caption' className={`mt-1 block ${statusColor}`}>
            {statusText}
          </Typography>
        )}
      </Grid>

      {/* 2. TARGET KEYWORD */}
      <Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword (Optional)</Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='e.g. best running shoes for flat feet'
          value={settings.targetKeyword || ''}
          onChange={(e) => updateSetting('targetKeyword', e.target.value)}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>Article Length</Typography>
        <FormControl fullWidth size='small' className={settings.articleLength === 'custom' ? 'mbe-3' : ''}>
          <Select
            value={settings.articleLength || 'default'}
            onChange={(e) => updateSetting('articleLength', e.target.value)}
          >
            <MenuItem value='default'>Default (match source)</MenuItem>
            <MenuItem value='custom'>Custom Number of Sections</MenuItem>
            <MenuItem value='shorter'>Shorter (2-3 Sections)</MenuItem>
            <MenuItem value='short'>Short (3-5 Sections)</MenuItem>
            <MenuItem value='medium'>Medium (5-7 Sections)</MenuItem>
            <MenuItem value='long'>Long Form (7-10 Sections)</MenuItem>
            <MenuItem value='longer'>Longer (10-12 Sections)</MenuItem>
          </Select>
        </FormControl>
        {settings.articleLength === 'custom' ? (
          <TextField
            fullWidth
            size='small'
            type='number'
            label='Number of sections'
            value={settings.customSectionCount || ''}
            onChange={(e) => updateSetting('customSectionCount', e.target.value)}
          />
        ) : null}
      </Grid>


    {/* <Grid size={{ xs: 12 }}>
      <FormControlLabel control={<Switch checked={settings.enableRewriting} onChange={(e) => updateSetting('enableRewriting', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable Rewriting</Typography>} />
    </Grid> */}

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
     <Grid size={{ xs: 12, sm: settings.aiImagesAndVideos === 'auto' ? 4 : 6 }}>
          <Typography variant='subtitle2' className='font-medium mbe-1'>Royalty Free Images & YouTube Videos</Typography>
          <FormControl fullWidth size='small' className={settings.aiImagesAndVideos.startsWith('upload') ? 'mbe-3' : ''}>
            <Select
              value={settings.aiImagesAndVideos}
              onChange={(e) => updateSetting('aiImagesAndVideos', e.target.value)}
            >
              <MenuItem value='none'>None</MenuItem>
              <MenuItem value='auto'>Royalty Free Images & Videos</MenuItem>
              <MenuItem disabled>──────────</MenuItem>
              <MenuItem value='upload-images'>Upload Custom Images</MenuItem>
              {/* <MenuItem value='upload-videos'>Upload Custom Videos</MenuItem>
              <MenuItem value='upload-both'>Upload Both Images & Videos</MenuItem> */}
            </Select>
          </FormControl>
        </Grid>

       {settings.aiImagesAndVideos === 'auto' && (
  <>
    <Grid size={{ xs: 12, sm: 2 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        Image Limit
      </Typography>
      <TextField
        fullWidth
        type="number"
        size='small'
        placeholder="No limit"
        value={settings.numberOfImages || ''}
        onChange={(e) => updateSetting('numberOfImages', e.target.value)}
      />
    </Grid>

    <Grid size={{ xs: 12, sm: 2 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        YT Video Limit
      </Typography>
      <TextField
        fullWidth
        type="number"
        size='small'
        placeholder="No limit"
        value={settings.numberOfYoutubeVideos || ''}
        onChange={(e) => updateSetting('numberOfYoutubeVideos', e.target.value)}
      />
    </Grid>
  </>
)}

   <Grid size={{ xs: 12, sm: settings.aiImagesAndVideos === 'auto' ? 4 : 6 }}>
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
            <MenuItem value='search'>Default (Web)</MenuItem>
            <MenuItem value='news'>Google News</MenuItem>
            <MenuItem value='scholar'>Google Scholar</MenuItem>
          </Select>
        </FormControl>
      )}
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <FlagSwitch featureKey='automatic-external-links' checked={settings.automaticExternalLinks} onChange={value => updateSetting('automaticExternalLinks', value)} label='Automatic External Links' />
      <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
        Finds and embeds highly relevant, authoritative outbound links via Google Search.
      </Typography>
    </Grid>

      <FlagSwitch featureKey='outline-editor' checked={settings.useOutlineEditor} onChange={value => updateSetting('useOutlineEditor', value)} label='Use Outline Editor' />
      <FlagSwitch featureKey='include-faq' checked={settings.includeFaq} onChange={value => updateSetting('includeFaq', value)} label='Include FAQ Section' />
      <FlagSwitch featureKey='include-key-takeaways' checked={settings.includeKeyTakeaways} onChange={value => updateSetting('includeKeyTakeaways', value)} label='Include Key Takeaways' />
      <FlagSwitch featureKey='improve-readability' checked={settings.improveReadability} onChange={value => updateSetting('improveReadability', value)} label='Improve Readability' />
    </Grid>
  </>
)

}
export default RewriteFields

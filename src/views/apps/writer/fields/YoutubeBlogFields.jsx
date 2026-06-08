import { useState, useEffect } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'

const YoutubeBlogFields = ({ settings, updateSetting }) => {
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('text-textSecondary');
  const [isValidating, setIsValidating] = useState(false);

  // Auto-validate YouTube URL when it changes
  useEffect(() => {
    const validateUrl = async () => {
      const url = settings.youtubeUrl;
      if (!url || !url.includes('youtu')) {
        setStatusText('');
        return;
      }

      setIsValidating(true);
      setStatusText('Connecting to YouTube...');
      setStatusColor('text-textSecondary');

      try {
        const res = await fetch('/api/youtube-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (data.success) {
          setStatusText(`✓ Success: Linked to "${data.title}"`);
          setStatusColor('text-success'); // Tailwind green class
          // Auto-fill the target keyword with the video title if it's empty!
          if (!settings.targetKeyword) updateSetting('targetKeyword', data.title);
        } else {
          setStatusText(`✕ Error: ${data.error}`);
          setStatusColor('text-error'); // Tailwind red class
        }
      } catch (error) {
        setStatusText('✕ Error connecting to validation server.');
        setStatusColor('text-error');
      } finally {
        setIsValidating(false);
      }
    };

    // Debounce the check so it doesn't fire on every single keystroke
    const timeoutId = setTimeout(validateUrl, 800);
    return () => clearTimeout(timeoutId);
  }, [settings.youtubeUrl]);

  return (
  <>
<Grid size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>YouTube URL</Typography>
        <TextField
          fullWidth
          size='small'
          placeholder='https://youtube.com/watch?v=...'
          value={settings.youtubeUrl}
          onChange={(e) => updateSetting('youtubeUrl', e.target.value)}
          error={statusColor === 'text-error'}
        />
        {/* Dynamic Status Text */}
        <div className='mt-2 flex items-center gap-2 min-h-[24px]'>
          {isValidating && <CircularProgress size={14} color="inherit" />}
          <Typography variant='caption' className={`font-medium ${statusColor}`}>
            {statusText}
          </Typography>
        </div>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <div className='flex flex-col'>
          <FormControlLabel
            control={<Switch checked={settings.enableCaptionRewriting} onChange={(e) => updateSetting('enableCaptionRewriting', e.target.checked)} />}
            label={<Typography className='font-medium text-textPrimary'>Directly Rewrite Captions</Typography>}
          />
          <Typography variant='caption' className='text-textSecondary ml-10 -mt-2'>
            If ON, the AI acts like a transcriber formatting spoken words into an article.
          </Typography>
        </div>
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
      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={(e) => updateSetting('useOutlineEditor', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={(e) => updateSetting('improveReadability', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />
    </Grid>
  </>
)
}
export default YoutubeBlogFields

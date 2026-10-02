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
import { useEffect } from 'react'

const AmazonRoundupFields = ({ settings, updateSetting }) => {
  useEffect(() => {
    if (settings.amazonSearchUrl) {
      try {
        const url = new URL(settings.amazonSearchUrl)
        const keyword = url.searchParams.get('k') || url.searchParams.get('field-keywords')
        if (keyword && keyword !== settings.targetKeyword) updateSetting('targetKeyword', keyword)
        if (url.hostname && url.hostname.replace(/^www\./, '') !== settings.amazonDomain) updateSetting('amazonDomain', url.hostname.replace(/^www\./, ''))
      } catch (error) {}
    }
  }, [settings.amazonSearchUrl, settings.targetKeyword, settings.amazonDomain, settings.amazonTrackingId, updateSetting])

  return <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' value={settings.targetKeyword} onChange={event => updateSetting('targetKeyword', event.target.value)} />
    </Grid>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Search URL (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='https://amazon.com/s?k=...' value={settings.amazonSearchUrl} onChange={event => updateSetting('amazonSearchUrl', event.target.value)} />
    </Grid>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Automatic Internal Linking</Typography>
      <FormControl fullWidth size='small' className='mbe-3'>
        <Select multiple value={Array.isArray(settings.internalLinking) ? settings.internalLinking : []} onChange={event => updateSetting('internalLinking', typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} input={<OutlinedInput size='small' />} renderValue={selected => <div className='flex flex-wrap gap-1'>{selected.map(value => <Chip key={value} label={value} size='small' className='h-6' />)}</div>}>
          {clientSites.map(site => <MenuItem key={site} value={site}><Checkbox checked={Array.isArray(settings.internalLinking) && settings.internalLinking.includes(site)} /><ListItemText primary={site} /></MenuItem>)}
        </Select>
      </FormControl>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Custom URLs (Comma Separated)</Typography>
      <TextField fullWidth size='small' placeholder='https://site1.com, https://site2.com' value={settings.customInternalLink || ''} onChange={event => updateSetting('customInternalLink', event.target.value)} />
    </Grid>
    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Number of Products</Typography>
      <TextField fullWidth type='number' size='small' value={settings.numberOfProducts} onChange={event => updateSetting('numberOfProducts', event.target.value)} />
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Roundup Layout</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.roundupLayout || 'table'} onChange={event => updateSetting('roundupLayout', event.target.value)}>
          <MenuItem value='table'>Product Table</MenuItem>
          <MenuItem value='top-pick'>Top Pick</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Tracking ID (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='your-tag-20' value={settings.amazonTrackingId} onChange={event => updateSetting('amazonTrackingId', event.target.value)} />
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Domain</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.amazonDomain} onChange={event => updateSetting('amazonDomain', event.target.value)}>
          {['amazon.ae','amazon.com','amazon.com.au','amazon.com.be','amazon.com.br','amazon.ca','amazon.cn','amazon.de','amazon.eg','amazon.es','amazon.fr','amazon.in','amazon.it','amazon.co.jp','amazon.com.mx','amazon.nl','amazon.pl','amazon.sa','amazon.sg','amazon.se','amazon.com.tr','amazon.co.uk'].map(domain => <MenuItem key={domain} value={domain}>{domain}</MenuItem>)}
        </Select>
      </FormControl>
      {settings.articleLength === 'custom' ? <TextField fullWidth type='number' size='small' label='Custom Section Count' value={settings.customArticleLength || ''} inputProps={{ min: 1, max: 48 }} onChange={event => updateSetting('customArticleLength', Math.min(48, Math.max(1, Number(event.target.value) || 1)))} sx={{ mt: 2 }} /> : null}
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Tone of Voice</Typography>
      <FormControl fullWidth size='small'><Select value={settings.toneOfVoice} onChange={event => updateSetting('toneOfVoice', event.target.value)}>{['seo','excited','professional','friendly','formal','casual','humorous','custom'].map(tone => <MenuItem key={tone} value={tone}>{tone}</MenuItem>)}</Select></FormControl>
      {settings.toneOfVoice === 'custom' ? <TextField fullWidth size='small' label='Custom Tone' value={settings.customToneOfVoice || ''} onChange={event => updateSetting('customToneOfVoice', event.target.value)} sx={{ mt: 2 }} /> : null}
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Language</Typography>
      <FormControl fullWidth size='small'><Select value={settings.language} onChange={event => updateSetting('language', event.target.value)}>{languages.map(lang => <MenuItem key={lang.code} value={lang.code}>{lang.name}</MenuItem>)}</Select></FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Country</Typography>
      <FormControl fullWidth size='small'><Select value={settings.country} onChange={event => updateSetting('country', event.target.value)}>{countries.map(country => <MenuItem key={country.code} value={country.code}>{country.name}</MenuItem>)}</Select></FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Point of View</Typography>
      <FormControl fullWidth size='small'><Select value={settings.pointOfView} onChange={event => updateSetting('pointOfView', event.target.value)}><MenuItem value='first'>First Person (I, me, my)</MenuItem><MenuItem value='first-plural'>First Person Plural (We, us, our)</MenuItem><MenuItem value='second'>Second Person (You, your)</MenuItem><MenuItem value='third'>Third Person (he, she, it, they)</MenuItem></Select></FormControl>
    </Grid>
    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>
    <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
      <FormControlLabel control={<Switch checked={settings.enableFirstHandExperience} onChange={event => updateSetting('enableFirstHandExperience', event.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />
      <FormControlLabel control={<Switch checked={settings.automaticExternalLinks} onChange={event => updateSetting('automaticExternalLinks', event.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Automatic External Links</Typography>} />
      <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>Finds and embeds highly relevant, authoritative outbound links via Google Search.</Typography>
      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={event => updateSetting('useOutlineEditor', event.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch checked={settings.includeFaq} onChange={event => updateSetting('includeFaq', event.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={event => updateSetting('improveReadability', event.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />
    </Grid>
  </>
}

export default AmazonRoundupFields

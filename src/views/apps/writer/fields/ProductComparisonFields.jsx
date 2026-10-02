import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormHelperText from '@mui/material/FormHelperText'

const ProductComparisonFields = ({ settings, updateSetting }) => {
  const links = Array.isArray(settings.productComparisonUrls) ? settings.productComparisonUrls : ['', '', '']
  const validLinkCount = links.filter(value => {
    try {
      return ['http:', 'https:'].includes(new URL(String(value || '').trim()).protocol)
    } catch {
      return false
    }
  }).length

  const updateLink = (index, value) => {
    const next = [...links]
    next[index] = value
    updateSetting('productComparisonUrls', next)
  }

  return <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Comparison Topic</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best hiking baby carriers' value={settings.targetKeyword || ''} onChange={event => updateSetting('targetKeyword', event.target.value)} />
    </Grid>
    {links.map((link, index) => {
      let invalid = false
      if (link) {
        try { invalid = !['http:', 'https:'].includes(new URL(String(link).trim()).protocol) } catch { invalid = true }
      }

      return <Grid key={index} size={{ xs: 12 }}>
        <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Product URL {index + 1}{index < 2 ? ' (Required)' : ' (Optional)'}</Typography>
        <TextField fullWidth size='small' type='url' required={index < 2} error={invalid} helperText={invalid ? 'Enter a valid http(s) URL.' : index < 2 && validLinkCount < 2 ? 'Two valid product URLs are required.' : ' '} placeholder='https://www.amazon.com/dp/…' value={link || ''} onChange={event => updateLink(index, event.target.value)} />
      </Grid>
    })}
    <Grid size={{ xs: 12 }}>
      <FormHelperText>Paste 2 Amazon links (required) and a third if needed. Affiliate tags are kept.</FormHelperText>
    </Grid>
  </>
}

export default ProductComparisonFields

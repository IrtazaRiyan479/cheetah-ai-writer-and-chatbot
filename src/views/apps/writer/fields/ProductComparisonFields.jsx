import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const ProductComparisonFields = ({ settings, updateSetting }) => {
  const links = Array.isArray(settings.productComparisonUrls) ? settings.productComparisonUrls : ['', '', '']

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
    {links.map((link, index) => <Grid key={index} size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Product URL {index + 1}{index < 2 ? ' (Required)' : ' (Optional)'}</Typography>
      <TextField fullWidth size='small' type='url' required={index < 2} placeholder='https://www.amazon.com/dp/…' value={link || ''} onChange={event => updateLink(index, event.target.value)} />
    </Grid>)}
  </>
}

export default ProductComparisonFields

import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'

const AmazonRoundupFields = () => (
  <>
    {/* Top Section */}
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' />
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Search URL</Typography>
      <TextField fullWidth size='small' placeholder='https://amazon.com/s?k=...' />
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Automatic Internal Linking</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='unselected'>
          <MenuItem value='unselected'>Unselected</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Number of Products</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='auto'>
          <MenuItem value='auto'>Auto</MenuItem>
          <MenuItem value='5'>5</MenuItem>
          <MenuItem value='10'>10</MenuItem>
          <MenuItem value='15'>15</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12 }}>
      <div className='flex flex-col'>
        <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Enable Amazon Search</Typography>} />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Enable to get accurate, up-to-date pricing and product info. (Highly Recommended)
        </Typography>
      </div>
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Tracking ID (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='your-tag-20' />
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Amazon Domain</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='com'>
          <MenuItem value='com'>amazon.com</MenuItem>
          <MenuItem value='co.uk'>amazon.co.uk</MenuItem>
          <MenuItem value='ca'>amazon.ca</MenuItem>
          <MenuItem value='de'>amazon.de</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    {/* Settings Section */}
    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Tone of Voice</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='seo'>
          <MenuItem value='seo'>SEO Optimized (Confident, Knowledgeable...)</MenuItem>
          <MenuItem value='excited'>Excited</MenuItem>
          <MenuItem value='professional'>Professional</MenuItem>
          <MenuItem value='friendly'>Friendly</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Language</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='en-us'>
          <MenuItem value='en-us'>English (US)</MenuItem>
          <MenuItem value='en-uk'>English (UK)</MenuItem>
          <MenuItem value='es'>Spanish</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Point of View</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='third'>
          <MenuItem value='first'>First Person (I, me, my)</MenuItem>
          <MenuItem value='second'>Second Person (You, your)</MenuItem>
          <MenuItem value='third'>Third Person (he, she, it, they)</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    {/* Toggles Section */}
    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12 }} className='flex flex-col gap-2'>
      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Use Real-Time Search Data</Typography>} />

      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>Real-Time Data Source</Typography>
            <FormControl fullWidth size='small'>
              <Select defaultValue='default'>
                <MenuItem value='default'>Default</MenuItem>
                <MenuItem value='news'>Google News</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>

      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Enable Supplemental Information</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Include Key Takeaways</Typography>} />
      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />
    </Grid>
  </>
)

export default AmazonRoundupFields

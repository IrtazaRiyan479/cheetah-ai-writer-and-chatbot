import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'

const LocalRoundupFields = () => (
  <>
    {/* Top Section */}
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Location</Typography>
      <TextField fullWidth size='small' placeholder='e.g. San Diego, California' />
      <Typography variant='caption' color='text.secondary' className='mt-1 block'>
        Enable Real-Time Search below to get accurate, up-to-date information.
      </Typography>
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword (Optional)</Typography>
      <TextField fullWidth size='small' placeholder='e.g. best running shoes for flat feet' />
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Number of Places</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='auto'>
          <MenuItem value='auto'>Auto</MenuItem>
          <MenuItem value='5'>5</MenuItem>
          <MenuItem value='10'>10</MenuItem>
          <MenuItem value='15'>15</MenuItem>
          <MenuItem value='20'>20</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Automatic Internal Linking</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='unselected'>
          <MenuItem value='unselected'>Unselected</MenuItem>
        </Select>
      </FormControl>
    </Grid>

    {/* Settings Section */}
    <Grid size={{ xs: 12 }}><Divider className='my-2' /></Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>AI Images & YouTube Videos</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='none'>
          <MenuItem value='none'>None</MenuItem>
          <MenuItem value='images'>Auto-Insert AI Images</MenuItem>
          <MenuItem value='videos'>Auto-Insert YouTube Videos</MenuItem>
          <MenuItem value='both'>Both Images & Videos</MenuItem>
        </Select>
      </FormControl>
    </Grid>

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
      <Typography variant='subtitle2' className='font-medium mbe-1'>Country</Typography>
      <FormControl fullWidth size='small'>
        <Select defaultValue='us'>
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

      <div className='flex flex-col'>
        <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Automatic External Links</Typography>} />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Automatically adds helpful links to reputable external sources.
        </Typography>
      </div>

      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Use Real-Time Search Data</Typography>} />

      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>Real-Time Data Source</Typography>
            <FormControl fullWidth size='small'>
              <Select defaultValue='web'>
                <MenuItem value='web'>Web</MenuItem>
                <MenuItem value='scholar'>Google Scholar</MenuItem>
                <MenuItem value='news'>Google News</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>

      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />

      <div className='flex flex-col'>
        <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Generate Unique Map Images</Typography>} />
        <Typography variant='caption' color='text.secondary' className='ml-[42px] -mt-1 block mbe-2'>
          Generates map images plotting the places mentioned in the article. Takes ~1-2 extra credits.
        </Typography>
      </div>

      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Enable Supplemental Information</Typography>} />
      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Enable Automatic Length</Typography>} />
      <FormControlLabel control={<Switch />} label={<Typography className='font-medium text-textPrimary'>Use Descending Order</Typography>} />

      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>List Numbering Format</Typography>
            <FormControl fullWidth size='small'>
              <Select defaultValue='1.'>
                <MenuItem value='1)'>1), 2), 3)</MenuItem>
                <MenuItem value='1.'>1., 2., 3.</MenuItem>
                <MenuItem value='1:'>1:, 2:, 3:</MenuItem>
                <MenuItem value='none'>None</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>

      <FormControlLabel control={<Switch defaultChecked />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />

    </Grid>
  </>
)

export default LocalRoundupFields

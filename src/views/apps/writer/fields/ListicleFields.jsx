import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'

const ListicleFields = ({ settings, updateSetting }) => (
  <>
    <Grid size={{ xs: 12 }}>
      <Typography variant='subtitle2' className='font-medium mbe-1'>Target Keyword</Typography>
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
      <Typography variant='subtitle2' className='font-medium mbe-1'>Total List Items</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.totalListItems} onChange={(e) => updateSetting('totalListItems', e.target.value)}>
          <MenuItem value='auto'>Auto</MenuItem>
          <MenuItem value='5'>5</MenuItem>
          <MenuItem value='10'>10</MenuItem>
          <MenuItem value='15'>15</MenuItem>
        </Select>
      </FormControl>
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
      <Typography variant='subtitle2' className='font-medium mbe-1'>AI Images & YouTube Videos</Typography>
      <FormControl fullWidth size='small'>
        <Select value={settings.aiImagesAndVideos} onChange={(e) => updateSetting('aiImagesAndVideos', e.target.value)}>
          <MenuItem value='none'>None</MenuItem>
          <MenuItem value='images'>Auto-Insert AI Images</MenuItem>
          <MenuItem value='videos'>Auto-Insert YouTube Videos</MenuItem>
          <MenuItem value='both'>Both Images & Videos</MenuItem>
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
      <FormControlLabel control={<Switch checked={settings.automaticExternalLinks} onChange={(e) => updateSetting('automaticExternalLinks', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Automatic External Links</Typography>} />
      <FormControlLabel control={<Switch checked={settings.citeSources} onChange={(e) => updateSetting('citeSources', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Cite Sources</Typography>} />

      <FormControlLabel control={<Switch checked={settings.useRealTimeSearchData} onChange={(e) => updateSetting('useRealTimeSearchData', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Real-Time Search Data</Typography>} />
      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>Real-Time Data Source</Typography>
            <FormControl fullWidth size='small'>
              <Select value={settings.realTimeDataSource === 'default' ? 'default' : settings.realTimeDataSource} onChange={(e) => updateSetting('realTimeDataSource', e.target.value)} disabled={!settings.useRealTimeSearchData}>
                <MenuItem value='default'>Default</MenuItem>
                <MenuItem value='news'>Google News</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </div>

      <FormControlLabel control={<Switch checked={settings.useOutlineEditor} onChange={(e) => updateSetting('useOutlineEditor', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Outline Editor</Typography>} />
      <FormControlLabel control={<Switch checked={settings.deepSearch} onChange={(e) => updateSetting('deepSearch', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Deep Search (Beta)</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableFirstHandExperience} onChange={(e) => updateSetting('enableFirstHandExperience', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable First-Hand Experience</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableSupplementalInformation} onChange={(e) => updateSetting('enableSupplementalInformation', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable Supplemental Information</Typography>} />
      <FormControlLabel control={<Switch checked={settings.enableAutomaticLength} onChange={(e) => updateSetting('enableAutomaticLength', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Enable Automatic Length</Typography>} />
      <FormControlLabel control={<Switch checked={settings.includeFaq} onChange={(e) => updateSetting('includeFaq', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include FAQ Section</Typography>} />
      <FormControlLabel control={<Switch checked={settings.includeKeyTakeaways} onChange={(e) => updateSetting('includeKeyTakeaways', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Include Key Takeaways</Typography>} />
      <FormControlLabel control={<Switch checked={settings.improveReadability} onChange={(e) => updateSetting('improveReadability', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Improve Readability</Typography>} />

      <FormControlLabel control={<Switch checked={settings.useDescendingOrder} onChange={(e) => updateSetting('useDescendingOrder', e.target.checked)} />} label={<Typography className='font-medium text-textPrimary'>Use Descending Order</Typography>} />
      <div className='pl-[42px] pr-4 mbe-2 mt-1'>
        <Grid container>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='font-medium mbe-1'>List Numbering Format</Typography>
            <FormControl fullWidth size='small'>
              <Select value={settings.listNumberingFormat} onChange={(e) => updateSetting('listNumberingFormat', e.target.value)}>
                <MenuItem value='1)'>1), 2), 3)</MenuItem>
                <MenuItem value='1.'>1., 2., 3.</MenuItem>
                <MenuItem value='1:'>1:, 2:, 3:</MenuItem>
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

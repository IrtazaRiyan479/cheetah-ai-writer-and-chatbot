'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

const ProductPricing = () => {
  const [model, setModel] = useState('gpt-4o')
  const [preset, setPreset] = useState('default')

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>
        <Grid container spacing={5} alignItems='flex-end'>

          {/* 1. AI Model Selection */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='mbe-2 font-medium'>
              AI Model
            </Typography>
            <FormControl fullWidth size='small'>
              <Select value={model} onChange={e => setModel(e.target.value)}>
                <MenuItem value='gpt-3.5-turbo'>GPT-3.5 Turbo (Fastest)</MenuItem>
                <MenuItem value='gpt-4o'>GPT-4o (Best Quality)</MenuItem>
                <MenuItem value='claude-3-5-sonnet'>Claude 3.5 Sonnet</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* 2. Preset Selection & Save Button */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='mbe-2 font-medium'>
              Project / Preset
            </Typography>
            <div className='flex items-center gap-2'>
              <FormControl fullWidth size='small'>
                <Select value={preset} onChange={e => setPreset(e.target.value)}>
                  <MenuItem value='default'>Default Settings</MenuItem>
                  <MenuItem value='tech-blog'>Tech Blog Template</MenuItem>
                  <MenuItem value='amazon-review'>Amazon Review Tone</MenuItem>
                </Select>
              </FormControl>

              <Tooltip title='Save current settings as new preset'>
                <Button variant='tonal' color='primary' className='min-is-fit px-3'>
                  <i className='ri-save-line text-lg' />
                </Button>
              </Tooltip>
            </div>
          </Grid>

        </Grid>
      </CardContent>
    </Card>
  )
}

export default ProductPricing

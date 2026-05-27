'use client'

// React Imports
import { useState } from 'react'

// Next.js Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'

const availableModels = [
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash', isPaid: false },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite', isPaid: false },
  { label: 'Gemini 3.1 Pro ⭐', value: 'gemini-3.1-pro-preview-customtools', isPaid: true },
  { label: 'GPT-5.2 ⭐', value: 'gemini-2.5-pro', isPaid: true },
  { label: 'GPT-5 Mini', value: 'gemini-2.5-flash', isPaid: false }, // Mapped to fastest free option
  { label: 'Claude 4.5 Sonnet ⭐', value: 'gemini-3.1-pro-preview', isPaid: true }
]

const ProductPricing = ({ selectedModel, setSelectedModel }) => {
  const [preset, setPreset] = useState('default')

  // Initialize Router for redirects
  const router = useRouter()
  const params = useParams()
  const lang = params.lang || 'en' // Automatically grabs the current language route

  // Handle Model Selection
  const handleModelChange = (e) => {
    const selectedValue = e.target.value
    const targetModel = availableModels.find(m => m.value === selectedValue)

    // If it's a paid model, redirect! Otherwise, select it.
    if (targetModel?.isPaid) {
      router.push(`/${lang}/pricing`)
    } else {
      setSelectedModel(selectedValue)
    }
  }

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>
        <Grid container spacing={5} alignItems='flex-end'>

          {/* AI Model Selection */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='mbe-2 font-medium'>
              AI Model
            </Typography>
            <FormControl fullWidth size='small'>
              <Select
                value={selectedModel || 'gemini-3.1-flash-lite'}
                onChange={handleModelChange}
              >
                {availableModels.map((model) => (
                  <MenuItem
                    key={model.value}
                    value={model.value}
                    // Removed 'disabled', added styling to make it look premium
                    className={model.isPaid ? 'bg-amber-50/30 hover:bg-amber-100/50' : ''}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{model.label}</span>
                      {model.isPaid && (
                        <Typography variant="caption" color="warning" className="ml-2 border border-warning rounded px-1.5 py-0.5 bg-warning/10 font-bold">
                          Upgrade
                        </Typography>
                      )}
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Preset Selection */}
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

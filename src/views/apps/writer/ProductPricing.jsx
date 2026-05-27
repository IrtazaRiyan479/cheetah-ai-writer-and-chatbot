'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import DialogContentText from '@mui/material/DialogContentText'
import TextField from '@mui/material/TextField'

const availableModels = [
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash', isPaid: false },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite', isPaid: false },
  { label: 'Gemini 3.1 Pro ⭐', value: 'gemini-3.1-pro-preview-customtools', isPaid: true },
  { label: 'GPT-5.2 ⭐', value: 'gemini-2.5-pro', isPaid: true },
  { label: 'GPT-5 Mini', value: 'gemini-2.5-flash', isPaid: false },
  { label: 'Claude 4.5 Sonnet ⭐', value: 'gemini-3.1-pro-preview', isPaid: true }
]

const ProductPricing = ({
  settings, updateSetting, presets, selectedPresetId,
  onLoadPreset, onCreatePreset, onUpdatePreset, onDeletePreset
}) => {
  const router = useRouter()
  const params = useParams()
  const lang = params.lang || 'en'

  // Dialog States
  const [openCreate, setOpenCreate] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  const handleModelChange = (e) => {
    const val = e.target.value
    const targetModel = availableModels.find(m => m.value === val)
    if (targetModel?.isPaid) {
      router.push(`/${lang}/pricing`)
    } else {
      updateSetting('model', val)
    }
  }

  const submitCreate = () => {
    if (newPresetName.trim()) {
      onCreatePreset(newPresetName)
      setNewPresetName('')
      setOpenCreate(false)
    }
  }

  const submitDelete = () => {
    onDeletePreset()
    setOpenDelete(false)
  }

  return (
    <>
      <Card className='shadow-sm'>
        <CardContent className='p-4 sm:p-6'>
          <Grid container spacing={5} alignItems='flex-end'>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='subtitle2' className='mbe-2 font-medium'>AI Model</Typography>
              <FormControl fullWidth size='small'>
                <Select value={settings.model} onChange={handleModelChange}>
                  {availableModels.map((model) => (
                    <MenuItem key={model.value} value={model.value} className={model.isPaid ? 'bg-amber-50/30' : ''}>
                      <div className="flex justify-between items-center w-full">
                        <span>{model.label}</span>
                        {model.isPaid && <Typography variant="caption" color="warning" className="ml-2 border border-warning rounded px-1.5 py-0.5 bg-warning/10 font-bold">Upgrade</Typography>}
                      </div>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='subtitle2' className='mbe-2 font-medium'>Project / Preset</Typography>
              <div className='flex items-center gap-2'>
                <FormControl fullWidth size='small'>
                  <Select value={selectedPresetId} onChange={(e) => onLoadPreset(e.target.value)}>
                    <MenuItem value='default'>Default Settings</MenuItem>
                    {presets.map(p => (
                      <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* The Action Buttons */}
                <Tooltip title='Create New Preset'>
                  <IconButton onClick={() => setOpenCreate(true)} color='primary' className='bg-primary/10 rounded'>
                    <i className='ri-add-line' />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Save Current State'>
                  <IconButton onClick={onUpdatePreset} disabled={selectedPresetId === 'default'} color='success' className='bg-success/10 rounded disabled:opacity-50'>
                    <i className='ri-save-line' />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Delete Preset'>
                  <IconButton onClick={() => setOpenDelete(true)} disabled={selectedPresetId === 'default'} color='error' className='bg-error/10 rounded disabled:opacity-50'>
                    <i className='ri-delete-bin-7-line' />
                  </IconButton>
                </Tooltip>
              </div>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* CREATE PRESET DIALOG */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create New Preset</DialogTitle>
        <DialogContent>
          <DialogContentText className='mbe-3'>
            Enter a name for your preset. This will save all your current settings and toggles.
          </DialogContentText>
          <TextField
            autoFocus fullWidth size="small" label='Preset Name'
            value={newPresetName} onChange={e => setNewPresetName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} color='secondary'>Cancel</Button>
          <Button onClick={submitCreate} variant='contained' disabled={!newPresetName.trim()}>Save Preset</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE PRESET DIALOG */}
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle>Delete Preset?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this preset? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)} color='secondary'>Cancel</Button>
          <Button onClick={submitDelete} variant='contained' color='error'>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ProductPricing

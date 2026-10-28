'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

export default function LimitsPanel() {
  const [value, setValue] = useState('')
  const [freeSites, setFreeSites] = useState('1')
  const [proSites, setProSites] = useState('7')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error || 'Could not load limits.')
      setValue(String(data.stats.globalFreeWordCap))
      if (data.stats.websiteLimits) {
        setFreeSites(String(data.stats.websiteLimits.free))
        setProSites(String(data.stats.websiteLimits.pro))
      }
    }).catch(caught => setError(caught.message || 'Could not load limits.'))
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/stats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalFreeWordCap: Number(value),
          websiteLimits: { free: Number(freeSites), pro: Number(proSites) }
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save limits.')
      toast.success('Limits saved.')
    } catch (caught) { toast.error(caught.message || 'Could not save limits.') } finally { setBusy(false) }
  }

  return <Box sx={{ display: 'grid', gap: 2.5, maxWidth: 720 }}>
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant='h6' sx={{ mb: 1, fontWeight: 800 }}>Global free word cap</Typography>
      <Typography color='text.secondary' sx={{ mb: 2 }}>Generation stays a word count, not an article count. This is the permanent signup trial. A per-user word limit replaces it. Bought words never expire.</Typography>
      {error ? <Typography color='error' sx={{ mb: 2 }}>{error}</Typography> : null}
      <TextField type='number' label='Words' value={value} onChange={event => setValue(event.target.value)} inputProps={{ min: 0, step: 1 }} />
    </Paper>
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant='h6' sx={{ mb: 1, fontWeight: 800 }}>Websites a plan can add</Typography>
      <Typography color='text.secondary' sx={{ mb: 2 }}>Defaults when a user has no custom website allowance. Price table: Starter 1, Growth 3, Pro 5–7. Set those on the user after you confirm the WhatsApp screenshot. Max and admin stay unlimited.</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField type='number' label='Free / unpaid sites' value={freeSites} onChange={event => setFreeSites(event.target.value)} inputProps={{ min: 0, step: 1 }} />
        <TextField type='number' label='Pro sites' value={proSites} onChange={event => setProSites(event.target.value)} inputProps={{ min: 0, step: 1 }} helperText='Use 7 unless you set Starter or Growth on the user.' />
        <TextField label='Max sites' value='Unlimited' disabled />
      </Box>
    </Paper>
    <Button variant='contained' onClick={save} disabled={busy || value === '' || freeSites === '' || proSites === ''} sx={{ justifySelf: 'start' }}>{busy ? <CircularProgress size={20} color='inherit' /> : 'Save limits'}</Button>
  </Box>
}
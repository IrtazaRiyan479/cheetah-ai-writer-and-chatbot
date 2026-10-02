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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error || 'Could not load global word cap.')
      setValue(String(data.stats.globalFreeWordCap))
    }).catch(caught => setError(caught.message || 'Could not load global word cap.'))
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/stats', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ globalFreeWordCap: Number(value) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save global word cap.')
      toast.success('Global word cap saved.')
    } catch (caught) { toast.error(caught.message || 'Could not save global word cap.') } finally { setBusy(false) }
  }

  return <Paper variant='outlined' sx={{ maxWidth: 560, p: 3, borderRadius: 3 }}>
    <Typography variant='h6' sx={{ mb: 1 }}>Global free word cap</Typography>
    <Typography color='text.secondary' sx={{ mb: 2 }}>Used as the fallback when a user has no individual limit.</Typography>
    {error ? <Typography color='error' sx={{ mb: 2 }}>{error}</Typography> : null}
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}><TextField type='number' label='Words' value={value} onChange={event => setValue(event.target.value)} inputProps={{ min: 0, step: 1 }} /><Button variant='contained' onClick={save} disabled={busy || value === ''}>{busy ? <CircularProgress size={20} color='inherit' /> : 'Save cap'}</Button></Box>
  </Paper>
}

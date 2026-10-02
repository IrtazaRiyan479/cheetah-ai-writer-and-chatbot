'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

export default function UnlockGate() {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unlock = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/admin/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Unable to unlock admin console.')
      window.location.reload()
    } catch (caught) {
      setError(caught.message || 'Unable to unlock admin console.')
      setBusy(false)
    }
  }

  return (
    <Box component='form' onSubmit={unlock} sx={{ maxWidth: 440, mx: 'auto', mt: 10, p: 4, border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <Typography variant='h4' sx={{ mb: 1, fontWeight: 700 }}>Welcome back</Typography>
      <Typography color='text.secondary' sx={{ mb: 3 }}>This area is restricted to authorized operators. Enter your access key to continue.</Typography>
      {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
      <TextField fullWidth autoFocus type='password' label='Access key' value={key} onChange={event => setKey(event.target.value)} autoComplete='current-password' />
      <Button fullWidth type='submit' variant='contained' disabled={!key || busy} sx={{ mt: 2 }}>{busy ? 'Unlocking…' : 'Unlock'}</Button>
    </Box>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

export default function FlagsPanel() {
  const [flags, setFlags] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const response = await fetch('/api/admin/flags')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load feature flags.')
      setFlags(data.flags)
    } catch (caught) { setError(caught.message || 'Could not load feature flags.') }
  }

  useEffect(() => { load() }, [])

  const update = async (key, mode) => {
    setBusy(key)
    try {
      const response = await fetch('/api/admin/flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, mode }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update flag.')
      setFlags(items => items.map(item => item.key === key ? { ...item, mode } : item))
      toast.success('Feature flag updated.')
    } catch (caught) { toast.error(caught.message || 'Could not update flag.') } finally { setBusy('') }
  }

  if (!flags && !error) return <Skeleton variant='rounded' height={240} />

  return <Paper variant='outlined' sx={{ borderRadius: 3, overflow: 'auto' }}>
    {error ? <Typography color='error' sx={{ p: 2 }}>{error}</Typography> : null}
    {flags ? <Table size='small'><TableHead><TableRow><TableCell>Feature</TableCell><TableCell>Access</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>
      {flags.map(flag => <TableRow key={flag.key}><TableCell>{flag.key}</TableCell><TableCell><FormControl size='small' sx={{ minWidth: 120 }}><InputLabel>Mode</InputLabel><Select label='Mode' value={flag.mode} disabled={busy === flag.key} onChange={event => update(flag.key, event.target.value)}>{['free', 'pro', 'off'].map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}</Select></FormControl></TableCell><TableCell><Chip size='small' color={flag.mode === 'off' ? 'error' : flag.mode === 'free' ? 'success' : 'primary'} label={busy === flag.key ? 'Saving…' : flag.mode} /></TableCell></TableRow>)}
    </TableBody></Table> : <Button onClick={load}>Retry</Button>}
  </Paper>
}

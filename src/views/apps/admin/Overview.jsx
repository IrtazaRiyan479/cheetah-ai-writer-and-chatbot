'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function Overview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load admin stats.')
      setStats(data.stats)
    } catch (caught) { setError(caught.message || 'Could not load admin stats.') }
  }

  useEffect(() => { load() }, [])

  if (!stats && !error) return <Stack spacing={2}>{[1, 2, 3].map(item => <Skeleton key={item} variant='rounded' height={108} />)}</Stack>

  return <Box>
    {error ? <Typography color='error' role='alert'>{error}</Typography> : null}
    {stats ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      {[
        ['Users', stats.users.toLocaleString()],
        ['Users by role', Object.entries(stats.byRole || {}).map(([role, count]) => `${role} ${count}`).join(' · ') || '—'],
        ['Words used / cap', `${stats.wordsUsed.toLocaleString()} / ${stats.wordsCap.toLocaleString()}`],
        ['Flags off', <Chip key='flags' label={stats.flagsOff} color={stats.flagsOff ? 'warning' : 'success'} />]
      ].map(([label, value]) => <Paper key={label} variant='outlined' sx={{ flex: 1, p: 3, borderRadius: 3 }}><Typography color='text.secondary'>{label}</Typography><Typography variant='h6' sx={{ mt: 1 }}>{value}</Typography></Paper>)}
    </Stack> : null}
    <Button onClick={load} disabled={!stats && !error} sx={{ mt: 2 }}>{!stats && !error ? <CircularProgress size={18} /> : 'Refresh'}</Button>
  </Box>
}

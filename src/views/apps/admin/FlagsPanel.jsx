'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
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

import { FEATURE_META } from '@/libs/entitlement'

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
    } catch (caught) {
      setError(caught.message || 'Could not load feature flags.')
    }
  }

  useEffect(() => { load() }, [])

  const update = async (key, mode) => {
    setBusy(key)
    try {
      const response = await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mode })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update flag.')
      setFlags(items => items.map(item => (item.key === key ? { ...item, mode } : item)))
      toast.success('Feature flag updated.')
    } catch (caught) {
      toast.error(caught.message || 'Could not update flag.')
    } finally {
      setBusy('')
    }
  }

  const groups = useMemo(() => {
    if (!flags) return []
    const map = new Map()
    flags.forEach(flag => {
      const meta = FEATURE_META[flag.key] || { label: flag.key, group: 'Other' }
      const group = meta.group || 'Other'
      if (!map.has(group)) map.set(group, [])
      map.get(group).push({ ...flag, label: meta.label || flag.key })
    })
    return Array.from(map.entries())
  }, [flags])

  if (!flags && !error) return <Skeleton variant='rounded' height={320} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h6' sx={{ fontWeight: 700 }}>Feature access</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          Free = everyone. Pro = paid users only (paid API keys when that feature is active). Off = disabled.
        </Typography>
      </Box>
      {error ? <Typography color='error' sx={{ p: 1 }}>{error}</Typography> : null}
      {groups.map(([group, items]) => (
        <Paper key={group} variant='outlined' sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>{group}</Typography>
          </Box>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Feature</TableCell>
                <TableCell sx={{ width: 180 }}>Access</TableCell>
                <TableCell sx={{ width: 120 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(flag => (
                <TableRow key={flag.key} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {flag.mode === 'pro' ? <span title='Pro'>⭐</span> : null}
                      <Box>
                        <Typography variant='body2' sx={{ fontWeight: 600 }}>{flag.label}</Typography>
                        <Typography variant='caption' color='text.secondary'>{flag.key}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <FormControl size='small' fullWidth>
                      <InputLabel>Mode</InputLabel>
                      <Select label='Mode' value={flag.mode} disabled={busy === flag.key} onChange={event => update(flag.key, event.target.value)}>
                        {['free', 'pro', 'off'].map(mode => (
                          <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Chip size='small' color={flag.mode === 'off' ? 'error' : flag.mode === 'free' ? 'success' : 'warning'} label={busy === flag.key ? 'Saving…' : flag.mode} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ))}
      {!flags ? <Button onClick={load}>Retry</Button> : null}
    </Box>
  )
}

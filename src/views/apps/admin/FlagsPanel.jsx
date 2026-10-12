'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

import { FEATURE_META } from '@/libs/entitlement'

const modeColor = {
  free: 'success',
  pro: 'warning',
  off: 'error'
}

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

  useEffect(() => {
    load()
  }, [])

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

  if (!flags && !error) return <Skeleton variant='rounded' height={320} sx={{ borderRadius: 4 }} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h6' sx={{ fontWeight: 800 }}>
          Feature access
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, maxWidth: 720 }}>
          Free = everyone. Pro = paid users only (paid API keys when that feature is active). Off = disabled for all.
          Pro items show a golden star in the writer.
        </Typography>
      </Box>
      {error ? (
        <Typography color='error' sx={{ p: 1 }}>
          {error}
        </Typography>
      ) : null}
      {groups.map(([group, items]) => (
        <Paper
          key={group}
          elevation={0}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderBottom: 1,
              borderColor: 'divider',
              background: theme =>
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,193,7,0.08)'
            }}
          >
            <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
              {group}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((flag, index) => (
              <Box
                key={flag.key}
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                  px: 2.5,
                  py: 2,
                  borderTop: index ? 1 : 0,
                  borderColor: 'divider',
                  flexWrap: 'wrap'
                }}
              >
                <Box sx={{ minWidth: 220 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {flag.mode === 'pro' ? <span title='Pro'>⭐</span> : null}
                    <Typography variant='body1' sx={{ fontWeight: 700 }}>
                      {flag.label}
                    </Typography>
                    <Chip size='small' color={modeColor[flag.mode] || 'default'} label={flag.mode} sx={{ fontWeight: 700 }} />
                  </Box>
                  <Typography variant='caption' color='text.secondary'>
                    {flag.key}
                  </Typography>
                </Box>
                <ToggleButtonGroup
                  exclusive
                  size='small'
                  value={flag.mode}
                  disabled={busy === flag.key}
                  onChange={(_, value) => value && update(flag.key, value)}
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 1.75
                    }
                  }}
                >
                  <ToggleButton value='free'>Free</ToggleButton>
                  <ToggleButton value='pro'>Pro</ToggleButton>
                  <ToggleButton value='off'>Off</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
      {!flags ? <Button onClick={load}>Retry</Button> : null}
    </Box>
  )
}

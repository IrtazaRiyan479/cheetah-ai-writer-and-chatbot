'use client'

import { useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

import Overview from './Overview'
import UsersPanel from './UsersPanel'
import FlagsPanel from './FlagsPanel'
import LimitsPanel from './LimitsPanel'
import PricingCopyPanel from './PricingCopyPanel'

const tabs = [
  { label: 'Overview', icon: 'ri-dashboard-2-line' },
  { label: 'Users', icon: 'ri-team-line' },
  { label: 'Feature flags', icon: 'ri-flag-2-line' },
  { label: 'Limits', icon: 'ri-speed-line' },
  { label: 'Pricing copy', icon: 'ri-price-tag-3-line' }
]

export default function AdminDashboard() {
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmLock, setConfirmLock] = useState(false)

  const lock = async () => {
    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/admin/lock', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Could not lock admin console.')
      setConfirmLock(false)
      window.location.reload()
    } catch (caught) {
      setError(caught.message || 'Could not lock admin console.')
      toast.error(caught.message || 'Could not lock admin console.')
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        background: theme =>
          `linear-gradient(180deg, ${theme.palette.mode === 'dark' ? 'rgba(255,193,7,0.06)' : 'rgba(255,193,7,0.08)'} 0%, transparent 220px)`,
        p: { xs: 2, md: 4 }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background: theme =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(255,193,7,0.12), rgba(0,0,0,0.2))'
              : 'linear-gradient(135deg, #fff8e1, #ffffff)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  fontSize: 20
                }}
              >
                <i className='ri-shield-star-line' />
              </Box>
              <Typography variant='h4' sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                AffiGenie Admin
              </Typography>
              <Chip size='small' color='warning' variant='outlined' label='Private' sx={{ fontWeight: 700 }} />
            </Box>
            <Typography color='text.secondary'>
              Operator console for access, limits, models, and billing display copy.
            </Typography>
          </Box>
          <Button
            variant='outlined'
            color='inherit'
            disabled={busy}
            onClick={() => setConfirmLock(true)}
            startIcon={<i className='ri-lock-2-line' />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            Lock console
          </Button>
        </Box>
      </Paper>

      {error ? (
        <Alert severity='error' sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant='scrollable'
          scrollButtons='auto'
          sx={{
            px: 1,
            minHeight: 56,
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontWeight: 700,
              gap: 1
            }
          }}
        >
          {tabs.map((item, index) => (
            <Tab
              key={item.label}
              value={index}
              icon={<i className={item.icon} />}
              iconPosition='start'
              label={item.label}
            />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ borderRadius: 4 }}>
        {tab === 0 ? (
          <Overview />
        ) : tab === 1 ? (
          <UsersPanel />
        ) : tab === 2 ? (
          <FlagsPanel />
        ) : tab === 3 ? (
          <LimitsPanel />
        ) : (
          <PricingCopyPanel />
        )}
      </Box>

      <Dialog open={confirmLock} onClose={() => !busy && setConfirmLock(false)}>
        <DialogTitle>Lock admin console?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You will need to unlock the console again before accessing its controls.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmLock(false)}>
            Cancel
          </Button>
          <Button variant='contained' color='primary' disabled={busy} onClick={lock}>
            {busy ? 'Locking…' : 'Lock console'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

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
  { label: 'Word packs', icon: 'ri-price-tag-3-line' }
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
    <Box sx={{ minHeight: '100%', bgcolor: 'background.default', p: { xs: 2, md: 3 } }}>
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          px: { xs: 2, md: 3 },
          py: 2.25,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 22 }}>
              <i className='ri-shield-star-line' />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant='h5' sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  AffiGenie Admin
                </Typography>
                <Chip size='small' label='Private' color='primary' variant='outlined' />
              </Box>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
                Access, word caps, and one-time word packs.
              </Typography>
            </Box>
          </Box>
          <Button variant='outlined' color='inherit' disabled={busy} onClick={() => setConfirmLock(true)} startIcon={<i className='ri-lock-2-line' />} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Lock console
          </Button>
        </Box>
      </Paper>
      {error ? <Alert severity='error' sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert> : null}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant='scrollable'
          scrollButtons='auto'
          sx={{
            px: 1,
            bgcolor: theme => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(15, 23, 42, 0.03)'),
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 52,
            '& .MuiTab-root': { minHeight: 52, textTransform: 'none', fontWeight: 700, fontSize: 14, gap: 1, color: 'text.secondary' },
            '& .Mui-selected': { color: 'primary.main' }
          }}
        >
          {tabs.map((item, index) => (
            <Tab key={item.label} value={index} icon={<i className={item.icon} />} iconPosition='start' label={item.label} />
          ))}
        </Tabs>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {tab === 0 ? <Overview /> : tab === 1 ? <UsersPanel /> : tab === 2 ? <FlagsPanel /> : tab === 3 ? <LimitsPanel /> : <PricingCopyPanel />}
        </Box>
      </Paper>
      <Dialog open={confirmLock} onClose={() => !busy && setConfirmLock(false)}>
        <DialogTitle>Lock admin console?</DialogTitle>
        <DialogContent>
          <DialogContentText>You will need to unlock the console again before accessing its controls.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmLock(false)}>Cancel</Button>
          <Button variant='contained' disabled={busy} onClick={lock}>{busy ? 'Locking…' : 'Lock console'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

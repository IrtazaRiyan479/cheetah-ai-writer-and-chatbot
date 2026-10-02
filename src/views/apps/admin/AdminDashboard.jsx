'use client'

import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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

const tabs = ['Overview', 'Users', 'Feature flags', 'Limits', 'Pricing copy']

export default function AdminDashboard() {
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const lock = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/lock', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not lock admin console.')
      window.location.reload()
    } catch (caught) {
      setError(caught.message || 'Could not lock admin console.')
      toast.error(caught.message || 'Could not lock admin console.')
      setBusy(false)
    }
  }

  return <Box sx={{ p: { xs: 2, md: 4 } }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
      <Box><Typography variant='h4'>AffiGenie Admin</Typography><Typography color='text.secondary'>Private operator console</Typography></Box>
      <Button variant='outlined' color='inherit' disabled={busy} onClick={lock}>Lock console</Button>
    </Box>
    {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
    <Paper variant='outlined' sx={{ borderRadius: 3, mb: 3 }}><Tabs value={tab} onChange={(_, value) => setTab(value)} variant='scrollable' scrollButtons='auto'>{tabs.map((label, index) => <Tab key={label} label={label} value={index} />)}</Tabs></Paper>
    {tab === 0 ? <Overview /> : tab === 1 ? <UsersPanel /> : tab === 2 ? <FlagsPanel /> : tab === 3 ? <LimitsPanel /> : <PricingCopyPanel />}
  </Box>
}

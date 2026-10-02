'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

export default function PricingCopyPanel() {
  const [pricing, setPricing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(response => response.json()).then(data => {
      if (!data.success) throw new Error(data.error || 'Could not load pricing copy.')
      setPricing(data.pricing || [
        { key: 'starter', name: 'STARTER', badge: '', interval: 'Free', bullets: [], cta: 'Choose Plan', footnote: '', displayAmount: '' },
        { key: 'pro', name: 'Pro', badge: 'Popular', interval: 'Month', bullets: [], cta: 'Choose Plan', footnote: '', displayAmount: '7.5' },
        { key: 'enterprise', name: 'ENTERPRISE', badge: '', interval: 'Month', bullets: [], cta: 'Choose Plan', footnote: '', displayAmount: '16' }
      ])
    }).catch(caught => setError(caught.message || 'Could not load pricing copy.'))
  }, [])

  const update = (index, field, value) => setPricing(items => items.map((item, i) => i === index ? { ...item, [field]: field === 'bullets' ? value.split('\n') : value } : item))

  const save = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricing }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save pricing copy.')
      toast.success('Pricing display copy saved.')
    } catch (caught) { toast.error(caught.message || 'Could not save pricing copy.') } finally { setBusy(false) }
  }

  if (!pricing) return <Typography color={error ? 'error' : 'text.secondary'}>{error || 'Loading pricing copy…'}</Typography>

  return <Box>
    <Typography color='warning.main' sx={{ mb: 2 }}>Display copy only. Does not change Stripe prices, IDs, or checkout.</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
      {pricing.map((plan, index) => <Paper key={plan.key} variant='outlined' sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant='h6' sx={{ mb: 2 }}>{plan.key}</Typography>
        <TextField fullWidth label='Plan name' value={plan.name} onChange={event => update(index, 'name', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label='Badge' value={plan.badge} onChange={event => update(index, 'badge', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label='Interval' value={plan.interval} onChange={event => update(index, 'interval', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label='Display amount (optional)' value={plan.displayAmount || ''} onChange={event => update(index, 'displayAmount', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth multiline minRows={3} label='Bullets (one per line)' value={(plan.bullets || []).join('\n')} onChange={event => update(index, 'bullets', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label='CTA' value={plan.cta} onChange={event => update(index, 'cta', event.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label='Footnote' value={plan.footnote} onChange={event => update(index, 'footnote', event.target.value)} />
      </Paper>)}
    </Box>
    <Button variant='contained' onClick={save} disabled={busy} sx={{ mt: 2 }}>{busy ? <CircularProgress size={20} color='inherit' /> : 'Save display copy'}</Button>
  </Box>
}

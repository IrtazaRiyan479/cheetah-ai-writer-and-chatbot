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
      const fallbackWords = { starter: 5000, pro: 50000, enterprise: 200000 }
      const source = data.pricing || [
        { key: 'starter', name: 'Starter', badge: '', interval: 'one-time', bullets: [], cta: 'Get a 5000-word trial', footnote: '', displayAmount: '', words: 5000 },
        { key: 'pro', name: 'Pro', badge: 'Popular', interval: 'one-time', bullets: [], cta: 'Buy words', footnote: '', displayAmount: '7.5', words: 50000 },
        { key: 'enterprise', name: 'Max', badge: '', interval: 'one-time', bullets: [], cta: 'Buy words', footnote: '', displayAmount: '16', words: 200000 }
      ]
      setPricing(source.map(plan => ({
        ...plan,
        interval: 'one-time',
        words: plan.words == null || plan.words === '' ? (fallbackWords[plan.key] ?? 50000) : plan.words
      })))
    }).catch(caught => setError(caught.message || 'Could not load pricing copy.'))
  }, [])

  const update = (index, field, value) => setPricing(items => items.map((item, i) => i === index ? { ...item, [field]: field === 'bullets' ? value.split('\n') : field === 'words' ? value.replace(/[^\d]/g, '') : value } : item))

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

  return (
    <Box>
      <Typography variant='h6' sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Word packs</Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75, mb: 2.5, maxWidth: 760, lineHeight: 1.6 }}>
        Display copy and the permanent word grant. Checkout charges the display amount once. It does not start a subscription, and buying again adds more words.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2.5, alignItems: 'start' }}>
        {pricing.map((plan, index) => (
          <Paper key={plan.key} variant='outlined' sx={{ p: 2.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant='overline' color='text.secondary' sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>{plan.key}</Typography>
              <Typography variant='h6' sx={{ fontWeight: 800, textTransform: 'capitalize' }}>{plan.name || plan.key}</Typography>
            </Box>
            <TextField fullWidth size='small' label='Plan name' value={plan.name} onChange={event => update(index, 'name', event.target.value)} />
            <TextField fullWidth size='small' label='Badge' value={plan.badge} onChange={event => update(index, 'badge', event.target.value)} />
            <TextField fullWidth size='small' label='Price (USD, one-time)' value={plan.displayAmount || ''} onChange={event => update(index, 'displayAmount', event.target.value)} helperText={plan.key === 'starter' ? 'Leave empty. Starter is the free signup trial.' : 'Charged once at checkout.'} />
            <TextField fullWidth size='small' type='number' label='Words added' value={plan.words ?? ''} onChange={event => update(index, 'words', event.target.value)} helperText='Added forever. Repeat purchases stack.' />
            <TextField fullWidth size='small' multiline minRows={4} label='Bullets (one per line)' value={(plan.bullets || []).join('\n')} onChange={event => update(index, 'bullets', event.target.value)} />
            <TextField fullWidth size='small' label='Button label' value={plan.cta} onChange={event => update(index, 'cta', event.target.value)} />
            <TextField fullWidth size='small' label='Footnote' value={plan.footnote} onChange={event => update(index, 'footnote', event.target.value)} />
          </Paper>
        ))}
      </Box>
      <Button variant='contained' onClick={save} disabled={busy} sx={{ mt: 2.5, textTransform: 'none', fontWeight: 700, px: 2.5 }}>
        {busy ? <CircularProgress size={20} color='inherit' /> : 'Save display copy'}
      </Button>
    </Box>
  )
}

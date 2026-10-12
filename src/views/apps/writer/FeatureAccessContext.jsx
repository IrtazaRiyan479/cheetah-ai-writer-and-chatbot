'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'

import { FEATURE_META, FREE_FEATURES, OPTION_FEATURE_MAP } from '@/libs/entitlement'

const FeatureAccessContext = createContext({
  isPaid: false,
  isMax: false,
  featureModes: {},
  requireFeature: () => true,
  isProFeature: () => false,
  isMaxFeature: () => false,
  modeOf: () => 'pro'
})

export function FeatureAccessProvider({ children }) {
  const [isPaid, setIsPaid] = useState(false)
  const [isMax, setIsMax] = useState(false)
  const [featureModes, setFeatureModes] = useState({})
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [dialogTitle, setDialogTitle] = useState('Pro feature')

  useEffect(() => {
    let active = true
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setIsPaid(Boolean(data.user?.paid))
        setIsMax(Boolean(data.user?.isMax))
        setFeatureModes(data.featureModes || {})
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const modeOf = useCallback(
    key => featureModes[key] || (FREE_FEATURES.has(key) ? 'free' : 'pro'),
    [featureModes]
  )
  const isProFeature = useCallback(key => modeOf(key) === 'pro', [modeOf])
  const isMaxFeature = useCallback(key => modeOf(key) === 'max', [modeOf])
  const requireFeature = useCallback(
    (featureKey, { label } = {}) => {
      const mode = modeOf(featureKey)
      const name = label || FEATURE_META[featureKey]?.label || featureKey
      if (mode === 'off') {
        setDialogTitle('Unavailable')
        setPremiumMessage(`${name} is currently turned off.`)
        setPremiumOpen(true)
        return false
      }
      if (mode === 'max' && !isMax) {
        setDialogTitle('Max feature')
        setPremiumMessage(`${name} is a Max feature. Buy a Max word pack to unlock it.`)
        setPremiumOpen(true)
        return false
      }
      if (mode === 'pro' && !isPaid) {
        setDialogTitle('Pro feature')
        setPremiumMessage(`${name} is a Pro feature. Buy a word pack to unlock it.`)
        setPremiumOpen(true)
        return false
      }
      return true
    },
    [isPaid, isMax, modeOf]
  )

  const value = useMemo(
    () => ({ isPaid, isMax, featureModes, requireFeature, isProFeature, isMaxFeature, modeOf, OPTION_FEATURE_MAP }),
    [isPaid, isMax, featureModes, requireFeature, isProFeature, isMaxFeature, modeOf]
  )

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
      <Dialog open={premiumOpen} onClose={() => setPremiumOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>{premiumMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPremiumOpen(false)}>Close</Button>
          <Button
            variant='contained'
            onClick={() => {
              setPremiumOpen(false)
              const segment = window.location.pathname.split('/').filter(Boolean)[0]
              const lang = ['en', 'fr', 'ar'].includes(segment) ? segment : 'en'
              window.location.href = `/${lang}/home#pricing`
            }}
          >
            View pricing
          </Button>
        </DialogActions>
      </Dialog>
    </FeatureAccessContext.Provider>
  )
}

export function useFeatureAccess() {
  return useContext(FeatureAccessContext)
}

export function FlagSwitch({ featureKey, checked, onChange, label }) {
  const { requireFeature, modeOf } = useFeatureAccess()

  if (modeOf(featureKey) === 'off') return null

  return (
    <FormControlLabel
      control={
        <Switch
          checked={Boolean(checked)}
          onChange={event => {
            const next = event.target.checked
            if (next && !requireFeature(featureKey)) return
            onChange(next)
          }}
        />
      }
      label={
        <Typography className='font-medium text-textPrimary'>
          <ProLabel featureKey={featureKey}>{label}</ProLabel>
        </Typography>
      }
    />
  )
}

export function ProLabel({ featureKey, children }) {
  const { isProFeature, isMaxFeature, isPaid, isMax } = useFeatureAccess()
  const showPro = isProFeature(featureKey) && !isPaid
  const showMax = isMaxFeature(featureKey) && !isMax
  return (
    <span className='inline-flex items-center gap-1'>
      {showMax ? <span title='Max'>◆</span> : null}
      {showPro ? <span title='Pro'>⭐</span> : null}
      {children}
    </span>
  )
}

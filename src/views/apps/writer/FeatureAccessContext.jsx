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
  featureModes: {},
  requireFeature: () => true,
  isProFeature: () => false
})

export function FeatureAccessProvider({ children }) {
  const [isPaid, setIsPaid] = useState(false)
  const [featureModes, setFeatureModes] = useState({})
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')

  useEffect(() => {
    let active = true

    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setIsPaid(Boolean(data.user?.paid))
        setFeatureModes(data.featureModes || {})
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const modeOf = useCallback(key => featureModes[key] || (FREE_FEATURES.has(key) ? 'free' : 'pro'), [featureModes])

  const isProFeature = useCallback(key => modeOf(key) === 'pro', [modeOf])

  const requireFeature = useCallback(
    (featureKey, { label } = {}) => {
      const mode = modeOf(featureKey)

      if (mode === 'off') {
        setPremiumMessage(`${label || FEATURE_META[featureKey]?.label || featureKey} is currently turned off.`)
        setPremiumOpen(true)

        return false
      }

      if (mode === 'pro' && !isPaid) {
        setPremiumMessage(
          `${label || FEATURE_META[featureKey]?.label || featureKey} is a Pro feature. Upgrade to unlock it.`
        )
        setPremiumOpen(true)

        return false
      }

      return true
    },
    [isPaid, modeOf]
  )

  const value = useMemo(
    () => ({ isPaid, featureModes, requireFeature, isProFeature, modeOf, OPTION_FEATURE_MAP }),
    [isPaid, featureModes, requireFeature, isProFeature, modeOf]
  )

  return (
    <FeatureAccessContext.Provider value={value}>
      {children}
      <Dialog open={premiumOpen} onClose={() => setPremiumOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Pro feature</DialogTitle>
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
  const { requireFeature } = useFeatureAccess()

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
  const { isProFeature, isPaid } = useFeatureAccess()
  const showStar = isProFeature(featureKey) && !isPaid

  return (
    <span className='inline-flex items-center gap-1'>
      {showStar ? <span title='Pro'>⭐</span> : null}
      {children}
    </span>
  )
}

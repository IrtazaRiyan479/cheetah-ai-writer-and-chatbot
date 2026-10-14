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
  modesReady: false,
  requireFeature: () => true,
  isProFeature: () => false,
  isMaxFeature: () => false,
  modeOf: () => 'free',
  refreshModes: () => {}
})

async function fetchModesAndUser() {
  const [pricing, settings] = await Promise.all([
    fetch('/api/pricing/copy')
      .then(res => (res.ok ? res.json() : {}))
      .catch(() => ({})),
    fetch('/api/user/settings')
      .then(async res => {
        if (res.status === 401) return { guest: true }
        if (!res.ok) return { guest: true }
        return res.json()
      })
      .catch(() => ({ guest: true }))
  ])

  const modes = pricing.modes || settings.featureModes || {}
  const paid = Boolean(settings.user?.paid)
  const isMax = Boolean(settings.user?.isMax)
  return { modes, paid, isMax }
}

export function FeatureAccessProvider({ children }) {
  const [isPaid, setIsPaid] = useState(false)
  const [isMax, setIsMax] = useState(false)
  const [featureModes, setFeatureModes] = useState({})
  const [modesReady, setModesReady] = useState(false)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [dialogTitle, setDialogTitle] = useState('Pro feature')

  const refreshModes = useCallback(async () => {
    try {
      const { modes, paid, isMax: maxUser } = await fetchModesAndUser()
      setFeatureModes(modes || {})
      setIsPaid(paid)
      setIsMax(maxUser)
      setModesReady(true)
    } catch {
      setModesReady(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!active) return
      await refreshModes()
    }
    run()
    const onFocus = () => run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(run, 12000)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [refreshModes])

  const modeOf = useCallback(
    key => {
      if (!key) return 'free'
      if (Object.prototype.hasOwnProperty.call(featureModes, key)) return featureModes[key]
      return FREE_FEATURES.has(key) ? 'free' : 'pro'
    },
    [featureModes]
  )
  const isProFeature = useCallback(key => Boolean(key) && modeOf(key) === 'pro', [modeOf])
  const isMaxFeature = useCallback(key => Boolean(key) && modeOf(key) === 'max', [modeOf])
  const requireFeature = useCallback(
    (featureKey, { label } = {}) => {
      if (!featureKey) return true
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
    () => ({
      isPaid,
      isMax,
      featureModes,
      modesReady,
      requireFeature,
      isProFeature,
      isMaxFeature,
      modeOf,
      refreshModes,
      OPTION_FEATURE_MAP
    }),
    [isPaid, isMax, featureModes, modesReady, requireFeature, isProFeature, isMaxFeature, modeOf, refreshModes]
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
  if (!featureKey) return children
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

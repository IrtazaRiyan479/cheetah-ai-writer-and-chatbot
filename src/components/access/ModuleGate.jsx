'use client'

import { useEffect, useState } from 'react'

import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { FEATURE_META, FREE_FEATURES } from '@/libs/entitlement'

export default function ModuleGate({ featureKey, children }) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [guest, setGuest] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch('/api/pricing/copy')
        .then(response => response.json())
        .catch(() => ({})),
      fetch('/api/user/settings')
        .then(async response => (response.ok ? response.json() : { guest: true }))
        .catch(() => ({ guest: true }))
    ]).then(([pricing, settings]) => {
      if (!active) return
      const mode = pricing.modes?.[featureKey] || (FREE_FEATURES.has(featureKey) ? 'free' : 'pro')
      const label = FEATURE_META[featureKey]?.label || 'This page'
      const tier = settings.user?.tier || 'free'
      const signedOut = Boolean(settings.guest) || !settings.user
      const isMaxUser = tier === 'max' || tier === 'admin'
      const isPaidUser = isMaxUser || tier === 'pro'

      if (mode === 'off') {
        setMessage(`${label} is turned off.`)
        setStatus('blocked')
        return
      }
      if (mode === 'max' && !isMaxUser) {
        setGuest(signedOut)
        setMessage(signedOut ? `Sign in with a Max word pack to use ${label}.` : `${label} requires a Max word pack.`)
        setStatus('blocked')
        return
      }
      if (mode === 'pro' && !isPaidUser) {
        setGuest(signedOut)
        setMessage(
          signedOut
            ? `Sign in, then buy a Pro or Max word pack to use ${label}.`
            : `${label} requires a Pro or Max word pack.`
        )
        setStatus('blocked')
        return
      }
      setStatus('ok')
    })

    return () => {
      active = false
    }
  }, [featureKey])

  if (status === 'loading') return null
  if (status !== 'blocked') return children

  const go = path => {
    const segment = window.location.pathname.split('/').filter(Boolean)[0]
    const lang = ['en', 'fr', 'ar'].includes(segment) ? segment : 'en'
    window.location.href = `/${lang}/${path}`
  }

  return (
    <div className='flex min-bs-[50vh] items-center justify-center p-6'>
      <div className='max-is-[460px] text-center'>
        <Typography variant='h5' className='font-bold mbe-2'>
          {FEATURE_META[featureKey]?.label || 'Unavailable'}
        </Typography>
        <Typography color='text.secondary' className='mbe-4'>
          {message}
        </Typography>
        <Button variant='contained' onClick={() => go(guest ? 'login' : 'pricing')}>
          {guest ? 'Sign in' : 'View pricing'}
        </Button>
      </div>
    </div>
  )
}

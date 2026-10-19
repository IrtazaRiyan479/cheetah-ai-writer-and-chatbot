'use client'

import { useEffect, useState } from 'react'

import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { useSession } from 'next-auth/react'

import { WRITER_MENUS } from '@/libs/entitlement'

import { ProLabel, useFeatureAccess } from './FeatureAccessContext'

export default function GatedSelect({ menuKey, value, onChange, options, label, className }) {
  const menu = WRITER_MENUS.find(item => item.key === menuKey)
  const { modeOf, requireFeature, isPaid, isMax, featureModes } = useFeatureAccess()
  const [open, setOpen] = useState(false)

  const resolved = (options || menu?.options || []).map(option => {
    const known = menu?.options?.find(item => item.value === option.value)
    return { ...option, featureKey: option.featureKey || known?.featureKey }
  })

  const canUse = option => {
    if (!menu || !option) return false
    if (option.featureKey && modeOf(option.featureKey) === 'off') return false
    if (String(option.value) !== String(menu.defaultValue) && modeOf(menu.key) === 'off') return false
    if (option.featureKey && modeOf(option.featureKey) === 'max' && !isMax) return false
    if (option.featureKey && modeOf(option.featureKey) === 'pro' && !isPaid) return false
    if (String(option.value) !== String(menu.defaultValue) && modeOf(menu.key) === 'max' && !isMax) return false
    if (String(option.value) !== String(menu.defaultValue) && modeOf(menu.key) === 'pro' && !isPaid) return false
    return true
  }

  const visible = resolved.filter(option => !option.featureKey || modeOf(option.featureKey) !== 'off')
  const hidden = !menu || modeOf(menu.key) === 'off'
  const menuMode = menu ? modeOf(menu.key) : 'off'
  const menuLocked = Boolean(menu) && ((menuMode === 'pro' && !isPaid) || (menuMode === 'max' && !isMax))

  useEffect(() => {
    if (!menu) return
    if (hidden) {
      if (value !== menu.defaultValue) onChange(menu.defaultValue)
      return
    }
    const current = resolved.find(option => option.value === value)
    if (current && canUse(current)) return
    const fallback =
      resolved.find(option => option.value === menu.defaultValue && canUse(option)) || resolved.find(canUse)
    if (fallback && fallback.value !== value) onChange(fallback.value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, value, isPaid, isMax, featureModes])

  if (!menu || hidden) return null

  const selected = visible.some(option => option.value === value) ? value : visible[0]?.value || ''

  return (
    <>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        <ProLabel featureKey={menu.key}>{label || menu.label}</ProLabel>
      </Typography>
      <FormControl fullWidth size='small' className={className || ''}>
        <Select
          value={selected}
          open={open}
          onOpen={() => {
            if (menuLocked) {
              requireFeature(menu.key, { label: label || menu.label })
              setOpen(false)
              return
            }
            setOpen(true)
          }}
          onClose={() => setOpen(false)}
          onChange={event => {
            const next = event.target.value
            const option = visible.find(item => item.value === next)
            if (option?.featureKey && !requireFeature(option.featureKey, { label: option.label })) return
            if (String(next) !== String(menu.defaultValue) && !requireFeature(menu.key)) return
            onChange(next)
          }}
        >
          {visible.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.featureKey ? <ProLabel featureKey={option.featureKey}>{option.label}</ProLabel> : option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </>
  )
}

export function GatedNumber({ featureKey, label, value, onChange, placeholder = 'No limit' }) {
  const { modeOf, requireFeature } = useFeatureAccess()
  if (modeOf(featureKey) === 'off') return null

  return (
    <>
      <Typography variant='subtitle2' className='font-medium mbe-1'>
        <ProLabel featureKey={featureKey}>{label}</ProLabel>
      </Typography>
      <TextField
        fullWidth
        type='number'
        size='small'
        placeholder={placeholder}
        value={value || ''}
        onChange={event => {
          const next = event.target.value
          if (next && !requireFeature(featureKey, { label })) return
          onChange(next)
        }}
      />
    </>
  )
}

const ADMIN_INTERNAL_SITES_EMAIL = 'abrarshovon@admin.com'
const ADD_DOMAIN_VALUE = '__add_domain__'

function normalizeDomain(value) {
  let raw = String(value || '').trim()

  if (!raw || raw === ADD_DOMAIN_VALUE) return ''

  raw = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  raw = raw.split('/')[0].split('?')[0].split('#')[0].trim().toLowerCase()

  if (!raw || !raw.includes('.') || raw.length > 253) return ''

  return raw
}

function parseDomainList(value) {
  const seen = new Set()
  const domains = []

  String(value || '')
    .split(',')
    .forEach(part => {
      const domain = normalizeDomain(part)

      if (!domain || seen.has(domain)) return

      seen.add(domain)
      domains.push(domain)
    })

  return domains
}

async function persistInternalSites(domains) {
  const res = await fetch('/api/internal-link-sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sites: domains })
  })

  if (!res.ok) return null

  const data = await res.json()

  return Array.isArray(data.sites) ? data.sites : null
}

export function InternalLinkFields({ sites, custom, onSites, onCustom, siteOptions }) {
  const { modeOf, requireFeature } = useFeatureAccess()
  const { data: session, status } = useSession()
  const selected = Array.isArray(sites) ? sites : []
  const showSites = modeOf('menu-internal-linking') !== 'off'
  const showCustom = modeOf('menu-custom-internal-urls') !== 'off'
  const [savedSites, setSavedSites] = useState([])
  const [showCustomField, setShowCustomField] = useState(false)
  const [saveForLater, setSaveForLater] = useState(false)
  const isAdmin =
    status === 'authenticated' &&
    String(session?.user?.email || '')
      .trim()
      .toLowerCase() === ADMIN_INTERNAL_SITES_EMAIL
  const builtIn = Array.isArray(siteOptions) ? siteOptions : []
  const savedOnly = savedSites.filter(site => !builtIn.some(item => item.toLowerCase() === site.toLowerCase()))
  const selectableSites = showSites ? [...(isAdmin ? builtIn : []), ...savedOnly] : []

  useEffect(() => {
    let cancelled = false

    const loadSavedSites = async () => {
      try {
        const res = await fetch('/api/internal-link-sites')

        if (!res.ok) return

        const data = await res.json()

        if (!cancelled && Array.isArray(data.sites)) setSavedSites(data.sites)
      } catch {
        // Saved sites stay empty if the request fails.
      }
    }

    loadSavedSites()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || isAdmin) return

    const builtin = new Set(builtIn.map(site => String(site).toLowerCase()))
    const cleaned = selected.filter(site => !builtin.has(String(site).toLowerCase()))

    if (cleaned.length !== selected.length) onSites(cleaned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin])

  useEffect(() => {
    if (!saveForLater) return

    const domains = parseDomainList(custom)

    if (!domains.length) return

    const timer = setTimeout(() => {
      persistInternalSites(domains).then(next => {
        if (next) setSavedSites(next)
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [custom, saveForLater])

  if (!showSites && !showCustom) return null

  return (
    <>
      {showSites || showCustom ? (
        <>
          <Typography variant='subtitle2' className='font-medium mbe-1'>
            <ProLabel featureKey='menu-internal-linking'>Automatic Internal Linking</ProLabel>
          </Typography>
          <FormControl fullWidth size='small' className='mbe-3'>
            <Select
              multiple
              displayEmpty
              value={selected.filter(site => selectableSites.some(item => item.toLowerCase() === String(site).toLowerCase()))}
              onChange={event => {
                const raw = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value

                if (raw.includes(ADD_DOMAIN_VALUE)) {
                  if (!requireFeature('menu-custom-internal-urls')) return
                  setShowCustomField(true)
                  onSites(raw.filter(item => item !== ADD_DOMAIN_VALUE))

                  return
                }

                if (raw.length && !requireFeature('menu-internal-linking')) return
                onSites(raw)
              }}
              input={<OutlinedInput size='small' />}
              renderValue={chosen =>
                chosen.length ? (
                  <div className='flex flex-wrap gap-1'>
                    {chosen.map(item => (
                      <Chip key={item} label={item} size='small' className='h-6' />
                    ))}
                  </div>
                ) : (
                  <span style={{ opacity: 0.6 }}>Select domains</span>
                )
              }
            >
              {selectableSites.map(site => (
                <MenuItem key={site} value={site}>
                  <Checkbox checked={selected.some(item => String(item).toLowerCase() === site.toLowerCase())} />
                  <ListItemText primary={site} />
                </MenuItem>
              ))}
              {showCustom ? (
                <MenuItem value={ADD_DOMAIN_VALUE}>
                  <ListItemText primary='+ Add new domain' />
                </MenuItem>
              ) : null}
            </Select>
          </FormControl>
        </>
      ) : null}
      {showCustom && showCustomField ? (
        <>
          <Typography variant='subtitle2' className='font-medium mbe-1'>
            <ProLabel featureKey='menu-custom-internal-urls'>Custom URLs (Comma Separated)</ProLabel>
          </Typography>
          <TextField
            fullWidth
            size='small'
            placeholder='https://site1.com, https://site2.com'
            value={custom || ''}
            onChange={event => {
              const next = event.target.value

              if (next.trim() && !requireFeature('menu-custom-internal-urls')) return
              onCustom(next)
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size='small'
                checked={saveForLater}
                onChange={event => setSaveForLater(event.target.checked)}
              />
            }
            label='Save these sites for future use'
          />
        </>
      ) : null}
    </>
  )
}

'use client'

import { useEffect } from 'react'

import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import OutlinedInput from '@mui/material/OutlinedInput'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { WRITER_MENUS } from '@/libs/entitlement'

import { ProLabel, useFeatureAccess } from './FeatureAccessContext'

export default function GatedSelect({ menuKey, value, onChange, options, label, className }) {
  const menu = WRITER_MENUS.find(item => item.key === menuKey)
  const { modeOf, requireFeature, isPaid, isMax, featureModes } = useFeatureAccess()

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
              <ProLabel featureKey={option.featureKey}>{option.label}</ProLabel>
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

export function InternalLinkFields({ sites, custom, onSites, onCustom, siteOptions }) {
  const { modeOf, requireFeature } = useFeatureAccess()
  const selected = Array.isArray(sites) ? sites : []
  const showSites = modeOf('menu-internal-linking') !== 'off'
  const showCustom = modeOf('menu-custom-internal-urls') !== 'off'

  if (!showSites && !showCustom) return null

  return (
    <>
      {showSites ? (
        <>
          <Typography variant='subtitle2' className='font-medium mbe-1'>
            <ProLabel featureKey='menu-internal-linking'>Automatic Internal Linking</ProLabel>
          </Typography>
          <FormControl fullWidth size='small' className='mbe-3'>
            <Select
              multiple
              value={selected}
              onChange={event => {
                const next = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value
                if (next.length && !requireFeature('menu-internal-linking')) return
                onSites(next)
              }}
              input={<OutlinedInput size='small' />}
              renderValue={chosen => (
                <div className='flex flex-wrap gap-1'>
                  {chosen.map(item => (
                    <Chip key={item} label={item} size='small' className='h-6' />
                  ))}
                </div>
              )}
            >
              {siteOptions.map(site => (
                <MenuItem key={site} value={site}>
                  <Checkbox checked={selected.indexOf(site) > -1} />
                  <ListItemText primary={site} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      ) : null}
      {showCustom ? (
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
        </>
      ) : null}
    </>
  )
}

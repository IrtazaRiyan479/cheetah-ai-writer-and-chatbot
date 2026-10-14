'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

import { ADMIN_FLAG_TREE } from '@/libs/entitlement'

const modeColor = {
  free: 'success',
  pro: 'warning',
  max: 'info',
  off: 'error'
}

const childCount = nodes => (nodes || []).reduce((sum, node) => sum + 1 + childCount(node.children), 0)

const filterNodes = (nodes, query) => {
  if (!query) return nodes
  return nodes.reduce((list, node) => {
    const children = filterNodes(node.children || [], query)
    const self = `${node.label} ${node.key} ${node.hint || ''}`.toLowerCase().includes(query)
    if (self) list.push(node)
    else if (children.length) list.push({ ...node, children })
    return list
  }, [])
}

const collectPaths = (nodes, parentPath = '', into = []) => {
  nodes.forEach(node => {
    const path = parentPath ? `${parentPath}/${node.key}` : node.key
    if (node.children?.length) {
      into.push(path)
      collectPaths(node.children, path, into)
    }
  })
  return into
}

const countKeys = (nodes, counts = new Map()) => {
  nodes.forEach(node => {
    counts.set(node.key, (counts.get(node.key) || 0) + 1)
    if (node.children?.length) countKeys(node.children, counts)
  })
  return counts
}

function FlagControls({ flag, busy, onMode, onPaid }) {
  return (
    <>
      <ToggleButtonGroup
        exclusive
        size='small'
        value={flag.mode}
        disabled={busy === flag.key}
        onChange={(_, value) => value && onMode(flag.key, value)}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 1.5 } }}
      >
        <ToggleButton value='free'>Free</ToggleButton>
        <ToggleButton value='pro'>Pro</ToggleButton>
        <ToggleButton value='max'>Max</ToggleButton>
        <ToggleButton value='off'>Off</ToggleButton>
      </ToggleButtonGroup>
      <FormControlLabel
        sx={{ m: 0, minWidth: 118 }}
        control={
          <Switch
            checked={Boolean(flag.usePaidKeys)}
            disabled={busy === `${flag.key}:paid`}
            onChange={event => onPaid(flag.key, event.target.checked)}
          />
        }
        label='Paid keys'
      />
    </>
  )
}

function FlagBranch({ nodes, depth, parentPath, byKey, shared, open, forceOpen, busy, onToggle, onMode, onPaid }) {
  return nodes.map((node, index) => {
    const path = parentPath ? `${parentPath}/${node.key}` : node.key
    const flag = byKey.get(node.key)
    if (!flag) return null
    const children = node.children || []
    const expandable = children.length > 0
    const isOpen = forceOpen || open.has(path)
    const nested = depth > 0

    return (
      <Fragment key={path}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            py: nested ? 1.5 : 2,
            pl: { xs: 1.5 + depth * 1.25, md: 2.5 + depth * 2.25 },
            borderTop: depth === 0 && index === 0 ? 0 : 1,
            borderColor: 'divider',
            flexWrap: 'wrap',
            bgcolor: theme =>
              nested ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(15, 23, 42, 0.025)') : 'transparent'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 240, flex: '1 1 240px' }}>
            {expandable ? (
              <IconButton
                size='small'
                aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                aria-expanded={isOpen}
                onClick={() => onToggle(path)}
                sx={{ mt: 0.25 }}
              >
                <i className={isOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} />
              </IconButton>
            ) : (
              <Box sx={{ width: 34, flexShrink: 0 }} />
            )}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {flag.mode === 'pro' ? <span title='Pro'>⭐</span> : null}
                {flag.mode === 'max' ? <span title='Max'>◆</span> : null}
                <Typography variant='body1' sx={{ fontWeight: nested ? 600 : 700 }}>
                  {node.label}
                </Typography>
                <Chip size='small' color={modeColor[flag.mode] || 'default'} label={flag.mode} sx={{ fontWeight: 700 }} />
                {shared.has(node.key) ? <Chip size='small' variant='outlined' label='Shared' /> : null}
                {expandable && !isOpen ? (
                  <Chip size='small' variant='outlined' label={`${childCount(children)} sub-features`} />
                ) : null}
              </Box>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                {node.hint || flag.key}
              </Typography>
              {node.hint ? (
                <Typography variant='caption' color='text.disabled' sx={{ display: 'block' }}>
                  {flag.key}
                </Typography>
              ) : null}
            </Box>
          </Box>
          <FlagControls flag={flag} busy={busy} onMode={onMode} onPaid={onPaid} />
        </Box>
        {expandable && isOpen ? (
          <FlagBranch
            nodes={children}
            depth={depth + 1}
            parentPath={path}
            byKey={byKey}
            shared={shared}
            open={open}
            forceOpen={forceOpen}
            busy={busy}
            onToggle={onToggle}
            onMode={onMode}
            onPaid={onPaid}
          />
        ) : null}
      </Fragment>
    )
  })
}

export default function FlagsPanel() {
  const [flags, setFlags] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(() => new Set())

  const load = async () => {
    try {
      const response = await fetch('/api/admin/flags')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load feature flags.')
      setFlags(data.flags)
    } catch (caught) {
      setError(caught.message || 'Could not load feature flags.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 280)
    return () => window.clearTimeout(timer)
  }, [query])

  const update = async (key, mode) => {
    setBusy(key)
    try {
      const response = await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mode })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update flag.')
      setFlags(items => items.map(item => (item.key === key ? { ...item, mode } : item)))
      toast.success('Feature flag updated.')
    } catch (caught) {
      toast.error(caught.message || 'Could not update flag.')
    } finally {
      setBusy('')
    }
  }

  const updatePaidKeys = async (key, usePaidKeys) => {
    setBusy(`${key}:paid`)
    try {
      const response = await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, usePaidKeys })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not update paid-key setting.')
      setFlags(items => items.map(item => (item.key === key ? { ...item, usePaidKeys } : item)))
      toast.success(usePaidKeys ? 'This feature now uses paid API keys.' : 'This feature now uses free API keys.')
    } catch (caught) {
      toast.error(caught.message || 'Could not update paid-key setting.')
    } finally {
      setBusy('')
    }
  }

  const byKey = useMemo(() => new Map((flags || []).map(flag => [flag.key, flag])), [flags])
  const shared = useMemo(() => {
    const counts = countKeys(ADMIN_FLAG_TREE.flatMap(section => section.nodes))
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key))
  }, [])
  const needle = debouncedQuery.trim().toLowerCase()
  const sections = useMemo(
    () =>
      ADMIN_FLAG_TREE.map(section => ({
        ...section,
        nodes: filterNodes(section.nodes, needle)
      })).filter(section => section.nodes.length),
    [needle]
  )

  const toggle = path => {
    setOpen(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const setGroup = (nodes, expanded) => {
    const paths = collectPaths(nodes)
    setOpen(current => {
      const next = new Set(current)
      paths.forEach(path => (expanded ? next.add(path) : next.delete(path)))
      return next
    })
  }

  if (!flags && !error) return <Skeleton variant='rounded' height={320} sx={{ borderRadius: 0 }} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant='h6' sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Feature access
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75, maxWidth: 760, lineHeight: 1.6 }}>
          Open an article type to see the fields on that form. Open a field such as Article Length to set each option.
          Free is available on every plan. Pro requires Pro or Max. Max requires a Max word pack. Off removes the feature.
          Paid keys is separate: if any feature used in a request has it on, that request uses the paid API key pools.
          Shared means the same flag is used by more than one article type.
        </Typography>
      </Box>
      <TextField
        size='small'
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder='Search features, for example rewrite captions or article length'
        sx={{ maxWidth: 520 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <i className='ri-search-line' />
            </InputAdornment>
          )
        }}
      />
      {sections.length === 0 && !error ? (
        <Typography color='text.secondary'>No features match that search.</Typography>
      ) : null}
      {error ? (
        <Typography color='error' sx={{ p: 1 }}>
          {error}
        </Typography>
      ) : null}
      {sections.map(section => (
        <Paper
          key={section.group}
          elevation={0}
          sx={{ borderRadius: 0, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              background: theme => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,193,7,0.08)')
            }}
          >
            <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
              {section.group}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size='small' onClick={() => setGroup(section.nodes, true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Expand all
              </Button>
              <Button size='small' onClick={() => setGroup(section.nodes, false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Collapse all
              </Button>
            </Box>
          </Box>
          <FlagBranch
            nodes={section.nodes}
            depth={0}
            parentPath=''
            byKey={byKey}
            shared={shared}
            open={open}
            forceOpen={Boolean(needle)}
            busy={busy}
            onToggle={toggle}
            onMode={update}
            onPaid={updatePaidKeys}
          />
        </Paper>
      ))}
      {!flags ? <Button onClick={load}>Retry</Button> : null}
    </Box>
  )
}

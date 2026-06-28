'use client'

import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import LinkIcon from '@mui/icons-material/Link'

// Notice we changed sourcePostId to sourceUrl
export default function InternalLinker({ siteUrl, sourceUrl, targetUrl, anchorText }) {
  const [isInjecting, setIsInjecting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  const [customUsername, setCustomUsername] = useState('')
  const [customPassword, setCustomPassword] = useState('')

  const handleInjectLink = async (useCustomAuth = false) => {
    setIsInjecting(true)

    const payload = {
      siteUrl,
      sourceUrl,
      targetUrl,
      anchorText,
      ...(useCustomAuth && { customUsername, customPassword })
    }

    try {
      const res = await fetch('/api/inject-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.status === 401 && data.requiresAuth) {
        setAuthDialogOpen(true)
      } else if (data.success) {
        setIsSuccess(true)
        setAuthDialogOpen(false)
      } else {
        alert(`Failed: ${data.message || data.error}`)
      }
    } catch (error) {
      console.error(error)
      alert('An error occurred while linking.')
    } finally {
      setIsInjecting(false)
    }
  }

  const submitCustomAuth = () => {
    handleInjectLink(true)
  }

  if (isSuccess) {
    return (
      <Button variant="outlined" color="success" startIcon={<i className="ri-check-line" />} disabled>
        Link Injected
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="contained"
        color="secondary"
        size="small"
        onClick={() => handleInjectLink(false)}
        disabled={isInjecting}
        startIcon={isInjecting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
      >
        {isInjecting ? 'Injecting...' : 'Inject Link to WP'}
      </Button>

      <Dialog open={authDialogOpen} onClose={() => !isInjecting && setAuthDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>WP Auth Required</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The domain <strong>{siteUrl}</strong> is not in your .env configuration. Please provide an App Password to inject this link.
          </Typography>
          <Box className="flex flex-col gap-4">
            <TextField
              label="WP Username / Email"
              fullWidth size="small"
              value={customUsername}
              onChange={(e) => setCustomUsername(e.target.value)}
            />
            <TextField
              label="Application Password"
              type="password"
              fullWidth size="small"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialogOpen(false)} color="inherit" disabled={isInjecting}>Cancel</Button>
          <Button onClick={submitCustomAuth} variant="contained" disabled={!customUsername || !customPassword || isInjecting}>
             {isInjecting ? 'Authenticating...' : 'Submit & Inject'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

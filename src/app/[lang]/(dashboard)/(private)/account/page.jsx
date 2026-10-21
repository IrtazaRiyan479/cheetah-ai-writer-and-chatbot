'use client'

import { useState, useEffect } from 'react'

import { usePathname } from 'next/navigation'

import { useSession, signOut } from 'next-auth/react'
import { toast } from 'react-toastify'

import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { serializeError } from '@/utils/serializeError'
import { passwordIssue } from '@/utils/credentials'

const AccountSettings = () => {
  const { data: session, update: updateSession } = useSession()
  const pathname = usePathname()
  const locale = pathname?.split('/').filter(Boolean)[0] || 'en'
  const [isLoading, setIsLoading] = useState(true)
  const [tooltipText, setTooltipText] = useState('Copy ID')

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [userData, setUserData] = useState({
    name: '',
    email: '',
    userId: '',
    supportPin: '',
    plan: 'free',
    subscriptionStatus: 'none',
    wordsUsed: 0,
    wordsLimit: 5000,
    paid: false,
    hasStripeCustomer: false,
    chatsLimit: '25 / 25 chats'
  })

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user?.email) {
        try {
          const res = await fetch('/api/user/settings')
          const data = await res.json()

          if (data.user) {
            setUserData(prev => ({
              ...prev,
              name: data.user.name || 'N/A',
              email: data.user.email,
              userId: data.user.id,
              supportPin: data.user.supportPin || 'N/A',
              plan: data.user.role === 'admin' ? 'admin' : data.user.plan || 'free',
              subscriptionStatus: data.user.subscriptionStatus || 'none',
              wordsUsed: data.user.wordsUsed || 0,
              wordsLimit: data.user.wordsLimit || 5000,
              paid: Boolean(data.user.paid),
              hasStripeCustomer: Boolean(data.user.hasStripeCustomer)
            }))
          }
        } catch (error) {
          console.error('Failed to fetch user data:')
        } finally {
          setIsLoading(false)
        }
      }
    }

    if (session) fetchUserData()
  }, [session])

  const handleCopyId = () => {
    if (userData.userId) {
      navigator.clipboard.writeText(userData.userId)
      setTooltipText('Copied!')
      setTimeout(() => setTooltipText('Copy ID'), 2000)
    }
  }

  const handlePasswordChange = async () => {
    setIsUpdating(true)
    setUpdateError('')

    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await response.json()

      if (!response.ok || !data.success) throw new Error(serializeError(data?.error || data))
      toast.success('Password updated successfully.')
      setPasswordDialogOpen(false)
      setCurrentPassword('')
      setNewPassword('')
    } catch (error) {
      setUpdateError(serializeError(error))
      toast.error(serializeError(error))
    } finally {
      setIsUpdating(false)
    }
  }

  const handleEmailUpdate = async () => {
    setUpdateError('')
    setIsUpdating(true)

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail })
      })

      const data = await res.json()

      if (res.ok) {
        setUserData(prev => ({ ...prev, email: data.user.email }))

        await updateSession({ email: data.user.email })

        setIsDialogOpen(false)
        setNewEmail('')
      } else {
        setUpdateError(data.error || 'Failed to update email')
      }
    } catch (error) {
      setUpdateError('An unexpected error occurred')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' })
  }

  const initials = String(userData.name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('')

  const planLabel =
    userData.plan === 'admin' ? 'Admin' : userData.plan === 'pro' ? 'Pro' : userData.plan === 'max' ? 'Max' : 'Free'

  const wordPercent = userData.wordsLimit ? Math.min(100, (Number(userData.wordsUsed) / Number(userData.wordsLimit)) * 100) : 0

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant='overline' color='primary' sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            Account
          </Typography>
          <Typography variant='h4' sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Your workspace
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75, maxWidth: 520 }}>
            Profile, sign-in, and word balance for this AffiGenie account.
          </Typography>
        </Box>
        <Button
          variant='outlined'
          color='error'
          onClick={handleLogout}
          startIcon={<i className='ri-logout-box-r-line' />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 2.5 }}
        >
          Log out
        </Button>
      </Box>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          background: theme =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(115,103,240,0.18), rgba(255,255,255,0.03) 55%)'
              : 'linear-gradient(135deg, rgba(115,103,240,0.12), rgba(255,255,255,0.9) 48%)'
        }}
      >
        <Box sx={{ display: 'flex', gap: 2.5, alignItems: { xs: 'flex-start', md: 'center' }, flexWrap: 'wrap' }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              fontSize: 26,
              fontWeight: 800,
              bgcolor: 'primary.main',
              color: 'primary.contrastText'
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant='h5' sx={{ fontWeight: 800 }}>
                {userData.name}
              </Typography>
              <Chip
                size='small'
                label={planLabel}
                color={userData.plan === 'free' ? 'default' : 'success'}
                sx={{ fontWeight: 700 }}
              />
            </Box>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
              {userData.email}
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.75 }}>
              {userData.plan === 'pro'
                ? 'Pro words do not expire.'
                : userData.plan === 'admin'
                  ? 'Admin access is active on this account.'
                  : 'Free trial includes 5,000 words.'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant='contained'
              disableElevation
              onClick={() => {
                setUpdateError('')
                setPasswordDialogOpen(true)
              }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Change password
            </Button>
            <Button
              variant='outlined'
              onClick={() => {
                setUpdateError('')
                setIsDialogOpen(true)
              }}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Update email
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
          gap: 3,
          alignItems: 'start'
        }}
      >
        <Paper variant='outlined' sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2.25, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
              Account details
            </Typography>
          </Box>
          <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                USER ID
              </Typography>
              <Typography
                variant='body2'
                sx={{ fontFamily: 'monospace', mt: 0.5, wordBreak: 'break-all', fontWeight: 600 }}
              >
                {userData.userId}
              </Typography>
            </Box>
            <Tooltip title={tooltipText}>
              <IconButton onClick={handleCopyId} aria-label='Copy user ID' sx={{ bgcolor: 'action.hover' }}>
                <ContentCopyIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider />
          <Box sx={{ px: 3, py: 2.5 }}>
            <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              SUPPORT PIN
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 800, letterSpacing: '0.12em', mt: 0.5 }}>
              {userData.supportPin}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Share this pin when you contact support.
            </Typography>
          </Box>
        </Paper>

        <Paper variant='outlined' sx={{ borderRadius: 3, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
                Word balance
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {userData.plan === 'admin' ? 'Unlimited for this admin account.' : 'Words used on this account.'}
              </Typography>
            </Box>
            <Button
              component='a'
              href={`/${locale}/pricing`}
              variant='contained'
              disableElevation
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}
            >
              Buy words
            </Button>
          </Box>
          {userData.plan === 'admin' ? (
            <Chip label='Admin plan' color='success' sx={{ fontWeight: 700 }} />
          ) : (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant='body2' sx={{ fontWeight: 700 }}>
                  {Number(userData.wordsUsed).toLocaleString()} used
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {Number(userData.wordsLimit).toLocaleString()} limit
                </Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={wordPercent}
                color={wordPercent >= 100 ? 'error' : 'primary'}
                sx={{ height: 10, borderRadius: 99, bgcolor: 'action.hover' }}
              />
            </Box>
          )}
        </Paper>
      </Box>

      <Paper
        variant='outlined'
        sx={{
          borderRadius: 3,
          p: 3,
          mt: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
            Beta features
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
            Early tools stay off until the program is enabled for this account.
          </Typography>
          <Chip label='Disabled' size='small' sx={{ mt: 1.25, fontWeight: 700 }} />
        </Box>
        <Button variant='outlined' sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
          Manage features
        </Button>
      </Paper>

      {/* Change Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => !isUpdating && setPasswordDialogOpen(false)}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {updateError ? <Alert severity='error'>{updateError}</Alert> : null}
            <TextField
              autoFocus
              required
              fullWidth
              type='password'
              label='Current password'
              autoComplete='current-password'
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
            />
            <TextField
              required
              fullWidth
              type='password'
              label='New password'
              autoComplete='new-password'
              inputProps={{ minLength: 8 }}
              helperText='At least 8 characters, with uppercase, lowercase, and a number.'
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} disabled={isUpdating} color='inherit'>
            Cancel
          </Button>
          <Button
            onClick={handlePasswordChange}
            variant='contained'
            disabled={isUpdating || !currentPassword || Boolean(passwordIssue(newPassword))}
          >
            {isUpdating ? <CircularProgress size={24} color='inherit' /> : 'Save Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Email Modal Dialog */}

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Update Email Address</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {updateError && (
              <Alert severity='error' sx={{ mb: 2 }}>
                {updateError}
              </Alert>
            )}
            <TextField
              autoFocus
              margin='dense'
              label='New Email Address'
              type='email'
              fullWidth
              variant='outlined'
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsDialogOpen(false)} color='inherit'>
            Cancel
          </Button>
          <Button onClick={handleEmailUpdate} variant='contained' disabled={!newEmail || isUpdating}>
            {isUpdating ? <CircularProgress size={24} color='inherit' /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AccountSettings

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react' // Needed to authenticate API requests

// MUI Imports
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

// MUI Icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

const AccountSettings = () => {
  const { data: session, update: updateSession } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [tooltipText, setTooltipText] = useState("Copy ID")

  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const [userData, setUserData] = useState({
    name: '',
    email: '',
    userId: '',
    supportPin: '',
    wordsLimit: '5,000 / 5,000 words',
    chatsLimit: '25 / 25 chats'
  })

  // Fetch user data on component mount
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
              supportPin: data.user.supportPin || 'N/A'
            }))
          }
        } catch (error) {
          console.error("Failed to fetch user data:")
        } finally {
          setIsLoading(false)
        }
      }
    }

    if (session) fetchUserData()
  }, [session])

  // Handle Copy to Clipboard
  const handleCopyId = () => {
    if (userData.userId) {
      navigator.clipboard.writeText(userData.userId)
      setTooltipText("Copied!")
      setTimeout(() => setTooltipText("Copy ID"), 2000)
    }
  }

  // Handle Email Update Submission
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
        // Update local state
        setUserData(prev => ({ ...prev, email: data.user.email }))

        // Force NextAuth to update the session object with the new email
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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: '900px', p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', mb: 5 }}>
        Account Settings
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Profile Section */}
        <Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mb: 2 }}>
            Profile
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>

            {/* Name Row */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, p: 3, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500} mb={0.5}>
                  Name
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {userData.name}
                </Typography>
              </Box>
            </Box>

            {/* Email Row */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, p: 3, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500} mb={0.5}>
                  Email Address
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {userData.email}
                </Typography>
              </Box>
              <Button
                variant="contained"
                disableElevation
                onClick={() => setIsDialogOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
              >
                Update Email
              </Button>
            </Box>

            <Divider />

            {/* User ID Row */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, p: 3, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500} mb={0.5}>
                  User ID
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 500, bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1 }}>
                  {userData.userId}
                </Typography>
              </Box>
              <Tooltip title={tooltipText} placement="top">
                <IconButton color="primary" onClick={handleCopyId} sx={{ bgcolor: 'primary.50' }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Divider />

            {/* Support PIN Row */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, p: 3, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500} mb={0.5}>
                  Support PIN
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {userData.supportPin}
                </Typography>
              </Box>
            </Box>

          </Paper>
        </Box>

        {/* Beta Features Section (Unchanged) */}
        <Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mb: 2 }}>
            Beta Features
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
                Program Status
              </Typography>
              <Chip label="Disabled" size="small" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
            </Box>
            <Button variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}>
              Manage Features
            </Button>
          </Paper>
        </Box>

        {/* Subscription Section (Unchanged) */}
        <Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mb: 2 }}>
            Subscription
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
                Current Plan
              </Typography>
              <Chip
                label="Inactive"
                size="small"
                sx={{ fontWeight: 600, borderRadius: 1.5, bgcolor: 'error.main', color: 'error.contrastText' }}
              />
            </Box>
            <Button variant="contained" color="primary" disableElevation sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}>
              View Pricing
            </Button>
          </Paper>
        </Box>

        {/* Usage Section (Unchanged) */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, mb: 2 }}>
            Current Usage
          </Typography>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>

            {/* Words Progress */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Words Generated
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {userData.wordsLimit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={100}
                color="error"
                sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
              />
            </Box>

            {/* Chats Progress */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Active Chats
                  </Typography>
                  <Tooltip title="Total chat threads initiated this billing cycle">
                    <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', cursor: 'pointer' }} />
                  </Tooltip>
                </Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  {userData.chatsLimit}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={100}
                color="error"
                sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}
              />
            </Box>

          </Paper>
        </Box>

      </Box>

      {/* Update Email Modal Dialog */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Email Address</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {updateError && <Alert severity="error" sx={{ mb: 2 }}>{updateError}</Alert>}
            <TextField
              autoFocus
              margin="dense"
              label="New Email Address"
              type="email"
              fullWidth
              variant="outlined"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsDialogOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleEmailUpdate}
            variant="contained"
            disabled={!newEmail || isUpdating}
          >
            {isUpdating ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AccountSettings

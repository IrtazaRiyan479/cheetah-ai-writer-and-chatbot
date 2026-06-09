'use client'

import { useState } from 'react'

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

// MUI Icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

const AccountSettings = () => {
  const [userData] = useState({
    email: 'raoahsn84@gmail.com',
    userId: 'bce72e27-c15a-434d-bb2c-b05aae954104',
    supportPin: '3457',
    wordsLimit: '5,000 / 5,000 words',
    chatsLimit: '25 / 25 chats'
  })

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
              <Button variant="contained" disableElevation sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}>
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
              <Tooltip title="Copy ID">
                <IconButton color="primary" sx={{ bgcolor: 'primary.50' }}>
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

        {/* Beta Features Section */}
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

        {/* Subscription Section */}
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

        {/* Usage Section */}
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
    </Box>
  )
}

export default AccountSettings

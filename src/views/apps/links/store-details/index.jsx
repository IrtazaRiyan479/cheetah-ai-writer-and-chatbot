'use client'

// MUI Imports
import Grid from '@mui/material/Grid'

// Component Imports
import Profile from './Profile'

const StoreDetails = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Profile />
      </Grid>
    </Grid>
  )
}

export default StoreDetails

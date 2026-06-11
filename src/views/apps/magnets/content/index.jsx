'use client'

// MUI Imports
import Grid from '@mui/material/Grid'

// Component Imports
import MagnetsPage from './MagnetsPage'

const Content = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <MagnetsPage />
      </Grid>
    </Grid>
  )
}

export default Content

'use client'

// MUI Imports
import Grid from '@mui/material/Grid'

// Component Imports
import LinksPage from './LinksPage'

const Content = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <LinksPage />
      </Grid>
    </Grid>
  )
}

export default Content

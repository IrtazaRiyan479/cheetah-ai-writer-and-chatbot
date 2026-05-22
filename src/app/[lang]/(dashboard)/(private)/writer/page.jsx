'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'

// Component Imports
import ProductAddHeader from '@views/apps/writer/ProductAddHeader'
import ProductOrganize from '@views/apps/writer/ProductOrganize'
import ProductPricing from '@views/apps/writer/ProductPricing'
import ProductInformation from '@views/apps/writer/ProductInformation'

const CheetahWriter = () => {
  // LIFTED STATE: Now the whole page knows which article type is selected!
  const [selectedType, setSelectedType] = useState('blog')

  return (
    <Container maxWidth='md' className='p-0'>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <ProductAddHeader />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ProductPricing />
        </Grid>

        <Grid size={{ xs: 12 }}>
          {/* We pass the state down to the tiles */}
          <ProductOrganize selectedType={selectedType} setSelectedType={setSelectedType} />
        </Grid>

        <Grid size={{ xs: 12 }}>
          {/* We pass the state down to the form so it can change dynamically! */}
          <ProductInformation selectedType={selectedType} />
        </Grid>
      </Grid>
    </Container>
  )
}

export default CheetahWriter

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

  const [selectedType, setSelectedType] = useState('blog')
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash')

  return (
    <Container maxWidth='md' className='p-0'>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <ProductAddHeader />
        </Grid>

        <Grid size={{ xs: 12 }}>
          {/* 2. Passed the model state down to Pricing so the dropdown works */}
          <ProductPricing
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          {/* Passed the type state down to Organize */}
          <ProductOrganize
            selectedType={selectedType}
            setSelectedType={setSelectedType}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          {/* 3. Passed BOTH states down to the form so the "Create Article" button can use them! */}
          <ProductInformation
            selectedType={selectedType}
            selectedModel={selectedModel}
          />
        </Grid>
      </Grid>
    </Container>
  )
}

export default CheetahWriter

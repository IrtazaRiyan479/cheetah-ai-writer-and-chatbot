// MUI Imports
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'

// Component Imports
import ProductAddHeader from '@views/apps/ecommerce/products/add/ProductAddHeader'
import ProductOrganize from '@views/apps/ecommerce/products/add/ProductOrganize'
import ProductPricing from '@views/apps/ecommerce/products/add/ProductPricing' // Our new Model/Preset component
import ProductInformation from '@views/apps/ecommerce/products/add/ProductInformation'

const CheetahWriter = () => {
  return (
    <Container maxWidth='md' className='p-0'>
      <Grid container spacing={6}>

        {/* Top Header */}
        <Grid size={{ xs: 12 }}>
          <ProductAddHeader />
        </Grid>

                {/* AI Model & Presets (ADDED HERE) */}
        <Grid size={{ xs: 12 }}>
          <ProductPricing />
        </Grid>

        {/* Article Type Selection (The clickable tiles) */}
        <Grid size={{ xs: 12 }}>
          <ProductOrganize />
        </Grid>

        {/* Main Article Settings (Target Keyword, Tone, etc.) */}
        <Grid size={{ xs: 12 }}>
          <ProductInformation />
        </Grid>

      </Grid>
    </Container>
  )
}

export default CheetahWriter

'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

// Import Field Components
import BlogFields from './fields/BlogFields'
import ListicleFields from './fields/ListicleFields'
import AmazonRoundupFields from './fields/AmazonRoundupFields'
import AmazonReviewFields from './fields/AmazonReviewFields'
import YoutubeBlogFields from './fields/YoutubeBlogFields'
import LocalRoundupFields from './fields/LocalRoundupFields'
import RewriteFields from './fields/RewriteFields'

const ProductInformation = ({ selectedType }) => {
  // State for the visual toggle text
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Map the selected string ID to the correct component file
  const ComponentMap = {
    'blog': BlogFields,
    'listicle': ListicleFields,
    'amazon-roundup': AmazonRoundupFields,
    'amazon-review': AmazonReviewFields,
    'youtube-blog': YoutubeBlogFields,
    'local-roundup': LocalRoundupFields,
    'rewrite': RewriteFields
  }

  // Fallback to BlogFields if something goes wrong
  const ActiveFields = ComponentMap[selectedType] || BlogFields

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>

        {/* Main Form Area */}
        <Grid container spacing={5}>
          {/* Renders the entire form block for the selected type */}
          <ActiveFields />

          {/* Advanced Options Toggle Link (Anchored at the bottom left of the form) */}
          <Grid size={{ xs: 12 }}>
            <div
              className='inline-flex items-center gap-1 mt-2 cursor-pointer text-primary hover:text-primaryDark transition-colors'
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Typography className='font-medium color-inherit'>
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              </Typography>
              <i className={showAdvanced ? 'ri-arrow-up-s-line text-xl' : 'ri-arrow-down-s-line text-xl'} />
            </div>
          </Grid>
        </Grid>

        {/* ==========================================
            BOTTOM ACTIONS SECTION
            ========================================== */}
        <Divider className='my-6' />

        <div className='flex items-center justify-between flex-wrap gap-4'>

          {/* Left Side: Current Usage Stats */}
          <div className='flex items-center gap-4 text-textSecondary'>
            <div className='flex items-center gap-1'>
              <i className='ri-line-chart-line text-lg' />
              <Typography variant='caption' className='font-medium text-sm'>Current Usage:</Typography>
            </div>
            <Typography variant='caption' className='text-sm'>0 / 0 words</Typography>
            <Typography variant='caption' className='text-sm'>0 / 0 messages</Typography>
          </div>

          {/* Right Side: Create Article Button */}
          <Button
            variant='contained'
            color='primary'
            size='large'
            className='px-8 py-2.5 text-base font-bold rounded-md'
          >
            Create Article
          </Button>

        </div>

      </CardContent>
    </Card>
  )
}

export default ProductInformation

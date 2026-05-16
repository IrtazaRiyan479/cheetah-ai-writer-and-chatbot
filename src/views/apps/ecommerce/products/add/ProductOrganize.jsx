'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

// Third-party Imports
import classnames from 'classnames'

// Define your article types here
const articleTypes = [
  { id: 'blog', title: 'Blog Post', icon: 'ri-article-line' },
  { id: 'listicle', title: 'Listicle', icon: 'ri-list-check-2' },
  { id: 'local-roundup', title: 'Local Places Roundup', icon: 'ri-map-pin-2-line' },
  { id: 'amazon-roundup', title: 'Amazon Product Roundup', icon: 'ri-shopping-cart-line' },
  { id: 'amazon-review', title: 'Amazon Single Product Review', icon: 'ri-star-line' },
  { id: 'youtube-blog', title: 'YouTube Video to Blog Post', icon: 'ri-youtube-line' },
  { id: 'rewrite', title: 'Rewrite Blog Post', icon: 'ri-edit-2-line' }
]

const ProductOrganize = () => {
  // State to track which card is currently clicked
  const [selectedType, setSelectedType] = useState('blog')

  return (
    <div className='flex flex-col gap-3'>
      {/* Label sits outside the box, just like Koala */}
      <Typography variant='h6' className='font-semibold'>
        Article Type
      </Typography>

      <Grid container spacing={4}>
        {articleTypes.map(type => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={type.id}>
            <Card
              onClick={() => setSelectedType(type.id)}
              className={classnames(
                'cursor-pointer transition-all duration-200 border-2 shadow-sm',
                selectedType === type.id
                  ? 'border-primary bg-[var(--mui-palette-primary-lightOpacity)]' // Active state (Bright border, tinted bg)
                  : 'border-transparent hover:border-actionHover bg-backgroundPaper' // Inactive state
              )}
            >
              <CardContent className='flex flex-col items-center justify-center gap-2 text-center p-6'>
                <i
                  className={classnames(
                    type.icon,
                    'text-3xl',
                    selectedType === type.id ? 'text-primary' : 'text-textSecondary'
                  )}
                />
                <Typography
                  className={classnames(
                    'font-medium',
                    selectedType === type.id ? 'text-primary' : 'text-textPrimary'
                  )}
                >
                  {type.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default ProductOrganize

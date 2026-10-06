'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import classnames from 'classnames'

const articleTypes = [
  { id: 'blog', title: 'Blog Post', caption: 'Standard article from a keyword', icon: 'ri-article-line' },
  { id: 'listicle', title: 'Listicle', caption: 'Structured list with useful takeaways', icon: 'ri-list-check-2' },
  {
    id: 'local-roundup',
    title: 'Local Places Roundup',
    caption: 'Curated local businesses and places',
    icon: 'ri-map-pin-2-line'
  },
  {
    id: 'amazon-roundup',
    title: 'Amazon Product Roundup',
    caption: 'Product table or ranked Top Pick cards',
    icon: 'ri-shopping-cart-line'
  },
  {
    id: 'amazon-review',
    title: 'Amazon Single Product Review',
    caption: 'In-depth review of one Amazon product',
    icon: 'ri-star-line'
  },
  {
    id: 'product-comparison',
    title: 'Product Comparison',
    caption: 'Compare 2 or 3 Amazon products side by side',
    icon: 'ri-scales-3-line'
  },
  {
    id: 'youtube-blog',
    title: 'YouTube Video to Blog Post',
    caption: 'Turn a video into a readable article',
    icon: 'ri-youtube-line'
  },
  { id: 'rewrite', title: 'Rewrite Blog Post', caption: 'Refresh an existing article', icon: 'ri-edit-2-line' },
  {
    id: 'amazon-roundup-rewrite',
    title: 'Rewrite Amazon Roundup',
    caption: 'Refresh an existing roundup',
    icon: 'ri-shopping-bag-3-line'
  },
  {
    id: 'amazon-review-rewrite',
    title: 'Rewrite Amazon Single Product Review',
    caption: 'Refresh an existing single-product review',
    icon: 'ri-star-smile-line'
  }
]

const ArticleTypeMenu = ({ selectedType, setSelectedType }) => {
  return (
    <div className='flex flex-col gap-3'>
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
                  ? 'border-primary bg-[var(--mui-palette-primary-lightOpacity)]'
                  : 'border-transparent hover:border-actionHover bg-backgroundPaper'
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
                  className={classnames('font-medium', selectedType === type.id ? 'text-primary' : 'text-textPrimary')}
                >
                  {type.title}
                </Typography>
                <Typography variant='caption' color='text.secondary' className='max-w-[240px]'>
                  {type.caption}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default ArticleTypeMenu

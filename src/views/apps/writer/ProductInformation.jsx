'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'

import BlogFields from './fields/BlogFields'
import ListicleFields from './fields/ListicleFields'
import AmazonRoundupFields from './fields/AmazonRoundupFields'
import AmazonReviewFields from './fields/AmazonReviewFields'
import YoutubeBlogFields from './fields/YoutubeBlogFields'
import LocalRoundupFields from './fields/LocalRoundupFields'
import RewriteFields from './fields/RewriteFields'

// 1. Accept selectedModel as a prop
const ProductInformation = ({ selectedType, selectedModel }) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const ComponentMap = {
    'blog': BlogFields,
    'listicle': ListicleFields,
    'amazon-roundup': AmazonRoundupFields,
    'amazon-review': AmazonReviewFields,
    'youtube-blog': YoutubeBlogFields,
    'local-roundup': LocalRoundupFields,
    'rewrite': RewriteFields
  }

  const ActiveFields = ComponentMap[selectedType] || BlogFields

  // 2. This function sends the selected model to rotate the API!
  const handleCreateArticle = async () => {
    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write a short, professional ${selectedType} article.`,
          model: selectedModel // <--- THIS rotates the model dynamically
        })
      })

      const data = await res.json()

      if(data.success) {
        console.log("Success! Used Model:", selectedModel)
        console.log("Generated Text:", data.text)
        alert(`Article generated successfully using ${selectedModel}! Check your browser console to read it.`)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error generating article:", error)
      alert("Failed to generate article.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>
        <Grid container spacing={5}>
          <ActiveFields />

          <Grid size={{ xs: 12 }}>
            <div
              className='flex items-center gap-1 cursor-pointer w-fit text-primary mbe-2'
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Typography variant='subtitle2' className='font-medium color-inherit'>
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              </Typography>
              <i className={showAdvanced ? 'ri-arrow-up-s-line text-xl' : 'ri-arrow-down-s-line text-xl'} />
            </div>
          </Grid>
        </Grid>

        <Divider className='my-6' />

        <div className='flex items-center justify-between flex-wrap gap-4'>
          <div className='flex items-center gap-4 text-textSecondary'>
            <div className='flex items-center gap-1'>
              <i className='ri-line-chart-line text-lg' />
              <Typography variant='caption' className='font-medium text-sm'>Current Usage:</Typography>
            </div>
            <Typography variant='caption' className='text-sm'>0 / 0 words</Typography>
            <Typography variant='caption' className='text-sm'>0 / 0 messages</Typography>
          </div>

          {/* 3. Attach the function to the button */}
          <Button
            variant='contained'
            color='primary'
            size='large'
            className='px-8 py-2.5 text-base font-bold rounded-md'
            onClick={handleCreateArticle}
            disabled={isGenerating}
          >
            {isGenerating ? <CircularProgress size={24} color="inherit" /> : 'Create Article'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProductInformation

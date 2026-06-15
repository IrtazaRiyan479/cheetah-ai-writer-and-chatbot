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

import { toast } from 'react-toastify'

const WriterPage = ({ settings, updateSetting, setStep, setOutline }) => {
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

  const ActiveFields = ComponentMap[settings.type] || BlogFields

const handleCreateArticle = async () => {

    if (!settings.targetKeyword || settings.targetKeyword.trim() === '') {
      if (settings.type === 'amazon-review') {
        if (!settings.amazonProductUrl) {
          toast.error("Please provide either an Amazon Product URL or a Target Keyword.");
          return;
        }
      } else if (settings.type === 'amazon-roundup') {
        if (!settings.amazonSearchUrl) {
          toast.error("Please provide either an Amazon Search URL or a Target Keyword.");
          return;
        }
      } else {
        toast.error("Target Keyword is required for this template.");
        return;
      }
    }

  if (settings.deepSearch) {
      toast.error('Premium Feature: You do not have a paid plan. Please upgrade your account to use Deep Search.', {
        position: 'top-right',
        autoClose: 5000
      })
      return // Stop the function from generating
    }

    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'outline',
          settings: settings,
          targetKeyword: settings.targetKeyword || 'General Topic',
          model: settings.model,
          articleLength: settings.articleLength,
          customArticleLength: settings.customArticleLength,
          language: settings.language,
          country: settings.country,
          automaticExternalLinks: settings.automaticExternalLinks,
          includeFaq: settings.includeFaq,
          includeKeyTakeaways: settings.includeKeyTakeaways
        })
      })

      const data = await res.json()

      console.log("FULL RESPONSE FROM /api/generate:", data)
      if (data.success) {
        // Save the AI's JSON outline to your global page.jsx state
        updateSetting('generatedTitle', data.title)
        if (data.externalLinks) updateSetting('fetchedExternalLinks', data.externalLinks)
        setOutline(data.outline)

        // NOW route the user to the correct screen
        if (settings.useOutlineEditor) {
          setStep(1) // Go to Outline Editor
        } else {
          setStep(2) // Skip directly to Article Writer
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error generating outline:", error)
      alert("Failed to generate outline. Check console.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>
        <Grid container spacing={5}>
          {/* settings and updateSetting are now defined! */}
          <ActiveFields settings={settings} updateSetting={updateSetting} />

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

         <Button
            variant='contained'
            color='primary'
            size='large'
            className='px-8 py-2.5 text-base font-bold rounded-md'
            onClick={handleCreateArticle}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <CircularProgress size={24} color="inherit" />
            ) : settings.useOutlineEditor ? (
              'Create Outline'
            ) : (
              'Create Article'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default WriterPage

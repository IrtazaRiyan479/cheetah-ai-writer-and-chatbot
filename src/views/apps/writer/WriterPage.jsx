'use client'

import { useState, useEffect } from 'react'

import { useSearchParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'

import { toast } from 'react-toastify'

import { serializeError } from '@/utils/serializeError'

import BlogFields from './fields/BlogFields'
import ListicleFields from './fields/ListicleFields'
import AmazonRoundupFields from './fields/AmazonRoundupFields'
import AmazonReviewFields from './fields/AmazonReviewFields'
import YoutubeBlogFields from './fields/YoutubeBlogFields'
import LocalRoundupFields from './fields/LocalRoundupFields'
import RewriteFields from './fields/RewriteFields'
import ProductComparisonFields from './fields/ProductComparisonFields'

const WriterPage = ({ settings, updateSetting, setStep, setOutline }) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draftId')

  const ComponentMap = {
    blog: BlogFields,
    listicle: ListicleFields,
    'amazon-roundup': AmazonRoundupFields,
    'amazon-review': AmazonReviewFields,
    'youtube-blog': YoutubeBlogFields,
    'local-roundup': LocalRoundupFields,
    rewrite: RewriteFields,
    'amazon-roundup-rewrite': RewriteFields,
    'amazon-review-rewrite': RewriteFields,
    'product-comparison': ProductComparisonFields
  }

  const ActiveFields = ComponentMap[settings.type] || BlogFields

  useEffect(() => {
    if (draftId) {
      setStep(2)
    }
  }, [draftId, setStep])

  const handleCreateArticle = async () => {
    const isRewriteType =
      settings.type === 'rewrite' ||
      settings.type === 'amazon-roundup-rewrite' ||
      settings.type === 'amazon-review-rewrite'

    if (settings.type === 'product-comparison') {
      const links = Array.isArray(settings.productComparisonUrls) ? settings.productComparisonUrls.map(value => String(value || '').trim()).filter(Boolean) : []

      if (links.length < 2 || links.length > 3 || links.some(value => {
        try { return !['http:', 'https:'].includes(new URL(value).protocol) } catch { return true }
      })) {
        toast.error('Provide two or three valid Amazon product URLs.')
        return
      }
    }

    if (isRewriteType && !String(settings.articleUrlToRewrite || '').trim()) {
      toast.error('Please provide an article URL to rewrite.')

      return
    }

    if (!settings.targetKeyword || settings.targetKeyword.trim() === '') {
      if (settings.type === 'amazon-review') {
        if (!settings.amazonProductUrl) {
          toast.error('Please provide either an Amazon Product URL or a Target Keyword.')

          return
        }
      } else if (settings.type === 'amazon-roundup') {
        if (!settings.amazonSearchUrl) {
          toast.error('Please provide either an Amazon Search URL or a Target Keyword.')

          return
        }
      } else if (!isRewriteType && settings.type !== 'product-comparison') {
        toast.error('Target Keyword is required for this template.')

        return
      }
    }

    // if (settings.deepSearch) {
    //     toast.error('Premium Feature: You do not have a paid plan. Please upgrade your account to use Deep Search.', {
    //       position: 'top-right',
    //       autoClose: 5000
    //     })
    //     return // Stop the function from generating
    //   }

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

      if (data.success) {
        updateSetting('generatedTitle', data.title)
        if (data.externalLinks) updateSetting('fetchedExternalLinks', data.externalLinks)

        if (data.heroImage) {
          updateSetting('heroImage', data.heroImage)
        }

        if (data.heroImageId != null) {
          updateSetting('heroImageId', data.heroImageId)
        }

        if (data.heroImageSource) {
          updateSetting('heroImageSource', data.heroImageSource)
        }
        if (data.comparisonShared) updateSetting('comparisonShared', data.comparisonShared)
        if (data.metaTitle) updateSetting('metaTitle', data.metaTitle)
        if (data.metaDescription) updateSetting('metaDescription', data.metaDescription)
        setOutline(data.outline)

        if (settings.useOutlineEditor) {
          setStep(1)
        } else {
          setStep(2)
        }
      } else {
        throw new Error(serializeError(data?.error || data))
      }
    } catch (error) {
      console.error('Error generating outline:', serializeError(error))
      const msg = serializeError(error)

      if (settings.type === 'product-comparison') {
        toast.error(`Failed to generate outline: ${msg}`, { autoClose: 6000 })
      } else if (/RATE_LIMIT|429|quota|resource.?exhausted/i.test(msg)) {
        toast.error('Gemini free rate limit hit. Wait ~60s, or reduce concurrent usage. Outline was not generated.', {
          autoClose: 8000
        })
      } else if (/OUTLINE_PARSE_FAILED/i.test(msg)) {
        toast.error('Outline generation returned invalid data after retries. Try again, or shorten the topic.', {
          autoClose: 7000
        })
      } else {
        toast.error(`Failed to generate outline: ${msg}`, { autoClose: 6000 })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className='shadow-sm'>
      <CardContent className='p-4 sm:p-6'>
        <Grid container spacing={5}>
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
              <Typography variant='caption' className='font-medium text-sm'>
                Current Usage:
              </Typography>
            </div>
            <Typography variant='caption' className='text-sm'>
              0 / 0 words
            </Typography>
            <Typography variant='caption' className='text-sm'>
              0 / 0 messages
            </Typography>
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
              <CircularProgress size={24} color='inherit' />
            ) : settings.useOutlineEditor ? (
              'Create Outline'
            ) : (
              'Create Article'
            )}
          </Button>
          <Button
            variant='outlined'
            disabled={isGenerating}
            onClick={async () => {
              const lines = window.prompt('Pro/admin batch: one keyword per line')

              if (!lines) return

              const articles = lines
                .split('\n')
                .map(keyword => keyword.trim())
                .filter(Boolean)
                .map(keyword => ({ settings: { ...settings, targetKeyword: keyword } }))

              const res = await fetch('/api/generate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articles })
              })

              const data = await res.json()

              if (!data.success) toast.error(serializeError(data.error))
              else toast.success(`Batch ${data.batch.status}: ${data.batch.nextIndex}/${data.batch.total}`)
            }}
          >
            Batch
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default WriterPage

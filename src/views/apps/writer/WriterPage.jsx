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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'

import { toast } from 'react-toastify'

import { serializeError } from '@/utils/serializeError'
import { rewriteAcceptsSource, rewriteSourceError } from '@/app/api/generate/utils/articleHtml'

import BlogFields from './fields/BlogFields'
import ListicleFields from './fields/ListicleFields'
import AmazonRoundupFields from './fields/AmazonRoundupFields'
import AmazonReviewFields from './fields/AmazonReviewFields'
import YoutubeBlogFields from './fields/YoutubeBlogFields'
import LocalRoundupFields from './fields/LocalRoundupFields'
import RewriteFields from './fields/RewriteFields'
import AmazonRoundupRewriteFields from './fields/AmazonRoundupRewriteFields'
import AmazonReviewRewriteFields from './fields/AmazonReviewRewriteFields'
import ProductComparisonFields from './fields/ProductComparisonFields'

const WriterPage = ({ settings, updateSetting, setStep, setOutline }) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [usage, setUsage] = useState(null)
  const [isPaid, setIsPaid] = useState(false)
  const [featureModes, setFeatureModes] = useState({})
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [premiumMessage, setPremiumMessage] = useState('')
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchKeywords, setBatchKeywords] = useState('')
  const [isBatching, setIsBatching] = useState(false)
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
    'amazon-roundup-rewrite': AmazonRoundupRewriteFields,
    'amazon-review-rewrite': AmazonReviewRewriteFields,
    'product-comparison': ProductComparisonFields
  }

  const ActiveFields = ComponentMap[settings.type] || BlogFields

  useEffect(() => {
    let active = true

    fetch('/api/user/settings')
      .then(response => response.json())
      .then(data => {
        if (!active || !data.user) return
        setIsPaid(Boolean(data.user.paid))
        setFeatureModes(data.featureModes || {})
        if (Number.isFinite(Number(data.user.wordsUsed)) && Number.isFinite(Number(data.user.wordsLimit))) {
          setUsage({ wordsUsed: Number(data.user.wordsUsed), wordsLimit: Number(data.user.wordsLimit) })
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const runBatch = async () => {
    const keywords = batchKeywords
      .split('\n')
      .map(keyword => keyword.trim())
      .filter(Boolean)

    if (!keywords.length) return
    setIsBatching(true)

    try {
      const articles = keywords.map(keyword => ({ settings: { ...settings, targetKeyword: keyword } }))
      const response = await fetch('/api/generate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles })
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        if ([402, 403].includes(response.status)) throw new Error('Upgrade to Pro to use batch generation.')
        throw new Error(serializeError(data?.error || data))
      }

      toast.success(`Batch ${data.batch.status}: ${data.batch.nextIndex}/${data.batch.total}`)
      setBatchOpen(false)
      setBatchKeywords('')
    } catch (error) {
      toast.error(serializeError(error))
    } finally {
      setIsBatching(false)
    }
  }

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
    let requestSettings = settings

    if (settings.type === 'product-comparison') {
      const normalizeAmazonInput = value => {
        const raw = String(value || '').trim()
        if (!raw) return ''
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw
        if (/^(?:www\.)?(?:amazon\.[a-z.]+|amzn\.to)\/.+/i.test(raw)) return `https://${raw}`
        return raw
      }
      const links = Array.isArray(settings.productComparisonUrls)
        ? settings.productComparisonUrls.map(value => normalizeAmazonInput(value)).filter(Boolean)
        : []

      if (
        links.length < 2 ||
        links.length > 3 ||
        links.some(value => {
          try {
            return !['http:', 'https:'].includes(new URL(value).protocol)
          } catch {
            return true
          }
        })
      ) {
        toast.error('Provide two or three valid Amazon product URLs.')

        return
      }

      requestSettings = { ...settings, productComparisonUrls: links }
      updateSetting('productComparisonUrls', links)
    }

    if (isRewriteType && !String(settings.articleUrlToRewrite || '').trim()) {
      toast.error('Please provide an article URL to rewrite.')

      return
    }

    if (settings.type === 'amazon-roundup-rewrite' || settings.type === 'amazon-review-rewrite') {
      if (!settings.sourceArticleType) {
        toast.error('Wait for the article URL to finish validating.')

        return
      }

      if (!rewriteAcceptsSource(settings.type, settings.sourceArticleType)) {
        toast.error(rewriteSourceError(settings.type))

        return
      }
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
          settings: requestSettings,
          targetKeyword: requestSettings.targetKeyword || 'General Topic',
          model: requestSettings.model,
          articleLength: requestSettings.articleLength,
          customArticleLength: requestSettings.customArticleLength,
          language: requestSettings.language,
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

        if (data.fetchedTranscript) updateSetting('fetchedTranscript', data.fetchedTranscript)
        if (data.fetchedVideoTitle) updateSetting('fetchedVideoTitle', data.fetchedVideoTitle)
        if (data.youtubeDurationSeconds) updateSetting('youtubeDurationSeconds', data.youtubeDurationSeconds)
        if (data.youtubeThumbnail) updateSetting('youtubeThumbnail', data.youtubeThumbnail)
        if (data.youtubeVideoId) updateSetting('youtubeVideoId', data.youtubeVideoId)
        if (data.youtubeTranscriptSource) updateSetting('youtubeTranscriptSource', data.youtubeTranscriptSource)

        if (data.comparisonShared) updateSetting('comparisonShared', data.comparisonShared)
        if (data.metaTitle) updateSetting('metaTitle', data.metaTitle)
        if (data.metaDescription) updateSetting('metaDescription', data.metaDescription)
        setOutline(data.outline)

        if (settings.useOutlineEditor) {
          setStep(1)
        } else {
          setStep(2)
        }
      } else if (res.status === 402 || data?.code === 'PRO_REQUIRED' || data?.code === 'WORD_LIMIT') {
        setPremiumMessage(serializeError(data?.error || data) || 'This requires a Pro plan or more free words.')
        setPremiumOpen(true)
      } else if (data?.code === 'PAID_KEYS_FAILED') {
        toast.error('Low credits.')
      } else {
        throw new Error(serializeError(data?.error || data))
      }
    } catch (error) {
      console.error('Error generating outline:', serializeError(error))
      const msg = serializeError(error)

      if (/Pro plan|word limit|402/i.test(msg)) {
        setPremiumMessage(msg)
        setPremiumOpen(true)
      } else if (settings.type === 'product-comparison') {
        toast.error(`Failed to generate outline: ${msg}`, { autoClose: 6000 })
      } else if (/RATE_LIMIT|429|quota|resource.?exhausted/i.test(msg)) {
        toast.error('The writing provider hit a limit and will retry the next key/provider.', { autoClose: 8000 })
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

          {/* Show Advanced Options temporarily disabled
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
          */}
        </Grid>

        <Divider className='my-6' />

        <div className='flex items-center justify-between flex-wrap gap-4'>
          <div className='flex items-center gap-4 text-textSecondary'>
            <div className='flex items-center gap-1'>
              <i className='ri-line-chart-line text-lg' />
              <Typography variant='caption' className='font-medium text-sm'>
                Word balance:
              </Typography>
              {usage ? (
                <Typography variant='caption' className='text-sm'>
                  {usage.wordsUsed.toLocaleString()} / {usage.wordsLimit.toLocaleString()} words
                </Typography>
              ) : null}
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              variant='contained'
              color='primary'
              size='large'
              className='px-8 py-2.5 text-base font-bold rounded-md'
              onClick={handleCreateArticle}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating outline…' : settings.useOutlineEditor ? 'Create Outline' : 'Create Article'}
            </Button>
            {featureModes['batch-generate'] === 'off' ? null : (
              <Button
                variant='outlined'
                disabled={isGenerating || isBatching}
                onClick={() => {
                  if (!isPaid && (featureModes['batch-generate'] || 'pro') === 'pro') {
                    setPremiumMessage('Batch generation is a Pro feature. Buy a word pack to unlock it.')
                    setPremiumOpen(true)
                    return
                  }
                  setBatchOpen(true)
                }}
              >
                {(featureModes['batch-generate'] || 'pro') === 'pro' && !isPaid ? '⭐ ' : ''}
                Batch
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      <Dialog open={batchOpen} onClose={() => !isBatching && setBatchOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Batch generation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={6}
            label='Keywords, one per line'
            value={batchKeywords}
            onChange={event => setBatchKeywords(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchOpen(false)} disabled={isBatching}>
            Cancel
          </Button>
          <Button variant='contained' onClick={runBatch} disabled={isBatching || !batchKeywords.trim()}>
            {isBatching ? <CircularProgress size={20} color='inherit' /> : 'Run batch'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={premiumOpen} onClose={() => setPremiumOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Pro feature</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>{premiumMessage || 'This feature requires a Pro plan.'}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPremiumOpen(false)}>Close</Button>
          <Button
            variant='contained'
            onClick={() => {
              setPremiumOpen(false)
              window.location.href = '/en/home#pricing'
            }}
          >
            View pricing
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default WriterPage

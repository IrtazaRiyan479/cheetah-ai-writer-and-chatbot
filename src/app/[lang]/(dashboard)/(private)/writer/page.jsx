'use client'

import { useState, useEffect } from 'react'

import { useSearchParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import WriterIntro from '@views/apps/writer/WriterIntro'
import ArticleTypeMenu from '@views/apps/writer/ArticleTypeMenu'
import WriterHeader from '@views/apps/writer/WriterHeader'
import WriterPage from '@views/apps/writer/WriterPage'
import OutlineEditor from '@views/apps/writer/OutlineEditor'
import ArticleEditor from '@views/apps/writer/ArticleEditor'
import { FeatureAccessProvider } from '@views/apps/writer/FeatureAccessContext'
import ModuleGate from '@/components/access/ModuleGate'

const defaultSettings = {
  model: 'gemini-3.1-flash-lite',
  type: 'blog',
  targetKeyword: '',
  internalLinking: [],
  customInternalLink: '',
  seoOptimization: 'default',
  aiImagesAndVideos: 'none',
  articleLength: 'default',
  toneOfVoice: 'seo',
  language: 'en',
  country: 'US',
  pointOfView: 'third',
  automaticExternalLinks: false,
  citeSources: false,
  useRealTimeSearchData: false,
  realTimeDataSource: 'search',
  deepSearch: false,
  includeFaq: false,
  includeKeyTakeaways: false,
  improveReadability: false,
  generatedTitle: '',
  numberOfYoutubeVideos: '',
  numberOfImages: '',
  amazonProductUrl: '',
  amazonSearchUrl: '',
  amazonTrackingId: '',
  articleUrlToRewrite: '',
  youtubeUrl: '',
  numberOfProducts: '5',
  totalListItems: '10',
  listItemPrompt: '',
  numberOfPlaces: '10',
  listNumberingFormat: '1.',
  useOutlineEditor: false,
  enableFirstHandExperience: false,
  enableCondensedMode: false,
  enableSupplementalInformation: false,
  enableAutoLength: false,
  useDescendingOrder: false,
  enableRewriting: false,
  includeExternalLinks: false,
  enableCaptionRewriting: false,
  generateUniqueMapImages: false,
  manualKeywords: '',
  customArticleLength: 5,
  customToneOfVoice: '',
  amazonDomain: 'amazon.com'
}

function normalizeOutlineItems(items) {
  if (!Array.isArray(items)) return []

  return items.map((item, index) => {
    if (typeof item === 'string') return { id: `heading-${index}`, type: 'h2', text: item }

    return {
      id: item?.id || `heading-${index}`,
      type: item?.type || 'h2',
      text: String(item?.text || item?.heading || item?.title || '')
    }
  })
}

function unpackOutlineArticle(article) {
  let parsed = null

  try {
    parsed = article?.outline ? JSON.parse(article.outline) : null
  } catch {
    parsed = null
  }

  const savedSettings =
    parsed && !Array.isArray(parsed) && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
  const items = Array.isArray(parsed) ? parsed : parsed?.outline
  const imgMatch = String(article?.content || '').match(/<img[^>]+src=["']([^"']+)["']/i)
  const heroImage =
    parsed?.heroImage ||
    parsed?.image ||
    savedSettings.heroImage ||
    savedSettings.youtubeThumbnail ||
    (imgMatch ? imgMatch[1] : '') ||
    ''

  return {
    title: article?.title || savedSettings.generatedTitle || '',
    settings: {
      ...savedSettings,
      heroImage: heroImage || savedSettings.heroImage || '',
      generatedTitle: savedSettings.generatedTitle || article?.title || '',
      targetKeyword: savedSettings.targetKeyword || article?.title || '',
      useOutlineEditor: true
    },
    outline: normalizeOutlineItems(items)
  }
}

const AffiGenieWriter = () => {
  const [settings, setSettings] = useState(defaultSettings)
  const [presets, setPresets] = useState([])
  const [selectedPresetId, setSelectedPresetId] = useState('default')
  const [step, setStep] = useState(0)
  const [outline, setOutline] = useState([])
  const searchParams = useSearchParams()
  const outlineId = searchParams.get('outlineId')
  const [hydratingOutline, setHydratingOutline] = useState(Boolean(outlineId))
  const [outlineError, setOutlineError] = useState('')

  useEffect(() => {
    if (!outlineId) return

    let cancelled = false

    const loadOutline = async () => {
      setHydratingOutline(true)
      setOutlineError('')

      try {
        const res = await fetch(`/api/drafts?id=${encodeURIComponent(outlineId)}`)
        const data = await res.json()

        if (!res.ok || !data.article) {
          throw new Error(data?.error || 'Outline not found')
        }

        const loaded = unpackOutlineArticle(data.article)

        if (cancelled) return

        setSettings({ ...defaultSettings, ...loaded.settings })
        setOutline(loaded.outline)
        setStep(1)
      } catch (error) {
        if (!cancelled) {
          setOutlineError(error?.message || 'Could not open this outline.')
          setStep(0)
        }
      } finally {
        if (!cancelled) setHydratingOutline(false)
      }
    }

    loadOutline()

    return () => {
      cancelled = true
    }
  }, [outlineId])

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets')
      const data = await res.json()

      if (Array.isArray(data)) {
        setPresets(data)
      } else {
        console.error('API did not return an array:', data)
        setPresets([])
      }
    } catch (error) {
      console.error('Failed to fetch presets:', error)
      setPresets([])
    }
  }

  useEffect(() => {
    fetchPresets()
  }, [])

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleLoadPreset = presetId => {
    setSelectedPresetId(presetId)

    if (presetId === 'default') {
      setSettings(defaultSettings)

      return
    }

    const preset = presets.find(p => p.id === presetId)

    if (preset) {
      setSettings({ ...JSON.parse(preset.settings), targetKeyword: '' })
    }
  }

  const handleCreatePreset = async name => {
    const { targetKeyword, fetchedTranscript, ...settingsToSave } = settings

    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings: settingsToSave })
    })

    const newPreset = await res.json()

    setPresets(prev => [...prev, newPreset])
    setSelectedPresetId(newPreset.id)
  }

  const handleUpdatePreset = async () => {
    if (selectedPresetId === 'default') return
    const { targetKeyword, fetchedTranscript, ...settingsToSave } = settings

    await fetch('/api/presets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedPresetId, settings: settingsToSave })
    })
    alert('Preset saved successfully!')
  }

  const handleDeletePreset = async () => {
    if (selectedPresetId === 'default') return
    await fetch('/api/presets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedPresetId })
    })
    setPresets(prev => prev.filter(p => p.id !== selectedPresetId))
    handleLoadPreset('default')
  }

  return (
    <ModuleGate featureKey='module-writer'>
    <FeatureAccessProvider>
    <Container maxWidth={step === 1 ? false : 'md'} className={step === 1 ? 'w-full max-w-none p-0' : 'p-0'}>
      {hydratingOutline ? (
        <div className='flex items-center gap-3 p-6'>
          <CircularProgress size={28} />
          <Typography>Opening outline…</Typography>
        </div>
      ) : null}
      {outlineError && step === 0 ? (
        <Typography color='error' className='p-6'>
          {outlineError}
        </Typography>
      ) : null}
      {step === 0 && !hydratingOutline && (
        <Grid container spacing={6}>
          <Grid size={{ xs: 12 }}>
            <WriterIntro />
          </Grid>

          <Grid size={{ xs: 12 }}>
            {/* Pass the state and functions to Pricing to power the UI */}
            <WriterHeader
              settings={settings}
              updateSetting={updateSetting}
              presets={presets}
              selectedPresetId={selectedPresetId}
              onLoadPreset={handleLoadPreset}
              onCreatePreset={handleCreatePreset}
              onUpdatePreset={handleUpdatePreset}
              onDeletePreset={handleDeletePreset}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ArticleTypeMenu
              selectedType={settings.type}
              setSelectedType={val => {
                setSettings(prev => ({
                  ...defaultSettings,
                  model: prev.model,
                  type: val
                }))
              }}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <WriterPage settings={settings} updateSetting={updateSetting} setStep={setStep} setOutline={setOutline} />
          </Grid>
        </Grid>
      )}

      {step === 1 && !hydratingOutline && (
        <OutlineEditor settings={settings} setStep={setStep} outline={outline} setOutline={setOutline} />
      )}

      {step === 2 && (
        <ArticleEditor
          settings={settings}
          setSettings={setSettings}
          setStep={setStep}
          outline={outline}
          setOutline={setOutline}
        />
      )}
    </Container>
    </FeatureAccessProvider>
    </ModuleGate>
  )
}

export default AffiGenieWriter

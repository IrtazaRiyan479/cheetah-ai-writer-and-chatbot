'use client'

import { useState, useEffect } from 'react'
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'

import WriterIntro from '@views/apps/writer/WriterIntro'
import ArticleTypeMenu from '@views/apps/writer/ArticleTypeMenu'
import WriterHeader from '@views/apps/writer/WriterHeader'
import WriterPage from '@views/apps/writer/WriterPage'
import OutlineEditor from '@views/apps/writer/OutlineEditor'
import ArticleEditor from '@views/apps/writer/ArticleEditor'

const defaultSettings = {
  // Existing Base Fields
  model: 'gemini-3.1-flash-lite',
  type: 'blog',
  targetKeyword: '',
  internalLinking: [],
  customInternalLink: '', //
  seoOptimization: 'default',
  aiImagesAndVideos: 'none',
  articleLength: 'default',
  toneOfVoice: 'seo',
  language: 'en',
  country: 'US',
  pointOfView: 'third',
  automaticExternalLinks: true,
  citeSources: false,
  useRealTimeSearchData: false,
  realTimeDataSource: 'search',
  deepSearch: false,
  includeFaq: false,
  includeKeyTakeaways: false,
  improveReadability: false,
  generatedTitle: '',

  // Text Inputs
  amazonProductUrl: '',
  amazonSearchUrl: '',
  amazonTrackingId: '',
  articleUrlToRewrite: '',
  youtubeUrl: '',

  // Select Inputs
  numberOfProducts: '5',
  totalListItems: '10',
  listItemPrompt: '',
  numberOfPlaces: '10',
  listNumberingFormat: '1.',

  // Toggles
  useOutlineEditor: true,
  enableFirstHandExperience: false,
  enableCondensedMode: false,
  enableSupplementalInformation: false,
  enableAutoLength: false,
  useDescendingOrder: false,
  enableRewriting: true,
  includeExternalLinks: false,
  enableCaptionRewriting: false,

  // --- LOCAL ROUNDUP SPECIFIC FIELDS ---
  generateUniqueMapImages: true,
  manualKeywords: '',
  customArticleLength: 5,
  customToneOfVoice: '',
  amazonDomain: 'amazon.com'
}

const AffiGenieWriter = () => {
  const [settings, setSettings] = useState(defaultSettings)
  const [presets, setPresets] = useState([])
  const [selectedPresetId, setSelectedPresetId] = useState('default')
  const [step, setStep] = useState(0)
  const [outline, setOutline] = useState([])

  // Load presets on mount
  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets')
      const data = await res.json()

      // Check if it's an array before setting the state!
      if (Array.isArray(data)) {
        setPresets(data)
      } else {
        console.error("API did not return an array:", data)
        setPresets([]) // Keep it as an array to prevent the crash
      }
    } catch (error) {
      console.error("Failed to fetch presets:", error)
      setPresets([]) // Fallback to empty array on network failure
    }
  }

  useEffect(() => {
    fetchPresets()
  }, [])

  // A helper function to update any setting dynamically
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // --- PRESET DATABASE ACTIONS ---

  const handleLoadPreset = (presetId) => {
    setSelectedPresetId(presetId)
    if (presetId === 'default') {
      setSettings(defaultSettings)
      return
    }
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      // Load saved settings, but keep the current targetKeyword blank!
      setSettings({ ...JSON.parse(preset.settings), targetKeyword: '' })
    }
  }

  const handleCreatePreset = async (name) => {
    // Exclude targetKeyword from being saved
    const { targetKeyword, ...settingsToSave } = settings
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
    const { targetKeyword, ...settingsToSave } = settings
    await fetch('/api/presets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedPresetId, settings: settingsToSave })
    })
    alert("Preset saved successfully!")
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
    <Container maxWidth='md' className='p-0'>
      {step === 0 && (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}><WriterIntro /></Grid>

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
            setSelectedType={(val) => updateSetting('type', val)}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <WriterPage
            settings={settings}
            updateSetting={updateSetting}
            setStep={setStep}
            setOutline={setOutline}
          />
        </Grid>
      </Grid>
      )}

      {step === 1 && (
        <OutlineEditor settings={settings} setStep={setStep} outline={outline} setOutline={setOutline} />
      )}

      {step === 2 && (
        <ArticleEditor settings={settings} setSettings={setSettings} setStep={setStep} outline={outline} setOutline={setOutline}/>
      )}
    </Container>
  )
}

export default AffiGenieWriter

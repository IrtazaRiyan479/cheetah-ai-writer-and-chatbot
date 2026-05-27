'use client'

import { useState, useEffect } from 'react'
import Grid from '@mui/material/Grid'
import Container from '@mui/material/Container'

import ProductAddHeader from '@views/apps/writer/ProductAddHeader'
import ProductOrganize from '@views/apps/writer/ProductOrganize'
import ProductPricing from '@views/apps/writer/ProductPricing'
import ProductInformation from '@views/apps/writer/ProductInformation'

const defaultSettings = {
  // Existing Base Fields
  model: 'gemini-3.1-flash-lite',
  type: 'blog',
  targetKeyword: '',
  internalLinking: 'unselected',
  seoOptimization: 'default',
  aiImagesAndVideos: 'none',
  articleLength: 'default',
  toneOfVoice: 'seo',
  language: 'en-us',
  country: 'us',
  pointOfView: 'third',
  automaticExternalLinks: true,
  citeSources: false,
  useRealTimeSearchData: true,
  realTimeDataSource: 'default',
  deepSearch: true,
  includeFaq: false,
  includeKeyTakeaways: false,
  improveReadability: true,

  // Text Inputs
  amazonProductUrl: '',
  amazonSearchUrl: '',
  amazonTrackingId: '',
  location: '',
  articleUrlToRewrite: '',
  youtubeUrl: '',

  // Select Inputs
  numberOfProducts: 'auto',
  totalListItems: 'auto',
  numberOfPlaces: 'auto',
  listNumberingFormat: '1.',

  // Toggles
  useOutlineEditor: false,
  enableFirstHandExperience: true,
  enableCondensedMode: false,
  enableSupplementalInformation: false,
  enableAutomaticLength: true,
  useDescendingOrder: false,
  enableRewriting: true,
  includeExternalLinks: false,
  enableCaptionRewriting: false,

  // --- LOCAL ROUNDUP SPECIFIC FIELDS ---
  generateUniqueMapImages: true,
  includeGoogleMapsLinks: true,
  includeBusinessHours: false,
  includeContactInfo: false,
}

const CheetahWriter = () => {
  const [settings, setSettings] = useState(defaultSettings)
  const [presets, setPresets] = useState([])
  const [selectedPresetId, setSelectedPresetId] = useState('default')

  // Load presets on mount
  const fetchPresets = async () => {
    const res = await fetch('/api/presets')
    const data = await res.json()
    setPresets(data)
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
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}><ProductAddHeader /></Grid>

        <Grid size={{ xs: 12 }}>
          {/* Pass the state and functions to Pricing to power the UI */}
          <ProductPricing
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
          <ProductOrganize
            selectedType={settings.type}
            setSelectedType={(val) => updateSetting('type', val)}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ProductInformation
            settings={settings}
            updateSetting={updateSetting}
          />
        </Grid>
      </Grid>
    </Container>
  )
}

export default CheetahWriter

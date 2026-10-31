export const IMAGE_ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4']

export const IMAGE_STYLES = ['Photographic', 'Digital Art', 'Anime', 'Cinematic', '3D Render']

/** Current image models as of October 2026. Retired or retiring ids are omitted. */
export const IMAGE_MODELS = [
  {
    id: 'grok-imagine-image-2.0',
    label: 'Grok Imagine 2.0',
    provider: 'xai',
    group: 'Grok',
    quality: true
  },
  {
    id: 'grok-imagine-image',
    label: 'Grok Imagine',
    provider: 'xai',
    group: 'Grok',
    quality: false
  },
  {
    id: 'gpt-image-2.5-sunburst',
    label: 'GPT Image 2.5 Sunburst',
    provider: 'openai',
    group: 'GPT'
  },
  {
    id: 'gpt-image-2.5-flare',
    label: 'GPT Image 2.5 Flare',
    provider: 'openai',
    group: 'GPT'
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    provider: 'openai',
    group: 'GPT'
  },
  {
    id: 'gemini-nano-banana-2.1',
    label: 'Gemini Nano Banana 2.1',
    provider: 'gemini',
    group: 'Gemini',
    maxImageSize: '2K'
  },
  {
    id: 'gemini-3-pro-image',
    label: 'Gemini 3 Pro Image',
    provider: 'gemini',
    group: 'Gemini',
    maxImageSize: '2K'
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Gemini 3.1 Flash Lite Image',
    provider: 'gemini',
    group: 'Gemini',
    maxImageSize: '1K'
  }
]

export const DEFAULT_IMAGE_MODEL = 'gemini-nano-banana-2.1'

export function getImageModel(id) {
  return IMAGE_MODELS.find(model => model.id === id) || null
}

export function normalizeAspect(value) {
  return IMAGE_ASPECTS.includes(value) ? value : '1:1'
}

export function normalizeStyle(value) {
  return IMAGE_STYLES.includes(value) ? value : 'Photographic'
}

export function openAiSize(aspect) {
  const sizes = {
    '1:1': '1024x1024',
    '16:9': '1536x864',
    '9:16': '864x1536',
    '4:3': '1024x768',
    '3:4': '768x1024'
  }

  return sizes[normalizeAspect(aspect)]
}

export function geminiImageSize(model, lossless) {
  if (!lossless) return '1K'

  return model?.maxImageSize === '1K' ? '1K' : '2K'
}

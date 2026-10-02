'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'react-toastify'

// Third-party imports
import classNames from 'classnames'

// MUI Imports
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'

// MUI Icons
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import UploadFileIcon from '@mui/icons-material/UploadFile'

import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'

// Component Imports
import ImageCard from './ImageCard'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'
import { serializeError } from '@/utils/serializeError'

const ImageGeneratorBoard = () => {
  const { data: session, status: sessionStatus } = useSession()
  const promptRef = useRef(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('nano-banana')
  const [style, setStyle] = useState('Photographic')
  const [size, setSize] = useState('1:1')
  const [numImages, setNumImages] = useState(1)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStage, setGenerationStage] = useState('')
  const [lossless, setLossless] = useState(true)
  const [imageHistory, setImageHistory] = useState([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [isEnhancing, setIsEnhancing] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    let active = true

    setIsHistoryLoading(true)

    if (!session?.user) {
      setImageHistory([])
      setIsHistoryLoading(false)
      return () => { active = false }
    }

    const fetchImages = async () => {
      try {
        const response = await fetch('/api/generate-image')
        const data = await response.json()
        if (!response.ok) {
          if (response.status === 401) throw new Error('Sign in to continue.')
          throw new Error(serializeError(data?.error || data))
        }
        if (active) setImageHistory(Array.isArray(data.images) ? data.images : [])
      } catch (error) {
        if (active) toast.error(serializeError(error))
      } finally {
        if (active) setIsHistoryLoading(false)
      }
    }

    fetchImages()
    return () => { active = false }
  }, [session, sessionStatus])

  const handleEnhancePrompt = async () => {
    if (!prompt) return
    setIsEnhancing(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Enhance the following prompt for an AI image generator to make it highly detailed, visual, and descriptive. Return ONLY the enhanced text. Original prompt: ${prompt}`
        })
      })
      const data = await res.json()
      if (res.ok && data.success && data.text) setPrompt(data.text.trim())
      else if (res.status === 401) toast.error('Sign in to continue.')
      else if ([402, 403].includes(res.status)) toast.error('Upgrade your plan or check your access to use image prompt enhancement.')
      else toast.error(serializeError(data?.error || data))
    } catch (error) {
      toast.error(serializeError(error))
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleClearAll = async () => {
    try {
      const response = await fetch('/api/generate-image', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        if (response.status === 401) throw new Error('Sign in to continue.')
        if ([402, 403].includes(response.status)) throw new Error('You are not allowed to clear the image gallery.')
        throw new Error(serializeError(data?.error || data))
      }
      setImageHistory([])
      toast.success('Image history cleared.')
    } catch (error) {
      toast.error(serializeError(error))
    }
  }

  const handleImageUpload = event => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setUploadedImage(reader.result)
      reader.readAsDataURL(file)
    }
    event.target.value = null
  }

  const handleGenerate = async () => {
    if ((!prompt && !uploadedImage) || isGenerating) return
    setIsGenerating(true)
    setGenerationStage('preparing')

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, style, size, numImages, lossless, uploadedImage })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) throw new Error('Sign in to continue.')
        if ([402, 403].includes(response.status)) throw new Error('Upgrade your plan or check your access to generate images.')
        throw new Error(serializeError(data?.error || data))
      }
      if (!response.body) throw new Error('ReadableStream not supported by browser.')

      setGenerationStage('generating')
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamFailed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const event of parts) {
          if (!event.startsWith('data: ')) continue
          try {
            const data = JSON.parse(event.substring(6))
            if (data.status === 'processing') {
              setGenerationStage('generating')
              if (data.promptUsed && data.promptUsed !== prompt) setPrompt(data.promptUsed)
            } else if (data.success && data.image) {
              setImageHistory(previous => [data.image, ...previous])
            } else if (data.done) {
              setGenerationStage('done')
            } else if (data.error || data.success === false) {
              streamFailed = true
              setGenerationStage('error')
              toast.error(serializeError(data.error || data))
            }
          } catch (error) {
            streamFailed = true
            setGenerationStage('error')
            toast.error(serializeError(error))
          }
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        const finalEvent = buffer.startsWith('data: ') ? buffer.substring(6) : buffer
        try {
          const data = JSON.parse(finalEvent)
          if (data.success && data.image) setImageHistory(previous => [data.image, ...previous])
          else if (data.error || data.success === false) {
            streamFailed = true
            setGenerationStage('error')
            toast.error(serializeError(data.error || data))
          }
        } catch (error) {
          streamFailed = true
          setGenerationStage('error')
          toast.error(serializeError(error))
        }
      }
      if (!streamFailed) setGenerationStage('done')
    } catch (error) {
      setGenerationStage('error')
      toast.error(serializeError(error))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={classNames(commonLayoutClasses.contentHeightFixed, 'flex flex-col md:flex-row is-full bs-full overflow-hidden relative bg-transparent gap-6')}>
      <Card className='w-full md:w-[350px] shrink-0 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden' style={{ scrollbarWidth: 'none' }}>
        <CardContent className='flex flex-col gap-5 p-6'>
          <Typography variant='h5' className='font-bold flex items-center gap-2 mb-2'><AutoAwesomeIcon color='primary' /> Generator</Typography>
          <FormControl fullWidth size='small'>
            <InputLabel>Model</InputLabel>
            <Select value={model} label='Model' onChange={event => setModel(event.target.value)}>
              <MenuItem value='nano-banana'>Nano Banana</MenuItem>
              <MenuItem value='gpt-2-fast'>GPT-2 Fast</MenuItem>
              <MenuItem value='dalle-3-pro'>DALL-E 3 Pro</MenuItem>
              <MenuItem value='midjourney-v6'>Midjourney V6</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size='small'>
            <InputLabel>Style</InputLabel>
            <Select value={style} label='Style' onChange={event => setStyle(event.target.value)}>
              <MenuItem value='Photographic'>Photographic</MenuItem><MenuItem value='Digital Art'>Digital Art</MenuItem><MenuItem value='Anime'>Anime</MenuItem><MenuItem value='Cinematic'>Cinematic</MenuItem><MenuItem value='3D Render'>3D Render</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size='small'>
            <InputLabel>Image Size</InputLabel>
            <Select value={size} label='Image Size' onChange={event => setSize(event.target.value)}>
              <MenuItem value='1:1'>1:1 (Square)</MenuItem><MenuItem value='16:9'>16:9 (Landscape)</MenuItem><MenuItem value='9:16'>9:16 (Portrait)</MenuItem><MenuItem value='4:3'>4:3 (Desktop)</MenuItem><MenuItem value='3:4'>3:4 (Tall)</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size='small'>
            <InputLabel>Number of Images</InputLabel>
            <Select value={numImages} label='Number of Images' onChange={event => setNumImages(event.target.value)}>
              <MenuItem value={1}>1 Image</MenuItem><MenuItem value={2}>2 Images</MenuItem><MenuItem value={3}>3 Images</MenuItem><MenuItem value={4}>4 Images</MenuItem>
            </Select>
          </FormControl>
          <Box className='flex flex-col gap-2 mt-2'>
            <Typography variant='body2' className='font-medium text-textSecondary'>Reference Image</Typography>
            <Button variant='outlined' component='label' startIcon={<UploadFileIcon />} className='w-full border-dashed'>Upload Custom Image<input type='file' hidden accept='image/*' onChange={handleImageUpload} /></Button>
            {uploadedImage ? <Box className='relative mt-2'><img src={uploadedImage} alt='Reference' className='w-full h-28 object-cover rounded-md' /><Button size='small' color='error' variant='contained' className='absolute top-2 right-2 min-w-0 w-6 h-6 p-0 rounded-full shadow-lg' onClick={() => setUploadedImage(null)}>✕</Button></Box> : null}
          </Box>
          <TextField inputRef={promptRef} fullWidth multiline rows={4} label='What do you want to see?' placeholder='A cinematic shot of a futuristic city...' value={prompt} onChange={event => setPrompt(event.target.value)} variant='outlined' className='mt-2' />
          <Box className='flex flex-col gap-1 mt-2 mb-2'>
            <Button variant='outlined' color='info' onClick={handleEnhancePrompt} disabled={isEnhancing || isGenerating || !prompt} startIcon={<AutoAwesomeIcon />} className='mt-2 w-full'>{isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}</Button>
            <FormControlLabel control={<Switch checked={lossless} onChange={event => setLossless(event.target.checked)} color='primary' />} label={<Typography variant='body2' className='font-medium'>Lossless Quality</Typography>} />
          </Box>
          <Button variant='contained' size='large' fullWidth onClick={handleGenerate} disabled={(!prompt && !uploadedImage) || isGenerating || sessionStatus === 'loading'} startIcon={<PhotoCameraIcon />} className='mt-2'>{isGenerating ? 'Generating...' : 'Generate Image'}</Button>
          {generationStage ? <Chip size='small' color={generationStage === 'error' ? 'error' : generationStage === 'done' ? 'success' : 'info'} label={generationStage === 'preparing' ? 'Preparing' : generationStage === 'generating' ? 'Generating' : generationStage === 'done' ? 'Done' : 'Error'} /> : null}
          {session?.user?.role === 'admin' ? <Button variant='outlined' color='error' size='large' fullWidth onClick={handleClearAll} startIcon={<DeleteOutlineIcon />} className='mt-2'>Clear All Images</Button> : null}
        </CardContent>
      </Card>
      <div className='flex-grow w-full h-full overflow-y-auto bg-backgroundDefault rounded-xl p-6 [&::-webkit-scrollbar]:hidden' style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full auto-rows-max'>
          {isHistoryLoading ? <Typography color='text.secondary'>Loading your image history…</Typography> : imageHistory.length > 0 ? imageHistory.map((task, index) => <ImageCard key={task.id} task={task} index={index} />) : (
            <div className='col-span-full flex flex-col items-center justify-center w-full h-full text-textDisabled min-h-[400px]'>
              <AutoAwesomeIcon className='text-6xl mb-4 opacity-50' />
              <Typography variant='h6'>Your image history is empty.</Typography>
              <Typography variant='body2'>Generate an image to see it here.</Typography>
              <Button variant='contained' onClick={() => promptRef.current?.focus()} sx={{ mt: 2 }}>Generate an image</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageGeneratorBoard

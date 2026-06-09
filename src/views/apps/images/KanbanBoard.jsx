'use client'
import { useEffect, useRef, useState } from 'react'

// Third-party imports
import { useDispatch, useSelector } from 'react-redux'
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

// MUI Icons
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import UploadFileIcon from '@mui/icons-material/UploadFile'

import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import Tooltip from '@mui/material/Tooltip'

// Component Imports
import TaskCard from './TaskCard'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

const SAMPLE_IMAGES = [
  { id: 'sample-1', title: 'GPT-2 Fast', description: 'A cute koala reading a book in a magical forest.', image: '/images/koala.png' },
  { id: 'sample-2', title: 'Nano Banana', description: 'A futuristic sports car drifting at night.', image: '/images/car1.png' },
  { id: 'sample-3', title: 'DALL-E 3 Pro', description: 'A vintage classic car parked outside a diner.', image: '/images/car2.png' },
  { id: 'sample-4', title: 'Midjourney V6', description: 'A serene landscape of mountains at sunset.', image: '/images/mountain.png' },
  { id: 'sample-5', title: 'GPT-2 Fast', description: 'A cyberpunk city alleyway with neon lights.', image: '/images/city.png' },
  { id: 'sample-6', title: 'Nano Banana', description: 'A highly detailed robot character design.', image: '/images/robot.png' }
]

const ImageGeneratorBoard = () => {
  const kanbanStore = useSelector(state => state.kanbanReducer)
  const dispatch = useDispatch()

  const feedRef = useRef(null)
  const feedTasks = kanbanStore.tasks

  // Configuration States matching the exact requirements
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('nano-banana')
  const [style, setStyle] = useState('Photographic')
  const [size, setSize] = useState('1:1')
  const [numImages, setNumImages] = useState(1)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [enhancePrompt, setEnhancePrompt] = useState(false)
  const [lossless, setLossless] = useState(true)
  const [imageHistory, setImageHistory] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('image_gen_history')
    if (saved) {
      setImageHistory(JSON.parse(saved))
    } else {
      setImageHistory(SAMPLE_IMAGES)
    }
  }, [])

  // 2. Save to storage whenever the array changes
  useEffect(() => {
    if (imageHistory.length > 0) {
      localStorage.setItem('image_gen_history', JSON.stringify(imageHistory))
    }
  }, [imageHistory])

  // 3. Perfect Clear All Function
  const handleClearAll = () => {
    setImageHistory([])
    localStorage.removeItem('image_gen_history') // Wipes from browser memory completely
  }

  useEffect(() => {
    if (feedTasks.length === 0) {
      SAMPLE_IMAGES.forEach(sample => {
        dispatch({ type: 'kanban/addTask', payload: sample })
      })
    }
  }, [])

  // Auto-scroll horizontally when new images generate
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollLeft = feedRef.current.scrollWidth
    }
  }, [feedTasks.length])

  // Handle local image upload preview
  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedImage(URL.createObjectURL(e.target.files[0]))
    }
  }

  // Submit to our new Next.js API
  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true)

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, style, size, numberOfImages: numImages, enhancePrompt, lossless })
      });
      const data = await response.json();

      if (data.success && data.images) {
        const newTasks = data.images.map((imgBase64, idx) => ({
           id: Date.now() + idx,
           title: model,
           description: prompt,
           image: imgBase64
        }));

        // Add new images to the TOP of the history
        setImageHistory(prev => [...newTasks, ...prev]);
        setPrompt('');
      } else {
        alert("Failed: " + data.error);
      }
    } catch (error) {
      console.error('Failed to generate image', error);
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={classNames(commonLayoutClasses.contentHeightFixed, 'flex flex-col md:flex-row is-full bs-full overflow-hidden relative bg-transparent gap-6')}>

      {/* 1. Left Sidebar Settings Panel */}
      <Card className='w-full md:w-[350px] shrink-0 h-full overflow-y-auto [&::-webkit-scrollbar]:hidden' style={{ scrollbarWidth: 'none' }}>
        <CardContent className='flex flex-col gap-5 p-6'>

          <Typography variant='h5' className='font-bold flex items-center gap-2 mb-2'>
            <AutoAwesomeIcon color='primary' /> Generator
          </Typography>

          {/* Exact Model Menu */}
          <FormControl fullWidth size="small">
            <InputLabel>Model</InputLabel>
            <Select value={model} label="Model" onChange={(e) => setModel(e.target.value)}>
              <MenuItem value="nano-banana">Nano Banana</MenuItem>
              <MenuItem value="gpt-2-fast">GPT-2 Fast</MenuItem>
              <MenuItem value="dalle-3-pro">DALL-E 3 Pro</MenuItem>
              <MenuItem value="midjourney-v6">Midjourney V6</MenuItem>
            </Select>
          </FormControl>

          {/* Exact Style Menu (No Custom) */}
          <FormControl fullWidth size="small">
            <InputLabel>Style</InputLabel>
            <Select value={style} label="Style" onChange={(e) => setStyle(e.target.value)}>
              <MenuItem value="Photographic">Photographic</MenuItem>
              <MenuItem value="Digital Art">Digital Art</MenuItem>
              <MenuItem value="Anime">Anime</MenuItem>
              <MenuItem value="Cinematic">Cinematic</MenuItem>
              <MenuItem value="3D Render">3D Render</MenuItem>
            </Select>
          </FormControl>

          {/* Exact Sizing Menu */}
          <FormControl fullWidth size="small">
            <InputLabel>Image Size</InputLabel>
            <Select value={size} label="Image Size" onChange={(e) => setSize(e.target.value)}>
              <MenuItem value="1:1">1:1 (Square)</MenuItem>
              <MenuItem value="16:9">16:9 (Landscape)</MenuItem>
              <MenuItem value="9:16">9:16 (Portrait)</MenuItem>
              <MenuItem value="4:3">4:3 (Desktop)</MenuItem>
              <MenuItem value="3:4">3:4 (Tall)</MenuItem>
            </Select>
          </FormControl>

          {/* Number of Images */}
          <FormControl fullWidth size="small">
            <InputLabel>Number of Images</InputLabel>
            <Select value={numImages} label="Number of Images" onChange={(e) => setNumImages(e.target.value)}>
              <MenuItem value={1}>1 Image</MenuItem>
              <MenuItem value={2}>2 Images</MenuItem>
              <MenuItem value={3}>3 Images</MenuItem>
              <MenuItem value={4}>4 Images</MenuItem>
            </Select>
          </FormControl>

          {/* Upload Image Option */}
          <Box className='flex flex-col gap-2 mt-2'>
            <Typography variant='body2' className='font-medium text-textSecondary'>Reference Image</Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              className="w-full border-dashed"
            >
              Upload Custom Image
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
            </Button>

            {/* Display Image Preview */}
            {uploadedImage && (
              <Box className='relative mt-2'>
                <img src={uploadedImage} alt="Reference" className='w-full h-28 object-cover rounded-md' />
                <Button
                  size="small" color="error" variant="contained"
                  className='absolute top-2 right-2 min-w-0 w-6 h-6 p-0 rounded-full shadow-lg'
                  onClick={() => setUploadedImage(null)}
                >
                  ✕
                </Button>
              </Box>
            )}
          </Box>

          {/* Prompt Input */}
          <TextField
            fullWidth
            multiline
            rows={4}
            label="What do you want to see?"
            placeholder="A cinematic shot of a futuristic city..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            variant="outlined"
            className="mt-2"
          />

          <Box className="flex flex-col gap-1 mt-2 mb-2">
            <FormControlLabel
              control={<Switch checked={enhancePrompt} onChange={(e) => setEnhancePrompt(e.target.checked)} color="primary" />}
              label={<Typography variant="body2" className="font-medium">Enhance Prompt</Typography>}
            />
            <FormControlLabel
              control={<Switch checked={lossless} onChange={(e) => setLossless(e.target.checked)} color="primary" />}
              label={<Typography variant="body2" className="font-medium">Lossless Quality</Typography>}
            />
          </Box>

          {/* Generate Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleGenerate}
            disabled={!prompt || isGenerating}
            startIcon={<PhotoCameraIcon />}
            className="mt-2"
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>

          <Button
            variant="outlined"
            color="error"
            size="large"
            fullWidth
            onClick={handleClearAll}
            startIcon={<DeleteOutlineIcon />}
            className="mt-2"
          >
            Clear All Images
          </Button>
        </CardContent>
      </Card>

      {/* 2. Right Feed Area (Results) */}
      <div
        className='flex-grow w-full h-full overflow-y-auto bg-backgroundDefault rounded-xl p-6 [&::-webkit-scrollbar]:hidden'
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >

        {/* CSS Grid: 3 columns on Desktop, 2 on Tablet, 1 on Mobile. Auto wraps to new rows. */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full auto-rows-max'>
          {imageHistory.length > 0 ? (
            imageHistory.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))
          ) : (
            <div className='col-span-full flex flex-col items-center justify-center w-full h-full text-textDisabled min-h-[400px]'>
              <AutoAwesomeIcon className='text-6xl mb-4 opacity-50' />
              <Typography variant='h6'>No Images Found</Typography>
              <Typography variant='body2'>Your cleared gallery is empty. Generate a new image!</Typography>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}

export default ImageGeneratorBoard

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
import ImageCard from './ImageCard'

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
  const [lossless, setLossless] = useState(true)
  const [imageHistory, setImageHistory] = useState([])
  const [isEnhancing, setIsEnhancing] = useState(false)

  useEffect(() => {
    const fetchImages = async () => {
      try {
        // Ensure this URL matches your actual API route file path
        const res = await fetch('/api/generate-image');
        const data = await res.json();

        if (data.success && data.images.length > 0) {
          setImageHistory(data.images);
        } else {
          setImageHistory(SAMPLE_IMAGES);
        }
      } catch (error) {
        console.error("Failed to fetch image history", error);
      }
    };

    fetchImages();
  }, [])


  const handleEnhancePrompt = async () => {
  if (!prompt) return;
  setIsEnhancing(true);
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Enhance the following prompt for an AI image generator to make it highly detailed, visual, and descriptive. Return ONLY the enhanced text. Original prompt: ${prompt}`
      })
    });
    const data = await res.json();
    if (data.success && data.text) {
      setPrompt(data.text.trim());
    }
  } catch (error) {
    console.error("Failed to enhance prompt", error);
  } finally {
    setIsEnhancing(false);
  }
};

  const handleClearAll = async () => {
    const confirmed = window.confirm("Are you sure you want to permanently delete all generated images from your account?");
    if (!confirmed) return;

    try {
      await fetch('/api/generate-image', { method: 'DELETE' });
      setImageHistory([]);
    } catch (error) {
      console.error("Failed to delete images", error);
    }
  }

  useEffect(() => {
    if (feedTasks.length === 0) {
      SAMPLE_IMAGES.forEach(sample => {
        dispatch({ type: 'kanban/addTask', payload: sample })
      })
    }
  }, [])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollLeft = feedRef.current.scrollWidth
    }
  }, [feedTasks.length])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = null;
  }

 const handleGenerate = async () => {
    if (!prompt && !uploadedImage) return;
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, style, size, numImages, lossless, uploadedImage })
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');

        buffer = parts.pop();

        for (const event of parts) {
          if (event.startsWith('data: ')) {
            const dataString = event.substring(6);

            try {
              const data = JSON.parse(dataString);

              if (data.status === 'processing') {
                 if (data.promptUsed && data.promptUsed !== prompt) {
                    setPrompt(data.promptUsed);
                 }
              }
              else if (data.success && data.image) {
                 setImageHistory(prev => [data.image, ...prev]);
              }
              else if (data.done) {
                 setIsGenerating(false);
              }
              else if (data.error || data.success === false) {
                 console.error("Image generation failed:", data.error);
              }
            } catch (e) {
              console.error("Failed to parse buffered JSON stream", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Generation failed", error);
      alert("Network error: Could not reach the server or read stream.");
      setIsGenerating(false);
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
            <Button
              variant="outlined"
              color="info"
              onClick={handleEnhancePrompt}
              disabled={isEnhancing || !prompt}
              startIcon={<AutoAwesomeIcon />}
              className="mt-2 w-full"
            >
              {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
            </Button>
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
            disabled={(!prompt && !uploadedImage) || isGenerating}
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
              <ImageCard key={task.id} task={task} index={index} />
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

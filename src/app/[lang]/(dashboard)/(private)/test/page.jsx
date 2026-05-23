'use client'
import { useState } from 'react'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'

// 3rd Party Imports
import ReactMarkdown from 'react-markdown'

const GeminiTest = () => {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      })

      // If the server crashes or returns a 404/500, catch the exact text
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Server Error (${res.status}): ${errorText}`)
      }

      const data = await res.json()

      if (data.success) {
        setResponse(data.text)
      } else {
        setResponse('API Error: ' + data.error)
      }
    } catch (error) {
      // This will now print the exact error to the screen
      setResponse(error.message || 'Failed to connect to API.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-6 border border-dashed rounded-md mt-8 flex flex-col gap-4 border-divider'>
      <Typography variant='h6' color='primary'>
        Gemini API Playground
      </Typography>

      {/* Input Area */}
      <TextField
        multiline
        rows={3}
        fullWidth
        variant='outlined'
        placeholder='Type a test prompt here (e.g., "Write a tagline for a shoe brand")'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* Action Button */}
      <div>
        <Button
          variant='contained'
          color='primary'
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <i className='ri-sparkling-line' />}
        >
          {loading ? 'Generating...' : 'Test Prompt'}
        </Button>
      </div>

{/* Response Display Area */}
      {response && (
        <div className='mt-4 p-5 border rounded-md shadow-sm border-divider bg-backgroundPaper'>
          <Typography variant='subtitle2' color='primary' className='mb-4 font-bold uppercase tracking-wider'>
            API Response:
          </Typography>
          
          <div className='text-textPrimary'>
            <ReactMarkdown
              components={{
                // Map Markdown to MUI Components for a seamless look
                p: ({node, ...props}) => <Typography className='mb-3 leading-relaxed' {...props} />,
                h1: ({node, ...props}) => <Typography variant='h4' className='mt-6 mb-3 font-bold' {...props} />,
                h2: ({node, ...props}) => <Typography variant='h5' className='mt-5 mb-2 font-bold' {...props} />,
                h3: ({node, ...props}) => <Typography variant='h6' className='mt-4 mb-2 font-bold' {...props} />,
                strong: ({node, ...props}) => <span className='font-bold text-textPrimary' {...props} />,
                ul: ({node, ...props}) => <ul className='list-disc pl-6 mb-3 space-y-1' {...props} />,
                ol: ({node, ...props}) => <ol className='list-decimal pl-6 mb-3 space-y-1' {...props} />,
                li: ({node, ...props}) => <li className='text-body1' {...props} />,
                code: ({node, inline, ...props}) => 
                  inline 
                    ? <code className='bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-pink-600' {...props} />
                    : <pre className='bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto mb-4 text-sm font-mono'><code {...props} /></pre>
              }}
            >
              {response}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export default GeminiTest

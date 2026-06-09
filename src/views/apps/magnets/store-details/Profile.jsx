'use client'

import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip' // FIXED: Added missing import

// MUI Icons
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CodeIcon from '@mui/icons-material/Code'
import WebIcon from '@mui/icons-material/Web'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ReactMarkdown from 'react-markdown';

const Profile = () => {
  // Magnet Builder State
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedMagnet, setGeneratedMagnet] = useState(null)

  // Magnet Execution State
  const [magnetValues, setMagnetValues] = useState({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [magnetResult, setMagnetResult] = useState(null)

  // Embed Modal State
  const [embedOpen, setEmbedOpen] = useState(false)

  // 1. Ask API to create the tool blueprint
  const handleCreateMagnet = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setGeneratedMagnet(null)
    setMagnetResult(null)
    setMagnetValues({})

    try {
      const res = await fetch('/api/cheetah-magnets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', prompt })
      })
      const data = await res.json()

      if (data.success) {
        setGeneratedMagnet(data.magnetConfig)
      } else {
        alert(data.error || 'Failed to generate magnet.')
      }
    } catch (error) {
      console.error(error)
      alert('An error occurred while connecting to the AI.')
    } finally {
      setIsGenerating(false)
    }
  }

  // 2. Ask API to run the tool logic
  const handleRunMagnet = async () => {
    setIsExecuting(true)
    setMagnetResult(null)

    try {
      const res = await fetch('/api/cheetah-magnets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          aiInstructions: generatedMagnet.aiInstructions,
          userInputs: magnetValues
        })
      })
      const data = await res.json()

      if (data.success) {
        setMagnetResult(data.result)
      } else {
        alert('Failed to process request.')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsExecuting(false)
    }
  }

  // Copy Result Function (FIXED)
  const handleCopyResult = () => {
    if (magnetResult) {
      navigator.clipboard.writeText(magnetResult)
      alert('Result copied to clipboard!')
    }
  }

  // Copy Embed Code Function
  const handleCopyEmbed = () => {
    const embedStr = `<iframe src="https://yourdomain.com/embed/magnet-id" width="100%" height="600" style="border:none;"></iframe>`
    navigator.clipboard.writeText(embedStr)
    alert('Embed code copied to clipboard!')
    setEmbedOpen(false)
  }

  return (
    <Box className="flex flex-col gap-6">

      {/* Step 1: The Builder Input */}
      <Card variant="outlined" className="border-divider shadow-sm rounded-xl overflow-hidden bg-backgroundPaper">
        {/* Modern Adaptive Header Section */}
        <Box className="p-6 border-b border-divider bg-actionHover/30">
          <Typography variant="h5" className="font-bold text-textPrimary tracking-tight flex items-center gap-2">
            <AutoAwesomeIcon color="primary" fontSize="large" /> CheetahMagnets
          </Typography>
          <Typography variant="body2" className="text-textSecondary mt-1.5 max-w-3xl leading-relaxed">
            Describe what you want your lead magnet to accomplish (e.g., <em>"Create quotes for a lawn maintenance service"</em>).
            Our AI will automatically create the first version for you. Then you will be able to view, test, and embed it.
          </Typography>
        </Box>

        <CardContent className="p-6">
          <Typography variant="subtitle2" color="text.secondary" className="font-bold uppercase tracking-wider mb-4">
            What do you want to build?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="A calculator that tells you how much water you should drink based on your weight..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            variant="outlined"
            sx={{ bgcolor: 'action.hover' }}
          />
          <Box className="flex justify-start pt-4">
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleCreateMagnet}
              disabled={!prompt.trim() || isGenerating}
              startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
              className="font-bold px-6 py-2.5"
            >
              {isGenerating ? 'Architecting your tool...' : 'Create CheetahMagnet'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Step 2: The Generated Preview & Working Tool */}
      {generatedMagnet && (
        <Card sx={{ boxShadow: 3, overflow: 'hidden' }}>

          {/* Output Header Bar - FIXED for Light/Dark Mode */}
          <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="h6" className="font-bold flex items-center gap-2" color="text.primary">
              <WebIcon color="primary" /> Live Preview: Test Your Tool
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CodeIcon />}
              onClick={() => setEmbedOpen(true)}
            >
              Embed Code
            </Button>
          </Box>

          <CardContent sx={{ p: { xs: 3, md: 6 }, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            <Paper elevation={4} sx={{ p: { xs: 4, md: 6 }, maxWidth: 650, w: '100%', display: 'flex', flexDirection: 'column', gap: 3, borderRadius: 3 }}>

              {/* Tool Title */}
              <Box className="text-center">
                <Typography variant="h5" color="text.primary" className="font-extrabold mb-2">
                  {generatedMagnet.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {generatedMagnet.description}
                </Typography>
              </Box>

              <Divider />

              {/* Dynamic Inputs */}
              <Box className="flex flex-col gap-4">
                {generatedMagnet.inputs.map((input) => (
                  <Box key={input.id}>
                    <Typography variant="subtitle2" color="text.primary" className="font-bold mb-1 block">
                      {input.label}
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type={input.type === 'number' ? 'number' : 'text'}
                      multiline={input.type === 'textarea'}
                      rows={input.type === 'textarea' ? 3 : 1}
                      placeholder={input.placeholder}
                      variant="outlined"
                      value={magnetValues[input.id] || ''}
                      onChange={(e) => setMagnetValues({ ...magnetValues, [input.id]: e.target.value })}
                    />
                  </Box>
                ))}

                {/* Execute Button */}
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleRunMagnet}
                  disabled={isExecuting}
                  className="mt-2 py-3 font-bold shadow-md"
                >
                   {isExecuting ? <CircularProgress size={24} color="inherit" /> : generatedMagnet.buttonText}
                </Button>
              </Box>

              {/* Beautiful Document Output Canvas */}
              {magnetResult && (
                <Box className="mt-8">
                  <Typography variant="h6" className="font-bold mb-3 flex items-center gap-2 text-textPrimary">
                    ✨ Generated Result
                  </Typography>

                  <Paper
                    variant="outlined"
                    className="p-6 md:p-8 bg-backgroundPaper border-divider rounded-xl shadow-sm transition-all relative overflow-hidden"
                  >
                    {/* Action Bar */}
                    <Box className="absolute top-3 right-3 flex items-center gap-1 bg-backgroundPaper/80 backdrop-blur-sm p-1 rounded-md border border-divider">
                      <Tooltip title="Copy Content">
                        <IconButton size="small" onClick={handleCopyResult}>
                          <i className="ri-file-copy-line text-sm text-textSecondary hover:text-textPrimary" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                      {/* Styled Rendered Text Engine */}
                      <Box className="prose dark:prose-invert max-w-none text-textPrimary leading-relaxed space-y-4">
                        <ReactMarkdown
                          components={{
                            // Map Markdown headers to MUI Typography
                            h2: ({ node, ...props }) => (
                              <Typography variant="h5" className="font-bold pt-4 border-b border-divider pb-2 text-textPrimary" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <Typography variant="h6" className="font-bold pt-2 border-b border-divider pb-1 text-textPrimary" {...props} />
                            ),
                            // Map standard paragraphs
                            p: ({ node, ...props }) => (
                              <Typography variant="body1" className="text-textSecondary text-[15px] mb-4" {...props} />
                            ),
                            // Map bold text
                            strong: ({ node, ...props }) => (
                              <Box component="span" sx={{ fontWeight: 'bold', color: 'text.primary' }} {...props} />
                            ),
                            // Map lists for better wellness tip rendering
                            ul: ({ node, ...props }) => (
                              <Box component="ul" className="list-disc pl-5 mb-4" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <Typography component="li" variant="body1" className="text-textSecondary text-[15px]" {...props} />
                            )
                          }}
                        >
                          {magnetResult}
                        </ReactMarkdown>
                      </Box>
                  </Paper>
                </Box>
              )}

            </Paper>
          </CardContent>
        </Card>
      )}

      {/* Embed Dialog Modal */}
      <Dialog open={embedOpen} onClose={() => setEmbedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" className="font-bold">Embed this Tool</Typography>
          <IconButton onClick={() => setEmbedOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" className="mb-4">
            Copy and paste this HTML snippet into your website, blog, or CMS to display your custom CheetahMagnet.
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
            {`<iframe src="https://yourdomain.com/embed/magnet-id" width="100%" height="600" style="border:none;"></iframe>`}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEmbedOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleCopyEmbed} startIcon={<ContentCopyIcon />}>Copy Code</Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

export default Profile

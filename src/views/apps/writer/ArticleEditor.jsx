'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

const ArticleEditor = ({ settings, setStep, outline }) => {
  const [isGenerating, setIsGenerating] = useState(true)
  const [generatedSections, setGeneratedSections] = useState({}) // Stores { index: "paragraph text" }

  useEffect(() => {
    let isCancelled = false; // Prevents state updates if user clicks "Back" while generating

    const generateArticleSequentially = async () => {
      setIsGenerating(true)

      // Loop through every item in the outline
      for (let i = 0; i < outline.length; i++) {
        if (isCancelled) break; // Stop loop if user navigates away

        const section = outline[i]

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'section',
              targetKeyword: settings.targetKeyword,
              model: settings.model,
              outlineContext: outline, // Feed the AI the full outline so it doesn't repeat itself
              heading: section.text    // Tell it to write ONLY about this heading
            })
          })

          const data = await res.json()

          if (data.success && !isCancelled) {
             // Save the paragraph into state, matched to the outline index
             setGeneratedSections(prev => ({
               ...prev,
               [i]: data.text
             }))
          }
        } catch (e) {
          console.error(`Failed to generate section ${i}:`, e)
        }
      }

      if (!isCancelled) setIsGenerating(false)
    }

    if (outline && outline.length > 0) {
      generateArticleSequentially()
    } else {
      setIsGenerating(false)
    }

    return () => { isCancelled = true } // Cleanup function
  }, [outline])

  return (
    <div className='flex flex-col gap-4'>
      {/* Top Action Bar */}
      <div className='flex items-center justify-between'>
        <Button variant='text' color='secondary' onClick={() => setStep(settings.useOutlineEditor ? 1 : 0)} startIcon={<i className='ri-arrow-left-line' />}>
          Back
        </Button>
        <div className='flex gap-2'>
          <Button variant='contained' color='primary' disabled={isGenerating}>
            {isGenerating ? 'Writing...' : 'Export Article'}
          </Button>
        </div>
      </div>

      <Card className='shadow-sm min-h-[600px]'>
        <CardContent className='p-8'>
          <Typography variant='h3' className='font-bold mbe-8 capitalize'>
            {settings.targetKeyword || 'Generated Article'}
          </Typography>

          {/* Render the outline and the generated text dynamically! */}
          {outline.map((item, index) => (
            <div key={index} className='mbe-6'>
              {/* Output the Heading */}
              <Typography variant={item.type === 'h2' ? 'h5' : 'h6'} className='font-bold mbe-3'>
                {item.text}
              </Typography>

              {/* Output the Content OR a loading spinner if it hasn't been written yet */}
              {generatedSections[index] ? (
                <Typography variant='body1' className='leading-relaxed whitespace-pre-wrap'>
                  {generatedSections[index]}
                </Typography>
              ) : (
                <div className='flex items-center gap-2 text-textSecondary mbe-4'>
                  {isGenerating && <CircularProgress size={16} />}
                  <Typography variant='caption' className='italic'>
                    {isGenerating ? 'AI is writing this section...' : 'Pending...'}
                  </Typography>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default ArticleEditor

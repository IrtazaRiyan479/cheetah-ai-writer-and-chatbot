'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'

const OutlineEditor = ({ settings, setStep, outline, setOutline }) => {

  return (
    <Grid container spacing={6}>
      {/* LEFT COLUMN: Outline Editor */}
      <Grid size={{ xs: 12, md: 8 }}>
        <div className='flex items-center justify-between mbe-4'>
          <Typography variant='h5' className='font-bold'>Outline Editor</Typography>
          <Button variant='outlined' color='secondary' onClick={() => setStep(0)} startIcon={<i className='ri-arrow-left-line' />}>
            Back to Setup
          </Button>
        </div>

        <Card className='shadow-sm'>
          <CardContent className='flex flex-col gap-4'>
            {outline.map((item, index) => (
              <div key={item.id} className={`flex gap-3 items-start ${item.type === 'h3' ? 'ml-8' : ''}`}>

                {/* Drag Handle Mockup */}
                <IconButton size='small' className='mt-1 cursor-grab text-textSecondary'>
                  <i className='ri-draggable' />
                </IconButton>

                <div className='flex-1 flex flex-col gap-2'>
                  <div className='flex items-center gap-2'>
                    {/* Tag Badge (H1, H2, H3) */}
                    <div className='bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold uppercase'>
                      {item.type}
                    </div>
                    {/* Title Input */}
                    <TextField
                      fullWidth size='small'
                      value={item.text}
                      className='bg-backgroundPaper'
                    />
                    <IconButton size='small' color='error'>
                      <i className='ri-delete-bin-7-line' />
                    </IconButton>
                  </div>

                  {/* Optional Extra Prompt area like in Koala */}
                  {(item.extraPrompt !== undefined || item.type === 'h2') && (
                    <TextField
                      fullWidth size='small'
                      placeholder='Extra instructions for this section (optional)'
                      value={item.extraPrompt || ''}
                      variant='standard'
                      className='ml-12 w-[calc(100%-3rem)] opacity-70 focus-within:opacity-100 transition-opacity'
                      InputProps={{ disableUnderline: true, className: 'text-sm italic' }}
                    />
                  )}
                </div>
              </div>
            ))}

            <Divider className='my-2' />
            <Button variant='dashed' color='primary' startIcon={<i className='ri-add-line' />}>
              Add Section
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {/* RIGHT COLUMN: Settings Summary & Action */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card className='shadow-sm sticky top-6 mbs-11'>
          <CardContent>
            <Typography variant='h6' className='mbe-4 font-bold'>Article Details</Typography>

            <div className='flex flex-col gap-3 mbe-6 text-sm'>
              <div className='flex justify-between'>
                <span className='text-textSecondary'>AI Model:</span>
                <span className='font-medium'>{settings.model}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-textSecondary'>Article Type:</span>
                <span className='font-medium capitalize'>{settings.type}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-textSecondary'>Target Keyword:</span>
                <span className='font-medium'>{settings.targetKeyword || 'None'}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-textSecondary'>Real-Time Data:</span>
                <span className='font-medium'>{settings.useRealTimeSearchData ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>

            <Button
              fullWidth variant='contained' color='primary' size='large'
              onClick={() => setStep(2)} // Move to Article Generation
            >
              Write Article
            </Button>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default OutlineEditor

'use client'

import { useState } from 'react'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'

export default function ApiDiagnostics() {
  const [logs, setLogs] = useState({})
  const [loading, setLoading] = useState({})

  const updateLog = (service, data) => {
    setLogs(prev => ({ ...prev, [service]: JSON.stringify(data, null, 2) }))
  }

  const testAmazon = async () => {
    setLoading({ ...loading, amazon: true })
    try {
      const res = await fetch('/api/amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'running shoes for flat feet' })
      })
      const data = await res.json()
      updateLog('amazon', data)
    } catch (err) {
      updateLog('amazon', { error: err.message })
    }
    setLoading({ ...loading, amazon: false })
  }

  const testSerper = async () => {
    setLoading({ ...loading, serper: true })
    try {
      const res = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'best running shoes for flat feet' })
      })
      const data = await res.json()
      updateLog('serper', data)
    } catch (err) {
      updateLog('serper', { error: err.message })
    }
    setLoading({ ...loading, serper: false })
  }

  const testUnsplash = async () => {
    setLoading({ ...loading, unsplash: true })
    try {
      const res = await fetch('/api/unsplash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'running shoes' })
      })
      const data = await res.json()
      updateLog('unsplash', data)
    } catch (err) {
      updateLog('unsplash', { error: err.message })
    }
    setLoading({ ...loading, unsplash: false })
  }

  const testSerpApi = async () => {
    setLoading({ ...loading, serpapi: true })
    try {
      const res = await fetch('/api/serpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Coffee' })
      })
      const data = await res.json()
      updateLog('serpapi', data)
    } catch (err) {
      updateLog('serpapi', { error: err.message })
    }
    setLoading({ ...loading, serpapi: false })
  }

 const testdataSEO = async () => { // Remove the event argument here
  setLoading({ ...loading, dataSEO: true });
  try {
    const response = await fetch('/api/bing-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'best running shoes for flat feet' }) // Hardcoded or passed string
    });

    const data = await response.json();
    updateLog('dataSEO', data);
  } catch (err) {
    updateLog('dataSEO', { error: err.message });
  }
  setLoading({ ...loading, dataSEO: false });
}

  return (
    <Container maxWidth='md' className='py-8'>
      <Typography variant='h4' className='font-bold mbe-6'>API Connection Diagnostics</Typography>

      <Grid container spacing={4}>
        {/* SERPER TEST */}
        <Grid size={{ xs: 12 }}>
          <Card className='shadow-sm'>
            <CardContent>
              <div className='flex items-center justify-between mbe-4'>
                <div>
                  <Typography variant='h6'>Google SERP (Serper.dev)</Typography>
                  <Typography variant='caption' color='text.secondary'>Testing query: "best running shoes for flat feet"</Typography>
                </div>
                <Button
                  variant='contained'
                  onClick={testSerper}
                  disabled={loading.serper}
                >
                  {loading.serper ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              <Divider className='mbe-4' />
              <TextField
                multiline fullWidth rows={6}
                value={logs.serper || 'Awaiting test...'}
                slotProps={{ input: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '12px' } } }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* UNSPLASH TEST */}
        <Grid size={{ xs: 12 }}>
          <Card className='shadow-sm'>
            <CardContent>
              <div className='flex items-center justify-between mbe-4'>
                <div>
                  <Typography variant='h6'>Unsplash Images</Typography>
                  <Typography variant='caption' color='text.secondary'>Testing keyword: "running shoes"</Typography>
                </div>
                <Button
                  variant='contained'
                  onClick={testUnsplash}
                  disabled={loading.unsplash}
                >
                  {loading.unsplash ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              <Divider className='mbe-4' />
              <TextField
                multiline fullWidth rows={6}
                value={logs.unsplash || 'Awaiting test...'}
                slotProps={{ input: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '12px' } } }}
              />
              {logs.unsplash && JSON.parse(logs.unsplash).imageUrl && (
                <div className='mt-4'>
                  <Typography variant='subtitle2' className='mbe-2'>Render Test:</Typography>
                  <img
                    src={JSON.parse(logs.unsplash).imageUrl}
                    alt="Unsplash Result"
                    className='max-h-48 rounded-md'
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* SERPAPI TEST (Bing) */}
        <Grid size={{ xs: 12 }}>
          <Card className='shadow-sm'>
            <CardContent>
              <div className='flex items-center justify-between mbe-4'>
                <div>
                  <Typography variant='h6'>Bing SERP (SerpApi)</Typography>
                  <Typography variant='caption' color='text.secondary'>Testing query: "best running shoes for flat feet"</Typography>
                </div>
                <Button
                  variant='contained'
                  color='primary'
                  onClick={testSerpApi}
                  disabled={loading.serpapi}
                >
                  {loading.serpapi ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              <Divider className='mbe-4' />
              <TextField
                multiline fullWidth rows={6}
                value={logs.serpapi || 'Awaiting test...'}
                slotProps={{ input: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '12px' } } }}
              />
            </CardContent>
          </Card>
        </Grid>

         <Grid size={{ xs: 12 }}>
          <Card className='shadow-sm'>
            <CardContent>
              <div className='flex items-center justify-between mbe-4'>
                <div>
                  <Typography variant='h6'>Bing SERP (dataSEO)</Typography>
                  <Typography variant='caption' color='text.secondary'>Testing query: "best running shoes for flat feet"</Typography>
                </div>
                <Button
                  variant='contained'
                  color='primary'
                  onClick={testdataSEO}
                  disabled={loading.dataSEO}
                >
                  {loading.dataSEO ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              <Divider className='mbe-4' />
              <TextField
                multiline fullWidth rows={6}
                value={logs.dataSEO || 'Awaiting test...'}
                slotProps={{ input: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '12px' } } }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* AMAZON PA-API TEST */}
        <Grid size={{ xs: 12 }}>
          <Card className='shadow-sm'>
            <CardContent>
              <div className='flex items-center justify-between mbe-4'>
                <div>
                  <Typography variant='h6'>Amazon Associate API</Typography>
                  <Typography variant='caption' color='text.secondary'>Testing keyword: "running shoes for flat feet"</Typography>
                </div>
                <Button
                  variant='contained'
                  onClick={testAmazon}
                  disabled={loading.amazon}
                >
                  {loading.amazon ? 'Testing...' : 'Run Test'}
                </Button>
              </div>
              <Divider className='mbe-4' />
              <TextField
                multiline fullWidth rows={6}
                value={logs.amazon || 'Awaiting test...'}
                slotProps={{ input: { readOnly: true, style: { fontFamily: 'monospace', fontSize: '12px' } } }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}

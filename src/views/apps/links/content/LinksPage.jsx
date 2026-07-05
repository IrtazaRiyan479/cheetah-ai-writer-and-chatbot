'use client'

import { useState, useRef, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Checkbox from '@mui/material/Checkbox'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'

// MUI Icons
import LanguageIcon from '@mui/icons-material/Language'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import LinkIcon from '@mui/icons-material/Link'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import StopCircleIcon from '@mui/icons-material/StopCircle'

import InternalLinker from './InternalLinker'

const LinksPage = () => {
  const [domain, setDomain] = useState('')
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawledPages, setCrawledPages] = useState([])

  const [selectedPages, setSelectedPages] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  const [loadingTextIndex, setLoadingTextIndex] = useState(0)

  const loadingMessages = [
  'Analyzing Semantics...',
  'Initializing connection...',
  'Reading page content...',
  'Cleaning HTML structure...',
  'Stripping irrelevant DOM elements...',
  'Extracting text nodes...',
  'Tokenizing source content...',
  'Mapping global target URLs...',
  'Setting strict rule parameters...',
  'Running semantic mapping...',
  'Identifying anchor candidates...',
  'Verifying text substring matches...',
  'Checking anchor uniqueness...',
  'Validating target URL integrity...',
  'Filtering out generic phrases...',
  'Processing batch data...',
  'Analyzing link context...',
  'Enforcing strict matching rules...',
  'Removing self-references...',
  'Scanning for contextual relevance...',
  'Calculating semantic distance...',
  'Evaluating linking opportunities...',
  'Parsing deeper page structures...',
  'Checking constraint compliance...',
  'Refining anchor text quality...',
  'Eliminating hallucination risks...',
  'Still analyzing, please wait...',
  'Scanning secondary page content...',
  'Running logical consistency check...',
  'Processing intermediate results...',
  'Aligning sources with targets...',
  'Optimizing semantic connections...',
  'Filtering for high-quality links...',
  'Building link logic tree...',
  'Parsing remaining source pages...',
  'Maintaining strict extraction laws...',
  'Ensuring zero hallucinations...',
  'Cross-referencing domain list...',
  'Evaluating link density...',
  'Still grinding through data...',
  'Extracting hidden opportunities...',
  'Optimizing suggestion relevance...',
  'Checking against strict rules...',
  'Processing batch queues...',
  'Running final semantic pass...',
  'Parsing remaining content...',
  'Formatting internal data...',
  'Validating JSON structure...',
  'Cleaning up output streams...',
  'Finalizing link suggestions...',
  'Just a few more moments...',
  'Re-verifying link logic...',
  'Constructing final report...',
  'Almost ready...',
  'Compiling results...',
  'Verifying output integrity...',
  'Making final adjustments...',
  'Finalizing semantic maps...',
  'Organizing findings...',
  'Preparing data packets...',
  'Almost there...',
  'System finalizing analysis...',
  'Performing final data check...',
  'Synchronizing results...',
  'Wrapping up final batch...',
  'Almost done...',
  'Optimizing display...',
  'Final sync...',
  'Ready to display results...',
  'Please wait...',
  'Still working...',
  'Almost finished...',
  'Final check...',
  'Just a second more...',
  'Here we go...'
];

  const abortControllerRef = useRef(null)

  useEffect(() => {
    let interval;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setLoadingTextIndex((prevIndex) => {
          return prevIndex === loadingMessages.length - 1 ? 1 : prevIndex + 1;
        });
      }, 8000);
    } else {
      setLoadingTextIndex(0);
    }

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsCrawling(false)
    setIsAnalyzing(false)
  }

  const handleCrawl = async () => {
    if (!domain) return
    setIsCrawling(true)
    setSuggestions([])
    setSelectedPages([])
    setCrawledPages([])

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl', domain }),
        signal: abortControllerRef.current.signal
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue

          try {
            const parsed = JSON.parse(line)

            if (parsed.type === 'chunk') {
              setCrawledPages(prev => [...prev, ...parsed.data])
              setSelectedPages(prev => [...prev, ...parsed.data.map(p => p.id)])
            } else if (parsed.type === 'error') {
              console.error("Crawl Stream error:", parsed.message)
              alert(`Stream Error: ${parsed.message}`)
            } else if (parsed.type === 'done') {
              console.log("Crawl Stream Complete")
            }
          } catch (parseError) {
            console.error('Failed to parse NDJSON line:', line, parseError)
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Crawl aborted by user.')
      } else {
        alert(`Failed to crawl domain. ${error.message}`)
        console.error(error)
      }
    } finally {
      setIsCrawling(false)
      abortControllerRef.current = null
    }
  }

    const handleAnalyze = async () => {
    if (selectedPages.length < 2) {
      alert("Please select at least 2 pages to find internal links.")
      return
    }

    setIsAnalyzing(true)
    setSuggestions([])
    const pagesToAnalyze = crawledPages.filter(p => selectedPages.includes(p.id))

    abortControllerRef.current = new AbortController()

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', selectedPages: pagesToAnalyze }),
        signal: abortControllerRef.current.signal
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue

          try {
            const parsed = JSON.parse(line)

            if (parsed.type === 'chunk') {
              setSuggestions(prev => [...prev, ...parsed.data])
            } else if (parsed.type === 'error') {
              console.error("Backend stream error:", parsed.message)
              alert(`Stream Error: ${parsed.message}`)
            } else if (parsed.type === 'done') {
              console.log("Analysis Stream Complete")
            }
          } catch (parseError) {
            console.error('Failed to parse NDJSON line:', line, parseError)
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Analysis aborted by user.')
      } else {
        console.error(error)
        alert('Failed to analyze pages or stream was interrupted.')
      }
    } finally {
      setIsAnalyzing(false)
      abortControllerRef.current = null
    }
  }

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      setSelectedPages(crawledPages.map((n) => n.id))
      return
    }
    setSelectedPages([])
  }

  const handleClick = (id) => {
    const selectedIndex = selectedPages.indexOf(id)
    let newSelected = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedPages, id)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedPages.slice(1))
    } else if (selectedIndex === selectedPages.length - 1) {
      newSelected = newSelected.concat(selectedPages.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selectedPages.slice(0, selectedIndex),
        selectedPages.slice(selectedIndex + 1)
      )
    }
    setSelectedPages(newSelected)
  }

  return (
    <Card className="shadow-md">
      <CardHeader
        title={
          <Typography variant="h4" className="font-bold flex items-center gap-2">
            <AutoAwesomeIcon color="primary" fontSize="large" />
            AffiGenieLinks Engine
          </Typography>
        }
        subheader={
          <Typography variant="body1" color="text.secondary" className="mt-2 max-w-3xl">
            Build Internal Links 100x Faster. Enter your domain below to crawl your sitemap and discover high-quality internal linking opportunities powered by semantic AI.
          </Typography>
        }
        action={
          (isCrawling || isAnalyzing) && (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopCircleIcon />}
              onClick={handleStop}
              sx={{ mt: 1, mr: 1 }}
            >
              Stop Processing
            </Button>
          )
        }
        className="pb-6"
      />
      <Divider />

      <CardContent className="pt-8">
        <Grid container spacing={6}>

          {/* STEP 1: DOMAIN INPUT */}
          <Grid size={{ xs: 12 }}>
            <Box className="flex flex-col md:flex-row gap-4 items-stretch">
              <TextField
                fullWidth
                label='Website Domain'
                placeholder='example.com'
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={isCrawling || isAnalyzing}
                inputprops={{
                  startAdornment: <LanguageIcon color="action" className="mr-2" />,
                }}
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleCrawl}
                disabled={!domain || isCrawling || isAnalyzing}
                className="min-w-[180px] font-bold"
              >
                {isCrawling ? <CircularProgress size={24} color="inherit" /> : 'Index Site'}
              </Button>
            </Box>
          </Grid>

          {/* STEP 2: CRAWLED PAGES TABLE */}
          {crawledPages.length > 0 && suggestions.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Typography variant="h6" className="font-bold mb-4">
                Pages Discovered ({crawledPages.length})
              </Typography>
              <Paper variant="outlined" className="overflow-hidden mb-4">
                <TableContainer className="max-h-[400px]">
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            color="primary"
                            indeterminate={selectedPages.length > 0 && selectedPages.length < crawledPages.length}
                            checked={crawledPages.length > 0 && selectedPages.length === crawledPages.length}
                            onChange={handleSelectAllClick}
                          />
                        </TableCell>
                        <TableCell className="font-bold">Indexed URL</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {crawledPages.map((page) => {
                        const isItemSelected = selectedPages.indexOf(page.id) !== -1;
                        return (
                          <TableRow
                            hover
                            onClick={() => handleClick(page.id)}
                            role="checkbox"
                            aria-checked={isItemSelected}
                            selected={isItemSelected}
                            key={page.id}
                            className="cursor-pointer"
                          >
                            <TableCell padding="checkbox">
                              <Checkbox color="primary" checked={isItemSelected} />
                            </TableCell>
                            <TableCell>{page.url}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Box
                sx={{
                  bgcolor: 'action.hover',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography variant="body2" color="text.primary" className="font-medium">
                  {selectedPages.length} pages selected for analysis. This uses {selectedPages.length * 2} credits.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isCrawling || selectedPages.length < 2}
                  startIcon={isAnalyzing ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                >
                  {isAnalyzing ? loadingMessages[loadingTextIndex] : 'Generate Internal Links'}
                </Button>
              </Box>
            </Grid>
          )}

          {/* STEP 3: ANALYSIS RESULTS */}
          {suggestions.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Box className="flex items-center gap-2 mb-6">
                {isAnalyzing ? (
                  <>
                    <CircularProgress size={28} color="primary" />
                    <Typography variant="h5" className="font-bold text-primary">
                      Analyzing... {suggestions.length} Links Found So Far
                    </Typography>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon color="success" fontSize="large" />
                    <Typography variant="h5" className="font-bold">
                      Analysis Complete: {suggestions.length} Links Found
                    </Typography>
                  </>
                )}
              </Box>

              <Grid container spacing={4}>
                {suggestions.map((sugg, index) => (
                  <Grid size={{ xs: 12 }} key={index}>
                    <Paper variant="outlined" className="p-5 hover:shadow-md transition-shadow">
                      <Box className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-3">
                        <Box className="flex-1 overflow-hidden">
                          <Typography variant="caption" color="text.secondary" className="font-bold uppercase tracking-wider">Source Page</Typography>
                          <Typography variant="body2" color="text.primary" className="truncate" title={sugg.sourceUrl}>
                            {sugg.sourceUrl}
                          </Typography>
                        </Box>

                        <Box className="flex items-center gap-2 text-primary">
                          <Divider className="w-8 md:w-16" />
                          <LinkIcon />
                          <Divider className="w-8 md:w-16" />
                        </Box>

                        <Box className="flex-1 overflow-hidden">
                          <Typography variant="caption" color="text.secondary" className="font-bold uppercase tracking-wider">Target Page</Typography>
                          <Typography variant="body2" color="text.primary" className="truncate" title={sugg.targetUrl}>
                            {sugg.targetUrl}
                          </Typography>
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          bgcolor: 'action.hover',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        <Box className="flex items-center gap-2">
                          <Typography variant="body2" color="text.primary" className="font-bold">Recommended Anchor:</Typography>
                          <Chip label={sugg.anchorText} color="primary" variant="outlined" size="small" className="font-bold" />
                        </Box>
                        <Typography variant="body2" color="text.secondary" className="italic">
                          "{sugg.reasoning}"
                        </Typography>
                      </Box>

                      <Box className="mt-4 flex justify-end">
                        <InternalLinker
                          siteUrl={domain}
                          sourceUrl={sugg.sourceUrl}
                          targetUrl={sugg.targetUrl}
                          anchorText={sugg.anchorText}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              <Box className="mt-8 text-center">
                <Button variant="outlined" onClick={() => setSuggestions([])}>
                  Analyze Different Pages
                </Button>
              </Box>
            </Grid>
          )}

        </Grid>
      </CardContent>
    </Card>
  )
}

export default LinksPage

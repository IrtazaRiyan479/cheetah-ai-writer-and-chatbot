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

const LinksPage = () => {
  // Workflow States
  const [domain, setDomain] = useState('')
  const [isCrawling, setIsCrawling] = useState(false)
  const [crawledPages, setCrawledPages] = useState([])

  const [selectedPages, setSelectedPages] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  // Action 1: Crawl the Domain
  const handleCrawl = async () => {
    if (!domain) return
    setIsCrawling(true)
    setSuggestions([]) // Reset previous results
    setSelectedPages([])

    try {
      const res = await fetch('/api/cheetah-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl', domain })
      })
      const data = await res.json()
      if (data.success) {
        setCrawledPages(data.pages)
        // Auto-select all by default to save user time
        setSelectedPages(data.pages.map(p => p.id))
      } else {
        alert('Failed to crawl domain.')
      }
    } catch (error) {
      alert('Failed to generate content.', error)
      console.error(error)
    } finally {
      setIsCrawling(false)
    }
  }

  // Action 2: Analyze Selected Pages
  const handleAnalyze = async () => {
    if (selectedPages.length < 2) {
      alert("Please select at least 2 pages to find internal links.")
      return
    }

    setIsAnalyzing(true)
    const pagesToAnalyze = crawledPages.filter(p => selectedPages.includes(p.id))

    try {
      const res = await fetch('/api/cheetah-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', selectedPages: pagesToAnalyze })
      })
      const data = await res.json()
      if (data.success) {
        setSuggestions(data.suggestions)
      } else {
        alert(data.error || 'Failed to analyze pages.')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle Checkbox Toggles
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
            CheetahLinks Engine
          </Typography>
        }
        subheader={
          <Typography variant="body1" color="text.secondary" className="mt-2 max-w-3xl">
            Build Internal Links 100x Faster. Enter your domain below to crawl your sitemap and discover high-quality internal linking opportunities powered by semantic AI.
          </Typography>
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
                  disabled={isAnalyzing || selectedPages.length < 2}
                  startIcon={isAnalyzing ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                >
                  {isAnalyzing ? 'Analyzing Semantics...' : 'Generate Internal Links'}
                </Button>
              </Box>
            </Grid>
          )}

          {/* STEP 3: ANALYSIS RESULTS */}
          {suggestions.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Box className="flex items-center gap-2 mb-6">
                <CheckCircleIcon color="success" fontSize="large" />
                <Typography variant="h5" className="font-bold">
                  Analysis Complete: {suggestions.length} Links Found
                </Typography>
              </Box>

              <Grid container spacing={4}>
                {suggestions.map((sugg, index) => (
                  <Grid item xs={12} key={index}>
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

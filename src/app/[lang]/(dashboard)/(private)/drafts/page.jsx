'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Box from '@mui/material/Box'
import { useRouter } from 'next/navigation'

const extractPreview = (htmlContent) => {
  if (!htmlContent) return { img: null, desc: '' };

  const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  const img = imgMatch ? imgMatch[1] : null;

  let desc = '';
  const pMatches = htmlContent.match(/<p>([\s\S]*?)<\/p>/gi);

  if (pMatches) {
    desc = pMatches.map(p => p.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 0).join(' ');
  } else {
    desc = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (desc.length > 420) {
    desc = desc.substring(0, 400) + '...';
  }

  return { img, desc };
};

export default function DraftsPage() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const router = useRouter()

  const fetchArticles = async () => {
    try {

      const res = await fetch('/api/drafts')

      if (res.status === 401) {
        setLoginDialogOpen(true)
        setLoading(false)
        return
      }

      const data = await res.json()
      if (data.articles) {
        setArticles(data.articles)
      }
    } catch (error) {
      console.error("Failed to load drafts", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [])

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    try {
      const res = await fetch(`/api/drafts?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setArticles(articles.filter(article => article.id !== id))
      } else {
        alert("Failed to delete draft")
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleEdit = (article) => {
    router.push(`/en/writer?draftId=${article.id}`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <Typography variant="h4" className="font-bold">My Drafts</Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => router.push('/writer')}
          startIcon={<i className="ri-add-line" />}
        >
          New Article
        </Button>
      </div>

      {loading ? (
        <Grid container spacing={4}>
          {[1, 2, 3].map((n) => (
            <Grid item xs={12} sm={6} md={4} key={n}>
              <Card className="shadow-md rounded-xl h-full flex flex-col">
                <Skeleton variant="rectangular" height={140} />
                <CardContent className="flex-grow">
                  <Skeleton variant="text" height={40} />
                  <Skeleton variant="text" width="60%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : articles.length === 0 ? (
        <Box className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
          <i className="ri-draft-line text-6xl text-gray-400 mb-4" />
          <Typography variant="h5" className="font-semibold text-gray-600 mb-2">No drafts found</Typography>
          <Typography variant="body1" className="text-gray-500 mb-6 max-w-md">
            Looks like you haven't saved any drafts yet. Start writing your next great article!
          </Typography>
          <Button variant="contained" color="primary" onClick={() => router.push('/editor')}>
            Create Your First Draft
          </Button>
        </Box>
      ) : (
        <Grid container spacing={4}>
          {articles.map((article) => {
            const { img, desc } = extractPreview(article.content)

            return (
              <Grid item xs={12} sm={6} md={4} key={article.id}>
                <Card className="shadow-md rounded-xl hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100 overflow-hidden">

                  {/* Hero Image Section */}
                  {img ? (
                    <Box
                      className="w-full h-80 bg-cover bg-center border-b border-gray-100"
                      style={{ backgroundImage: `url(${img})` }}
                    />
                  ) : (
                    <Box className="w-full h-40 bg-gray-50 flex items-center justify-center border-b border-gray-100">
                       <i className="ri-image-line text-4xl text-gray-300"></i>
                    </Box>
                  )}

                  <CardContent className="flex-grow flex flex-col gap-3 p-5">
                    <div className="flex justify-between items-start">
                      <Chip
                        label={article.status.toUpperCase()}
                        size="small"
                        color={article.status === 'draft' ? 'warning' : 'success'}
                        className="font-medium text-xs"
                      />
                      {article.targetSite && (
                         <Chip label={article.targetSite} size="small" variant="outlined" className="text-xs" />
                      )}
                    </div>
                    <Typography variant="h6" className="font-bold line-clamp-2 mt-1 leading-tight">
                      {article.title || 'Untitled Draft'}
                    </Typography>

                    <Typography variant="body2" color="textSecondary" className="line-clamp-3 mb-2 min-h-[60px]">
                      {desc || "No description available for this draft."}
                    </Typography>

                    <Typography variant="caption" color="textSecondary" className="flex items-center gap-1 mt-auto pt-3 border-t border-gray-100">
                      <i className="ri-calendar-line" />
                      Last saved: {new Date(article.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Typography>
                  </CardContent>
                  <CardActions className="flex justify-between border-t border-gray-100 p-4 bg-gray-50/50">
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={() => handleEdit(article)}
                      startIcon={<i className="ri-edit-line" />}
                    >
                      Continue Editing
                    </Button>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(article.id)}
                      title="Delete Draft"
                    >
                      <i className="ri-delete-bin-line" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      )}

      {/* Login Required Dialog */}
      <Dialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex items-center gap-2 text-error">
          <i className="ri-error-warning-line text-xl text-red-500" /> Session Expired
        </DialogTitle>
        <DialogContent>
          <Typography>
            You need to be logged in to view or manage your drafts. Please log in to continue without losing your progress.
          </Typography>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={() => setLoginDialogOpen(false)} color="inherit">Dismiss</Button>
          <Button variant="contained" color="primary" onClick={() => router.push('/login')}>
            Go to Login
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

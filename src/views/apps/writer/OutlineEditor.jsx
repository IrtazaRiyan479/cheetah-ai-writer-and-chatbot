'use client'

import { useState, useRef, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const OutlineEditor = ({ settings, setStep, outline, setOutline }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [anchorEl, setAnchorEl] = useState(null)
  const [activeItemIndex, setActiveItemIndex] = useState(null)
  const menuOpen = Boolean(anchorEl)

  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleMenuOpen = (event, index) => {
    setAnchorEl(event.currentTarget)
    setActiveItemIndex(index)
  }

  useEffect(() => {
    if (searchParams && searchParams.has('draftId')) {
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  const handleMenuClose = () => {
    setAnchorEl(null)
    setActiveItemIndex(null)
  }

  // --- OUTLINE MANIPULATION ---
  const handleTextChange = (index, newText) => {
    const newOutline = [...outline]
    newOutline[index].text = newText
    setOutline(newOutline)
  }

  const handleAddHeading = () => {
    setOutline([
      ...outline,
      { id: `heading-${Date.now()}`, type: 'h2', text: '' }
    ])
  }

  const handleDuplicate = () => {
    if (activeItemIndex === null) return
    const itemToDuplicate = outline[activeItemIndex]
    const newOutline = [...outline]
    newOutline.splice(activeItemIndex + 1, 0, {
      ...itemToDuplicate,
      id: `heading-${Date.now()}`,
      text: `${itemToDuplicate.text} (Copy)`
    })
    setOutline(newOutline)
    handleMenuClose()
  }

  const handleChangeType = (type) => {
    if (activeItemIndex === null) return
    const newOutline = [...outline]
    newOutline[activeItemIndex].type = type
    setOutline(newOutline)
    handleMenuClose()
  }

  const handleDelete = () => {
    if (activeItemIndex === null) return
    const newOutline = outline.filter((_, i) => i !== activeItemIndex)
    setOutline(newOutline)
    handleMenuClose()
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newOutline = [...outline]
    const draggedItem = newOutline.splice(draggedIndex, 1)[0]
    newOutline.splice(dropIndex, 0, draggedItem)

    setOutline(newOutline)
    setDraggedIndex(null)
  }

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
              <div
                key={item.id || index}
                className={`flex gap-3 items-start transition-all ${item.type === 'h3' ? 'ml-8' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Drag Handle */}
                <IconButton size='small' className='mt-1 cursor-grab text-textSecondary active:cursor-grabbing'>
                  <i className='ri-draggable' />
                </IconButton>

                <div className='flex-1 flex flex-col'>
                  <TextField
                    fullWidth
                    size='small'
                    value={item.text}
                    onChange={(e) => handleTextChange(index, e.target.value)}
                    placeholder={`Enter ${item.type.toUpperCase()} heading...`}
                    variant='outlined'
                    className='bg-backgroundPaper'
                  />
                </div>

                {/* Options Menu Trigger */}
                <IconButton
                  size='small'
                  className='mt-1'
                  onClick={(e) => handleMenuOpen(e, index)}
                >
                  <i className='ri-more-2-fill text-textSecondary' />
                </IconButton>
              </div>
            ))}

            <Divider className='my-2' />

            <Button
              variant='text'
              color='primary'
              startIcon={<i className='ri-add-line' />}
              onClick={handleAddHeading}
              className='self-start'
            >
              Add Heading
            </Button>

          </CardContent>
        </Card>
      </Grid>

      {/* RIGHT COLUMN: Summary Panel */}
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
              onClick={() => setStep(2)}
            >
              Write Article
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {/* REUSABLE ACTION MENU */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon><i className='ri-file-copy-line text-lg' /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>

        {activeItemIndex !== null && outline[activeItemIndex]?.type === 'h2' ? (
          <MenuItem onClick={() => handleChangeType('h3')}>
            <ListItemIcon><i className='ri-indent-increase text-lg' /></ListItemIcon>
            <ListItemText>Make H3 (Subheading)</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleChangeType('h2')}>
            <ListItemIcon><i className='ri-indent-decrease text-lg' /></ListItemIcon>
            <ListItemText>Make H2 (Main Heading)</ListItemText>
          </MenuItem>
        )}

        <Divider />

        <MenuItem onClick={handleDelete} className='text-error'>
          <ListItemIcon><i className='ri-delete-bin-line text-lg text-error' /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

    </Grid>
  )
}

export default OutlineEditor

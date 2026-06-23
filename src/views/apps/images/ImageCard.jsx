import { useState } from 'react' // 1. Added useState
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog' // 2. Added Dialog for the popup

// Icons
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close' // 3. Added Close Icon

const themeColors = ['primary', 'secondary', 'error', 'warning', 'info', 'success']

const ImageCard = ({ task, index }) => {
  const colorTag = themeColors[index % themeColors.length]

  // State to control the image modal
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Handles copying the actual image file to the user's clipboard
  const handleCopyImage = async () => {
    try {
      const response = await fetch(task.image);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      alert('Image copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy image: ', err);
    }
  }

  // Handles triggering a direct file download
  const handleDownload = async () => {
    try {
      const response = await fetch(task.image);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generation-${task.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image: ', err);
    }
  }

  return (
    <>
      <Card className='shadow-sm hover:shadow-md transition-shadow duration-300 w-full flex flex-col'>
        <CardContent className='flex flex-col flex-grow gap-3 p-4'>

          {/* 1. Header: Title & Actions */}
          <Box className='flex items-center justify-between'>
            <Chip label={task.title || 'Custom Generation'} variant='tonal' color={colorTag} size='small' className='max-w-[60%] truncate font-bold' />

            <Box className='flex gap-1'>
              <Tooltip title="Copy Image">
                <IconButton size="small" onClick={handleCopyImage} disabled={!task.image}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download">
                <IconButton size="small" onClick={handleDownload} disabled={!task.image}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* 2. The Image (Now Clickable) */}
          {task.image ? (
            <img
              src={task.image}
              alt={task.title}
              onClick={() => setIsModalOpen(true)}
              className='w-full rounded-md object-cover aspect-square border border-divider cursor-pointer hover:opacity-85 transition-opacity'
            />
          ) : (
            <div className='w-full rounded-md aspect-square bg-actionHover flex items-center justify-center animate-pulse'>
              <Typography variant='caption' color='text.secondary'>
                Loading Image...
              </Typography>
            </div>
          )}

          {/* 3. The Prompt (Footer) */}
          <Typography variant='body2' color='text.secondary' className='mt-1 leading-relaxed bg-actionHover p-2 rounded-md'>
            <span className="font-semibold text-textPrimary">Prompt: </span>
            <Tooltip
              title={task.description || task.prompt || 'A detailed AI generated image...'}
              placement="top"
              arrow
            >
              <span className="cursor-help">
                {(task.description || task.prompt || '').length > 70
                  ? `${(task.description || task.prompt).substring(0, 70)}...`
                  : (task.description || task.prompt || 'A detailed AI generated image based on the prompt provided.')}
              </span>
            </Tooltip>
          </Typography>

        </CardContent>
      </Card>

      {/* 4. The Enlarged Image Modal */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          className: 'bg-backgroundPaper rounded-xl overflow-hidden'
        }}
      >
        <Box className="relative">
          {/* Floating Close Button */}
          <IconButton
            onClick={() => setIsModalOpen(false)}
            className="absolute top-3 right-3 bg-black/40 text-white hover:bg-black/70 z-10 backdrop-blur-sm"
            size="small"
          >
            <CloseIcon />
          </IconButton>

          {/* Full Resolution Image */}
          <img
            src={task.image}
            alt={task.title}
            className="w-full h-auto max-h-[80vh] object-contain bg-black"
          />

          {/* Context Footer in Modal */}
          <Box className="p-5">
            <Typography variant="h6" className="font-bold">
              {task.title || 'Generated Image'}
            </Typography>
            <Typography variant="body1" color="text.secondary" className="mt-2 leading-relaxed">
              {task.description || task.prompt}
            </Typography>
          </Box>
        </Box>
      </Dialog>
    </>
  )
}

export default ImageCard

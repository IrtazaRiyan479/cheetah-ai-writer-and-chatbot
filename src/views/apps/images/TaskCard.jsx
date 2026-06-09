import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'

// Icons
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const themeColors = ['primary', 'secondary', 'error', 'warning', 'info', 'success']

const TaskCard = ({ task, index }) => {
  const colorTag = themeColors[index % themeColors.length]

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

        {/* 2. The Image */}
        {task.image ? (
          <img
            src={task.image}
            alt={task.title}
            className='w-full rounded-md object-cover aspect-square border border-divider'
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
          {task.description || task.prompt || 'A detailed AI generated image based on the prompt provided.'}
        </Typography>

      </CardContent>
    </Card>
  )
}

export default TaskCard

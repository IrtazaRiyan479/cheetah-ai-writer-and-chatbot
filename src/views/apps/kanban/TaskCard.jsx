// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

// A simple array of MUI theme colors for the chips
const themeColors = ['primary', 'secondary', 'error', 'warning', 'info', 'success']

// ADDED 'index' to the props
const TaskCard = ({ task, index }) => {
  // Use the index to loop through the themeColors array deterministically
  // (e.g., card 1 is primary, card 2 is secondary... card 7 loops back to primary)
  const colorTag = themeColors[index % themeColors.length]

  return (
    // ADDED: shrink-0 and specific width limits to keep them uniform in the horizontal slider
    <Card className='shadow-md hover:shadow-lg transition-shadow duration-300 shrink-0 w-[280px] md:w-[calc(50%-16px)]'>
      <CardContent className='flex flex-col gap-3 p-4'>

        {/* The Colored Title Area */}
        <div className='flex items-start justify-between'>
          <Chip label={task.title} variant='tonal' color={colorTag} size='small' className='max-w-full truncate' />
        </div>

        {/* The Image */}
        {task.image ? (
          <img
            src={task.image}
            alt={task.title}
            className='w-full rounded-md object-cover aspect-square'
          />
        ) : (
          <div className='w-full rounded-md aspect-square bg-actionHover flex items-center justify-center animate-pulse'>
            <Typography variant='caption' color='text.secondary'>
              Generating...
            </Typography>
          </div>
        )}

        {/* Concise Description */}
        <Typography variant='body2' color='text.secondary' className='line-clamp-2 mt-1'>
          {task.description || 'A detailed AI generated image based on the prompt provided.'}
        </Typography>

      </CardContent>
    </Card>
  )
}

export default TaskCard

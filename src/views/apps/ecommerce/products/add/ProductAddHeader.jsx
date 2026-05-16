// MUI Imports
import Typography from '@mui/material/Typography'

const ProductAddHeader = () => {
  return (
    <div className='flex flex-col mbe-4'>
      <Typography variant='h4' className='font-bold mbe-1'>
        Create New Article
      </Typography>
      <Typography color='text.secondary'>
        Configure your AI writing parameters below.
      </Typography>
    </div>
  )
}

export default ProductAddHeader

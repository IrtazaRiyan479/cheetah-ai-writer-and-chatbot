// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'

const Profile = () => {
  return (
    <Card>
      <CardHeader title='CheetahMagnets'
      subheader="Please briefly describe what you would like your KoalaMagnet to do.
eg 'Create quotes for a lawn maintenance service', 'Dog name generator', 'Act as a life coach'
Our AI will automatically create the first version for you. Then you will be able to view and edit it.
"
      />
      <CardContent>
        <Grid container spacing={5}>
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField fullWidth label='Domain name' placeholder='ABCD' />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Alert severity='warning' icon={<i className='ri-notification-3-line' />} className='font-medium text-lg'>
              Please visit the Pricing page and purchase the Professional plan or higher to get access to CheetahLinks.
            </Alert>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default Profile

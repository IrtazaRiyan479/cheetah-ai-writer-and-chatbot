'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'

const AccountSettings = () => {
  // State for the deactivation checkbox
  const [isConfirmed, setIsConfirmed] = useState(false)

  // State for form fields (Add your own state handlers as needed)
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    organization: 'ThemeSelection',
    phoneNumber: '+1 (917) 543-9876',
    address: '123 Main St, New York, NY 10001',
    state: 'New York',
    zipCode: '10001',
    country: 'USA',
    language: 'English',
    timezone: '(GMT-11:00) International Date Line West'
  })

  return (
    <Grid container spacing={6}>
      {/* Top Details Card */}
      <Grid item xs={12}>
        <Card>
          <CardContent className='flex flex-col gap-6'>
            {/* Profile Picture Section */}
            <div className='flex items-center gap-5'>
              <Avatar
                src='/images/avatars/1.png'
                alt='Profile Pic'
                className='is-[100px] bs-[100px] rounded'
              />
              <div className='flex flex-col gap-3'>
                <div className='flex items-center gap-3 flex-wrap'>
                  <Button variant='contained' component='label'>
                    Upload New Photo
                    <input hidden accept='image/png, image/jpeg' type='file' />
                  </Button>
                  <Button variant='outlined' color='secondary'>
                    Reset
                  </Button>
                </div>
                <Typography variant='body2'>
                  Allowed PNG or JPEG. Max size of 800K.
                </Typography>
              </div>
            </div>

            <Divider />

            {/* Form Fields Section */}
            <form onSubmit={e => e.preventDefault()}>
              <Grid container spacing={5}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='First Name' value={formData.firstName} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='Last Name' value={formData.lastName} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='E-mail' value={formData.email} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='Organization' value={formData.organization} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='Phone Number' value={formData.phoneNumber} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='Address' value={formData.address} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='State' value={formData.state} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label='Zip Code' value={formData.zipCode} />
                </Grid>

                {/* Dropdowns */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select label='Country' value={formData.country}>
                      <MenuItem value='USA'>USA</MenuItem>
                      <MenuItem value='UK'>UK</MenuItem>
                      <MenuItem value='Australia'>Australia</MenuItem>
                      <MenuItem value='Germany'>Germany</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Language</InputLabel>
                    <Select label='Language' value={formData.language}>
                      <MenuItem value='English'>English</MenuItem>
                      <MenuItem value='Spanish'>Spanish</MenuItem>
                      <MenuItem value='French'>French</MenuItem>
                      <MenuItem value='German'>German</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Timezone</InputLabel>
                    <Select label='Timezone' value={formData.timezone}>
                      <MenuItem value='(GMT-11:00) International Date Line West'>(GMT-11:00) International Date Line West</MenuItem>
                      <MenuItem value='(GMT-11:00) Midway Island'>(GMT-11:00) Midway Island</MenuItem>
                      <MenuItem value='(GMT-10:00) Hawaii'>(GMT-10:00) Hawaii</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Form Action Buttons */}
                <Grid item xs={12} className='flex gap-4'>
                  <Button variant='contained'>Save Changes</Button>
                  <Button variant='outlined' color='secondary'>Discard</Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Grid>

      {/* Delete Account Card */}
      <Grid item xs={12}>
        <Card>
          <CardContent className='flex flex-col gap-4'>
            <Typography variant='h5'>Delete Account</Typography>

            <Alert severity='warning' icon={false} className='bg-warningLight text-warning'>
              <AlertTitle className='font-bold mbe-2'>Are you sure you want to delete your account?</AlertTitle>
              Once you delete your account, there is no going back. Please be certain.
            </Alert>

            <div className='flex flex-col gap-4'>
              <FormControlLabel
                control={<Checkbox checked={isConfirmed} onChange={e => setIsConfirmed(e.target.checked)} />}
                label='I confirm my account deactivation'
              />
              <div>
                <Button variant='contained' color='error' disabled={!isConfirmed}>
                  Deactivate Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default AccountSettings

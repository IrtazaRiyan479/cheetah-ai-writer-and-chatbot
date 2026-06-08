'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation' // Added useRouter

// NextAuth Imports
import { signIn } from 'next-auth/react' // ADDED NEXT-AUTH

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert' // Added for error messages
import CircularProgress from '@mui/material/CircularProgress' // Added for loading state

// Component Imports
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const LoginV1 = ({ mode }) => {
  // UI States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Form States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-1-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-1-light.png'

  // Hooks
  const { lang: locale } = useParams()
  const router = useRouter()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // --- SUBMISSION HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Call NextAuth signIn with 'credentials' provider
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (res?.error) {
      // Invalid credentials
      setError(res.error)
      setIsLoading(false)
    } else {
      // Login successful! Redirect to the main app page (e.g., your writer tool)
      // Update '/writer' to whatever your main dashboard URL is
      router.push(getLocalizedUrl('/writer', locale))
    }
  }

  // Optional: Handler for Google Login
  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: getLocalizedUrl('/writer', locale) })
  }

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6'>
      <Card className='flex flex-col sm:is-[450px]'>
        <CardContent className='p-6 sm:!p-12'>
          <Link href={getLocalizedUrl('/', locale)} className='flex justify-center items-center mbe-6'>
            <Logo />
          </Link>
          <div className='flex flex-col gap-5'>
            <div>
              <Typography variant='h4'>Welcome to Cheetah AI! 👋🏻</Typography>
              <Typography className='mbs-1'>Please sign-in to your account and start the adventure</Typography>
            </div>

            {/* Display Error Message */}
            {error && <Alert severity="error">{error}</Alert>}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
              <TextField
                autoFocus
                fullWidth
                label='Email'
                type='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                fullWidth
                label='Password'
                required
                type={isPasswordShown ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        size='small'
                        edge='end'
                        onClick={handleClickShowPassword}
                        onMouseDown={e => e.preventDefault()}
                      >
                        <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <div className='flex justify-between items-center gap-x-3 gap-y-1 flex-wrap'>
                <FormControlLabel control={<Checkbox />} label='Remember Me' />
                <Typography className='text-end' color='primary' component={Link} href='/'>
                  Forgot password?
                </Typography>
              </div>
              <Button fullWidth variant='contained' type='submit' disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Log In'}
              </Button>
              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>New on our platform?</Typography>
                <Typography
                  component={Link}
                  href={getLocalizedUrl('/pages/auth/register-v1', locale)}
                  color='primary.main'
                >
                  Create an account
                </Typography>
              </div>
              <Divider className='gap-3 text-textPrimary'>or</Divider>
              <div className='flex justify-center items-center gap-2'>
                {/* Social Logins */}
                <IconButton size='small' className='text-facebook'>
                  <i className='ri-facebook-fill' />
                </IconButton>
                <IconButton size='small' className='text-twitter'>
                  <i className='ri-twitter-fill' />
                </IconButton>
                <IconButton size='small' className='text-textPrimary'>
                  <i className='ri-github-fill' />
                </IconButton>
                {/* Google Auth Connected */}
                <IconButton size='small' className='text-googlePlus' onClick={handleGoogleLogin}>
                  <i className='ri-google-fill' />
                </IconButton>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
      <img src={authBackground} className='absolute bottom-[5%] z-[-1] is-full max-md:hidden' />
    </div>
  )
}

export default LoginV1

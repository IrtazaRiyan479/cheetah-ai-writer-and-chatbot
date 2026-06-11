'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

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
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { signIn } from 'next-auth/react'

// Component Imports
import Logo from '@components/layout/shared/Logo'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const RegisterV1 = ({ mode }) => {
  // UI States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Form States
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false) // <-- ADDED: Track checkbox state

  // Vars
  const darkImg = '/images/pages/auth-v1-mask-2-dark.png'
  const lightImg = '/images/pages/auth-v1-mask-2-light.png'

  // Hooks
  const { lang: locale } = useParams()
  const router = useRouter()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const handleClickShowPassword = () => setIsPasswordShown(show => !show)

  // --- SUBMISSION HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // <-- ADDED: Mandatory Checkbox Validation
    if (!agreedToTerms) {
      setError('You must agree to the privacy policy & terms to register.')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })

      const data = await res.json()

      if (res.ok) {
        // 2. Account created! Now Auto-Login
        const signInRes = await signIn('credentials', {
          redirect: false,
          email: email,
          password: password,
        })

        if (signInRes?.error) {
          // If auto-login fails, send them to login page manually
          router.push(getLocalizedUrl('/login1', locale))
        } else {
          // 3. Success! Redirect to your app (e.g., /writer)
          router.push(getLocalizedUrl('/account', locale))
        }
      } else {
        // Registration failed
        setError(data.error || 'Registration failed.')
      }
    } catch (err) {
      setError('An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
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
              <Typography variant='h4'>Adventure starts here 🚀</Typography>
              <Typography className='mbs-1'>Make your app management easy and fun!</Typography>
            </div>

            {/* Display Error Message */}
            {error && <Alert severity="error">{error}</Alert>}

            <form noValidate autoComplete='off' onSubmit={handleSubmit} className='flex flex-col gap-5'>
              <TextField
                autoFocus
                fullWidth
                label='Username'
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
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
             <FormControlLabel
                control={
                  <Checkbox
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)} // <-- ADDED: Bind state to Checkbox
                  />
                }
                label={
                  <>
                    <span>I agree to the </span>
                    <Link
                      className='text-primary hover:underline'
                      href={getLocalizedUrl('/privacy-terms', locale)}
                      target="_blank"
                    >
                      privacy policy & terms
                    </Link>
                  </>
                }
              />
              <Button fullWidth variant='contained' type='submit' disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
              </Button>
              <div className='flex justify-center items-center flex-wrap gap-2'>
                <Typography>Already have an account?</Typography>
                <Typography
                  component={Link}
                  href={getLocalizedUrl('/login1', locale)}
                  color='primary.main'
                >
                  Sign in instead
                </Typography>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
      <img src={authBackground} className='absolute bottom-[5%] z-[-1] is-full max-md:hidden' alt='background design' />
    </div>
  )
}

export default RegisterV1

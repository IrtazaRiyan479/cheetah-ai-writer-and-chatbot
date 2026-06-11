// React Imports
import { useEffect, useRef, useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// SVG Imports
import ElementTwo from '@assets/svg/front-pages/landing-page/ElementTwo'
import Lines from '@assets/svg/front-pages/landing-page/Lines'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

import CircularProgress from '@mui/material/CircularProgress'

const ContactUs = () => {
  // Refs
  const skipIntersection = useRef(true)
  const ref = useRef(null)
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Hooks
  const { updateIntersections } = useIntersection()


  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (skipIntersection.current) {
          skipIntersection.current = false

          return
        }

        updateIntersections({ [entry.target.id]: entry.isIntersecting })
      },
      { threshold: 0.35 }
    )

    ref.current && observer.observe(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevents the page from refreshing
    setIsSubmitting(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setStatusMessage('Message sent successfully!');
        setFormData({ name: '', email: '', message: '' }); // Clear form
      } else {
        setStatusMessage('Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatusMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id='contact-us'
      className={classnames('flex flex-col gap-14 plb-[100px]', frontCommonStyles.layoutSpacing)}
      ref={ref}
    >
      <div className='flex flex-col items-center justify-center'>
        <div className='flex is-full justify-center items-center relative'>
          <ElementTwo className='absolute inline-start-0' />
          <div className='flex items-center justify-center mbe-6 gap-3'>
            <Lines />
            <Typography variant='h6' className='uppercase'>
              Contact Us
            </Typography>
          </div>
        </div>
        <div className='flex items-baseline flex-wrap gap-2 mbe-3 sm:mbe-2'>
          <Typography variant='h4' className='font-bold'>
            Let&apos;s work
          </Typography>
          <Typography variant='h5'>together</Typography>
        </div>
        <Typography className='font-medium text-center'>Have questions about Cheetah AI? Reach out to our team and we will get back to you promptly.</Typography>
      </div>
      <div>
        <Grid container spacing={6}>
          <Grid size={{ xs: 12, md: 6, lg: 5 }}>
            <Card className='bg-primary'>
              <CardContent className='flex flex-col gap-5 pli-8 pbs-8 pbe-7'>
                <div className='flex flex-col gap-1.5'>
                  <Typography className='font-medium text-white'>Get in Touch</Typography>
                  <Typography variant='h4' className='text-white'>
                    Share your project requirements or specific ideas with our AI experts.
                  </Typography>
                </div>
                <img src='/images/front-pages/landing-page/chat.png' alt='chat' className='is-full' />
                <Typography className='text-white'>
                 Looking for custom features or specialized integrations? Our team of developers is ready to build the exact solution your business needs to scale.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 7 }}>
            <Card>
              <CardContent>
                <Typography variant='h5' className='mbe-5'>
                  Share your ideas
                </Typography>
                <form onSubmit={handleSubmit} className='flex flex-col items-start gap-5'>
            <div className='flex gap-5 is-full'>
              <TextField
                fullWidth
                label='Full name'
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                fullWidth
                label='Email address'
                type='email'
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <TextField
              fullWidth
              multiline
              rows={7}
              label='Tell us about your project or ask a question...'
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />

            {/* 4. Update Button and Status Message */}
            <div className="flex items-center gap-4">
              <Button type="submit" variant='contained' disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Send Message'}
              </Button>

              {statusMessage && (
                <Typography color={statusMessage.includes('success') ? 'success.main' : 'error.main'}>
                  {statusMessage}
                </Typography>
              )}
            </div>
          </form>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </div>
    </section>
  )
}

export default ContactUs

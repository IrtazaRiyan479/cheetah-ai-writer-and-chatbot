// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Grid from '@mui/material/Grid'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// SVG Imports
import ElementOne from '@/assets/svg/front-pages/landing-page/ElementOne'
import Lines from '@assets/svg/front-pages/landing-page/Lines'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

const FaqsData = [
  {
    id: 'panel1',
    question: 'Is my subscription fee recurring?',
    answer:
      'Yes, all plans are billed on a monthly or yearly basis to ensure you always have access to the latest AI models and platform features. You can easily upgrade, downgrade, or cancel your plan at any time directly through your account dashboard.'
  },
  {
    id: 'panel2',
    question: 'Can I integrate Cheetah AI with my existing website?',
    active: true,
    answer:
      'Absolutely. Our API first architecture allows you to connect Cheetah AI to your existing tech stack with minimal configuration. We provide full documentation to help your development team get integrated quickly and securely.'
  },
  {
    id: 'panel3',
    question: 'How do you ensure my data privacy and security?',
    answer:
      'We prioritize the security of your business information. All data processed through our platform is encrypted in transit and at rest. We do not use your proprietary data to train our public models, so your business secrets stay private.'
  },
  {
    id: 'panel4',
    question: 'What level of support do I receive?',
    answer:
      'Support depends on your chosen plan. Starter users receive email support with a 24 hour response time. Growth and Scale users receive priority support via email, chat, and dedicated Google Meet sessions for onboarding and troubleshooting.'
  }
]

const Faqs = () => {
  // Refs
  const skipIntersection = useRef(true)
  const ref = useRef(null)

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

  return (
    <section
      id='faq'
      ref={ref}
      className={classnames('flex flex-col gap-16 plb-[100px]', frontCommonStyles.layoutSpacing)}
    >
      <div className='flex flex-col items-center justify-center'>
        <div className='flex is-full justify-center items-center relative'>
          <ElementOne className='absolute inline-end-0' />
          <div className='flex items-center justify-center mbe-6 gap-3'>
            <Lines />
            <Typography variant='h6' className='uppercase'>
              Faq
            </Typography>
          </div>
        </div>
        <div className='flex items-baseline flex-wrap gap-2 mbe-3 sm:mbe-2'>
          <Typography variant='h5'>Frequently asked</Typography>
          <Typography variant='h4' className='font-bold'>
            questions
          </Typography>
        </div>
        <Typography className='font-medium text-center'>
          Browse through these FAQs to find answers to commonly asked questions.
        </Typography>
      </div>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12, lg: 5 }} className='text-center'>
          <img
            src='/images/front-pages/landing-page/sitting-girl-with-laptop.png'
            alt='girl with laptop'
            className='is-[80%] max-is-[320px]'
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          {FaqsData.map((data, index) => {
            return (
              <Accordion key={index} defaultExpanded={data.active}>
                <AccordionSummary aria-controls={data.id + '-content'} id={data.id + '-header'} className='font-medium'>
                  <Typography component='span'>{data.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>{data.answer}</AccordionDetails>
              </Accordion>
            )
          })}
        </Grid>
      </Grid>
    </section>
  )
}

export default Faqs

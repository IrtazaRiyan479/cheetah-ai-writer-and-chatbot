// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'

// Third-party Imports
import classnames from 'classnames'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

// SVG Imports
import Lines from '@assets/svg/front-pages/landing-page/Lines'
import Curve from '@assets/svg/front-pages/landing-page/Curve'
import Arrow from '@assets/svg/front-pages/landing-page/Arrow'
import ElementTwo from '@/assets/svg/front-pages/landing-page/ElementTwo'

const pricingPlans = [
  {
    title: 'Starter',
    price: 0,
    features: ['5,000 words on signup', 'Words never expire', 'Free article types'],
    supportType: 'Trial',
    supportMedium: 'Added when you sign up',
    respondTime: '5,000 words',
    current: true
  },
  {
    title: 'Pro',
    price: 7.5,
    features: ['50,000 words added forever', 'Pro features included', 'Buy again any time'],
    supportType: 'Word pack',
    supportMedium: 'One-time payment',
    respondTime: 'Never expires',
    current: false
  },
  {
    title: 'Max',
    price: 16,
    features: ['200,000 words added forever', 'Everything in Pro', 'Buy again any time'],
    supportType: 'Word pack',
    supportMedium: 'One-time payment',
    respondTime: 'Never expires',
    current: false
  }
]

const PricingPlan = () => {
  // States
  const [val, setVal] = useState(458)

  const handleChange = (_, newValue) => {
    setVal(newValue)
  }

  return (
    <section
      id='pricing-plans'
      className={classnames('flex flex-col gap-8 lg:gap-12 plb-[100px]', frontCommonStyles.layoutSpacing)}
    >
      <div className='flex flex-col items-center justify-center'>
        <div className='flex is-full justify-center relative'>
          <ElementTwo className='absolute inline-start-0' />
          <div className='flex items-center justify-center mbe-6 gap-3 text-center'>
            <Lines />
            <Typography variant='h6' className='uppercase'>
              Pricing Plans
            </Typography>
          </div>
        </div>
        <div className='flex sm:items-baseline max-sm:items-center max-sm:flex-col gap-x-2 mbe-3 sm:mbe-2'>
          <Typography variant='h4' className='font-bold'>
            Tailored plans
          </Typography>
          <Typography variant='h5'>for every stage of your growth</Typography>
        </div>
        <Typography className='font-medium text-center'>
          Choose a word pack. Words are added once and never expire.
        </Typography>
      </div>
      <div className='text-center'>
        <Slider
          min={100}
          max={999}
          valueLabelDisplay='on'
          step={10}
          value={val}
          onChange={handleChange}
          className='is-[65%]'
        />
      </div>

      <Grid container spacing={6}>
        {pricingPlans.map((plan, index) => (
          <Grid size={{ xs: 12, lg: 4 }} key={index}>
            <Card
              variant='outlined'
              {...(plan.current && { className: 'border-2 border-[var(--mui-palette-primary-main)]' })}
            >
              <CardContent className='flex flex-col gap-8 p-8'>
                <div className='is-full flex flex-col gap-3'>
                  <Typography className='text-center' variant='h4'>
                    {plan.title}
                  </Typography>
                  <div className='flex items-center gap-3'>
                    <div className='flex items-start'>
                      {plan.price === 0 ? (
                        <Typography variant='h1' className='font-bold text-5xl'>
                          Free
                        </Typography>
                      ) : (
                        <>
                          <Typography variant='h5'>$</Typography>
                          <Typography variant='h1' className='font-bold text-5xl'>
                            {plan.price}
                          </Typography>
                        </>
                      )}
                    </div>
                    <div className='flex flex-col gap-0.5'>
                      <Typography color='text.primary' className='font-medium'>
                        One-time word pack
                      </Typography>
                      <Typography variant='body2'>Buy again whenever you need more</Typography>
                    </div>
                  </div>
                  <Curve />
                </div>
                <div>
                  <div className='flex flex-col gap-3'>
                    {plan.features.map((feature, index) => (
                      <div key={index} className='flex items-center gap-3'>
                        <Arrow />
                        <Typography variant='h5'>{feature}</Typography>
                      </div>
                    ))}
                  </div>
                  <Divider className='border mlb-4' />
                  <div className='flex gap-1 items-center justify-between'>
                    <div className='flex flex-col gap-0.5'>
                      <Typography color='text.primary' className='font-medium'>
                        {plan.supportType} Support
                      </Typography>
                      <Typography variant='body2'>{plan.supportMedium}</Typography>
                    </div>
                    <Chip variant='tonal' size='small' color='primary' label={plan.respondTime} />
                  </div>
                </div>
                <Button component={Link} href={plan.current ? '/register' : '/pricing'} variant={plan.current ? 'contained' : 'outlined'}>
                  {plan.current ? 'Get a 5000-word trial' : 'Buy words'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </section>
  )
}

export default PricingPlan

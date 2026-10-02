'use client'

import { useEffect, useState } from 'react'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CardContent from '@mui/material/CardContent'

// Third-party Imports
import classnames from 'classnames'

const PlanDetails = ({ data, pricingPlan }) => {
  const theme = useTheme()
  const [copy, setCopy] = useState(null)
  const title = String(data?.title || '').toLowerCase()
  const key = title.includes('basic') || title.includes('starter') ? 'starter' : title.includes('standard') || title.includes('pro') ? 'pro' : 'enterprise'

  useEffect(() => {
    let active = true
    fetch('/api/pricing/copy').then(response => response.json()).then(result => {
      const plan = result.pricing?.find(item => item.key === key)
      if (active && result.success && plan) setCopy(plan)
    }).catch(() => {})
    return () => { active = false }
  }, [key])

  const amount = copy?.displayAmount ?? (pricingPlan === 'monthly' ? data?.monthlyPrice : data?.yearlyPlan?.monthly)
  const benefits = copy?.bullets?.length ? copy.bullets : data?.planBenefits || []

  return (
    <CardContent className={classnames('relative border rounded flex flex-col gap-5 pbs-[3.75rem] ', { 'border-primary': data?.popularPlan })}>
      {copy?.badge || data?.popularPlan ? <Chip color='primary' label={copy?.badge || 'Popular'} size='small' className='absolute block-start-4 inline-end-5' variant='tonal' /> : null}
      <div className='flex justify-center'><img src={data?.imgSrc} height={data?.imgHeight} width={data?.imgWidth} alt={`${(copy?.name || data?.title || 'plan').toLowerCase().replace(' ', '-')}-img`} /></div>
      <div className='text-center flex flex-col gap-2'>
        <Typography variant='h4'>{copy?.name || data?.title}</Typography>
        <Typography>{data?.subtitle}</Typography>
      </div>
      <div className='relative mbe-[1.125rem]'>
        <div className='flex justify-center'>
          <Typography component='sup' className='self-start font-medium'>$</Typography>
          <Typography variant='h1' component='span' color='primary.main'>{amount}</Typography>
          <Typography component='sub' className='self-end font-medium'>/{copy?.interval || 'month'}</Typography>
        </div>
        {pricingPlan !== 'monthly' && data?.monthlyPrice !== 0 ? <Typography variant='caption' className={classnames('absolute inline-end-1/2', theme.direction === 'rtl' ? 'translate-x-[-50%]' : 'translate-x-[50%]')}>{`USD ${data?.yearlyPlan?.annually}/year`}</Typography> : null}
      </div>
      <div className='flex flex-col gap-4'>{benefits.map((item, index) => <div key={index} className='flex items-center gap-2.5'><span className='inline-flex'><i className='ri-checkbox-blank-circle-line text-sm' /></span><Typography>{item}</Typography></div>)}</div>
      {copy?.footnote ? <Typography variant='caption' color='text.secondary'>{copy.footnote}</Typography> : null}
      <Button fullWidth color={data?.currentPlan ? 'success' : 'primary'} variant={data?.popularPlan ? 'contained' : 'outlined'}>{data?.currentPlan ? 'Your Current Plan' : copy?.cta || 'Upgrade'}</Button>
    </CardContent>
  )
}

export default PlanDetails

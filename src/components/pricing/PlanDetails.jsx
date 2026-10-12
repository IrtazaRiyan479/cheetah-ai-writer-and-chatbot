'use client'

import { useEffect, useState } from 'react'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CardContent from '@mui/material/CardContent'

import classnames from 'classnames'

const PlanDetails = ({ data }) => {
  const pathname = usePathname()
  const locale = pathname?.split('/').filter(Boolean)[0] || 'en'
  const { data: session } = useSession()
  const [copy, setCopy] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const title = String(data?.title || '').toLowerCase()
  const key = title.includes('basic') || title.includes('starter') ? 'starter' : title.includes('standard') || title.includes('pro') ? 'pro' : 'enterprise'

  useEffect(() => {
    let active = true

    fetch('/api/pricing/copy')
      .then(response => response.json())
      .then(result => {
        const plan = result.pricing?.find(item => item.key === key)

        if (active && result.success && plan) setCopy(plan)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [key])

  const fallbackWords = key === 'starter' ? 5000 : key === 'enterprise' ? 200000 : 50000
  const words = Number(copy?.words) > 0 ? Number(copy.words) : fallbackWords
  const amount = copy?.displayAmount ?? (key === 'pro' ? 7.5 : key === 'enterprise' ? 16 : 0)
  const benefits = copy?.bullets?.length ? copy.bullets : [`${words.toLocaleString()} words, kept forever`, 'Buy again any time']

  const buy = async () => {
    setError('')

    if (key === 'starter') {
      window.location.assign('/' + locale + '/register')

      return
    }

    if (!session?.user) {
      window.location.assign('/' + locale + '/login?callbackUrl=%2F' + locale + '%2Fpricing')

      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: key })
      })
      const result = await response.json()

      if (!response.ok || !result.url) throw new Error(result.error || 'Could not start checkout.')
      window.location.assign(result.url)
    } catch (caught) {
      setError(caught.message || 'Could not start checkout.')
      setLoading(false)
    }
  }

  return (
    <CardContent className={classnames('relative border rounded flex flex-col gap-5 pbs-[3.75rem]', { 'border-primary': data?.popularPlan })}>
      {copy?.badge || data?.popularPlan ? (
        <Chip color='primary' label={copy?.badge || 'Popular'} size='small' className='absolute block-start-4 inline-end-5' variant='tonal' />
      ) : null}
      <div className='flex justify-center'>
        <img src={data?.imgSrc} height={data?.imgHeight} width={data?.imgWidth} alt='' />
      </div>
      <div className='text-center flex flex-col gap-1'>
        <Typography variant='h4'>{copy?.name || data?.title}</Typography>
        <Typography>{key === 'starter' ? 'Get a 5000-word trial' : `${Number(words).toLocaleString()} words, one-time`}</Typography>
      </div>
      <div className='flex justify-center items-end gap-1'>
        {key === 'starter' ? (
          <Typography variant='h3' color='primary.main'>
            Free
          </Typography>
        ) : (
          <>
            <Typography component='sup' className='self-start font-medium'>
              $
            </Typography>
            <Typography variant='h1' component='span' color='primary.main'>
              {amount}
            </Typography>
            <Typography component='sub' className='self-end font-medium'>
              once
            </Typography>
          </>
        )}
      </div>
      <div className='flex flex-col gap-3'>
        {benefits.map((item, index) => (
          <div key={index} className='flex items-center gap-2'>
            <i className='ri-check-line text-primary' />
            <Typography>{item}</Typography>
          </div>
        ))}
      </div>
      {copy?.footnote ? (
        <Typography variant='caption' color='text.secondary'>
          {copy.footnote}
        </Typography>
      ) : null}
      {error ? (
        <Typography color='error' variant='caption'>
          {error}
        </Typography>
      ) : null}
      <Button fullWidth color='primary' variant={data?.popularPlan ? 'contained' : 'outlined'} onClick={buy} disabled={loading}>
        {loading ? 'Redirecting...' : copy?.cta || (key === 'starter' ? 'Get a 5000-word trial' : 'Buy words')}
      </Button>
    </CardContent>
  )
}

export default PlanDetails

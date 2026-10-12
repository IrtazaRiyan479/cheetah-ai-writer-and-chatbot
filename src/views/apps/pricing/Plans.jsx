// Next Imports
import { useEffect, useState } from 'react'

import { usePathname } from 'next/navigation'

import { useSession } from 'next-auth/react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'
import styles from './styles.module.css'
import frontCommonStyles from '@views/apps/styles.module.css'

const plans = ['starter', 'pro', 'enterprise']

const featureIncluded = (mode, key) => {
  if (mode === 'free') return true
  if (mode === 'pro') return key !== 'starter'
  if (mode === 'max') return key === 'enterprise'
  return false
}

const wordsFor = (plan, key) => {
  const raw = Number(plan?.words)

  if (Number.isFinite(raw) && raw > 0) return raw
  if (key === 'starter') return 5000
  if (key === 'enterprise') return 200000

  return 50000
}

const Plans = () => {
  const { data: session } = useSession()
  const pathname = usePathname()
  const locale = pathname?.split('/').filter(Boolean)[0] || 'en'
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [pricingCopy, setPricingCopy] = useState(null)
  const [featureRows, setFeatureRows] = useState([])

  useEffect(() => {
    let active = true

    fetch('/api/pricing/copy')
      .then(response => response.json())
      .then(data => {
        if (!active || !data.success) return
        if (Array.isArray(data.pricing)) setPricingCopy(data.pricing)
        if (Array.isArray(data.features)) setFeatureRows(data.features)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const copyFor = key => pricingCopy?.find(plan => plan.key === key)

  const startCheckout = async plan => {
    setCheckoutError('')

    if (plan === 'starter') {
      window.location.assign('/' + locale + '/register')

      return
    }

    if (!session?.user) {
      window.location.assign('/' + locale + '/login?callbackUrl=%2F' + locale + '%2Fpricing')

      return
    }

    setCheckoutLoading(plan)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      })
      const data = await response.json()

      if (!response.ok || !data.url) throw new Error(data.error || 'Could not start checkout.')
      window.location.assign(data.url)
    } catch (error) {
      setCheckoutError(error?.message || 'Could not start checkout.')
      setCheckoutLoading('')
    }
  }

  return (
    <section className='md:plb-[100px] plb-[50px] bg-backgroundPaper'>
      <div className={frontCommonStyles.layoutSpacing}>
        <div className='flex flex-col text-center gap-2 mbe-6'>
          <Typography variant='h4'>Pick a plan that works best for you</Typography>
          <Typography>Words stay on the account. Buy a pack again whenever you need more.</Typography>
        </div>
        {checkoutError ? (
          <Typography color='error' role='alert' sx={{ mt: 2, textAlign: 'center' }}>
            {checkoutError}
          </Typography>
        ) : null}
        <div className='overflow-x-auto border rounded'>
          <table className={tableStyles.table}>
            <thead className={classnames('border-be', styles.tableHead)}>
              <tr>
                <th>Included</th>
                {plans.map(key => {
                  const copy = copyFor(key)
                  const words = wordsFor(copy, key)

                  return (
                    <th key={key}>
                      <div className='flex justify-center items-center gap-1'>
                        {copy?.name || (key === 'enterprise' ? 'Max' : key === 'pro' ? 'Pro' : 'Starter')}
                        {key === 'pro' ? (
                          <CustomAvatar size={20} color='primary'>
                            <i className='ri-star-line text-[14px]' />
                          </CustomAvatar>
                        ) : null}
                      </div>
                      <Typography variant='body2'>
                        {key === 'starter'
                          ? 'Get a 5000-word trial'
                          : `$${copy?.displayAmount || (key === 'pro' ? '7.5' : '16')} one-time · ${words.toLocaleString()} words`}
                      </Typography>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className={classnames('border-be', styles.tableBody)}>
              <tr>
                <td className='text-textPrimary'>5,000-word trial on signup</td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
              </tr>
              <tr>
                <td className='text-textPrimary'>Words never expire</td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
                <td>
                  <i className='ri-checkbox-circle-line text-primary' />
                </td>
              </tr>
              {featureRows.filter(feature => feature.mode && feature.mode !== 'off').map(feature => (
                <tr key={feature.key}>
                  <td className='text-textPrimary'>{feature.label}</td>
                  {plans.map(key => (
                    <td key={key}>
                      {featureIncluded(feature.mode, key) ? (
                        <i className='ri-checkbox-circle-line text-primary' />
                      ) : (
                        <i className='ri-close-circle-line' />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                {plans.map(key => (
                  <td key={key} className='text-center plb-[9px]'>
                    <Button variant={key === 'pro' ? 'contained' : 'outlined'} disabled={checkoutLoading === key} onClick={() => startCheckout(key)}>
                      {checkoutLoading === key ? 'Redirecting...' : copyFor(key)?.cta || (key === 'starter' ? 'Get a 5000-word trial' : 'Buy words')}
                    </Button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  )
}

export default Plans

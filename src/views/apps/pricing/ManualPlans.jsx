import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import CardContent from '@mui/material/CardContent'

import classnames from 'classnames'

import CustomAvatar from '@core/components/mui/Avatar'

import frontCommonStyles from '@views/apps/styles.module.css'

const WHATSAPP = '8801642319711'

const wa = text => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`

const plans = [
  {
    key: 'starter',
    name: 'Starter',
    sites: '1 site',
    price: '5,000',
    usd: '≈ $40',
    img: '/images/illustrations/objects/pricing-basic.png',
    popular: false,
    cta: 'Order Starter',
    message: 'Plan: Starter, 1 site (5,000 BDT)'
  },
  {
    key: 'growth',
    name: 'Growth',
    sites: '3 sites',
    price: '10,000',
    usd: '≈ $80',
    img: '/images/illustrations/objects/pricing-standard.png',
    popular: true,
    cta: 'Order Growth',
    message: 'Plan: Growth, 3 sites (10,000 BDT)'
  },
  {
    key: 'pro',
    name: 'Pro',
    sites: '5–7 sites',
    price: '17,000',
    usd: '≈ $137',
    img: '/images/illustrations/objects/pricing-enterprise.png',
    popular: false,
    cta: 'Order Pro',
    message: 'Plan: Pro, 5-7 sites (17,000 BDT)'
  }
]

const payments = [
  {
    title: 'bKash (Send Money)',
    icon: 'ri-smartphone-line',
    lines: ['+880 1627 760500', '+880 1914 334564']
  },
  {
    title: 'PayPal',
    icon: 'ri-paypal-line',
    lines: ['mdabrarnur91@gmail.com']
  },
  {
    title: 'Payoneer',
    icon: 'ri-links-line',
    href: 'https://link.payoneer.com/Token?t=60DF78F03CC8478BABD38E0F1F4017BD&src=pl',
    linkLabel: 'Pay with Payoneer'
  }
]

const bankRows = [
  ['Account Name', 'MD ABRAR BIN NUR'],
  ['Account Number', '1052124180001'],
  ['Bank', 'BRAC Bank PLC'],
  ['Branch', 'Bashabo Branch'],
  ['Routing Number', '060262875'],
  ['SWIFT Code', 'BRAKBDDH']
]

const steps = [
  'Choose your plan',
  'Pay with any method below',
  'Send a payment screenshot and your plan name on WhatsApp',
  'Get access after we confirm'
]

const ManualPlans = () => {
  return (
    <section className='plb-[50px] md:plb-[100px] bg-backgroundPaper'>
      <div className={classnames('flex flex-col gap-12', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col items-center text-center gap-2'>
          <Chip label='1 month' color='primary' variant='tonal' size='small' />
          <Typography variant='h4'>AI article plans</Typography>
          <Typography className='max-is-[640px]'>
            For bloggers, affiliate marketers and content teams. Pay locally, send the screenshot on WhatsApp, and we turn the plan on from the admin dashboard.
          </Typography>
        </div>

        <Grid container spacing={6}>
          {plans.map(plan => (
            <Grid key={plan.key} size={{ xs: 12, md: 4 }}>
              <CardContent
                className={classnames('relative border rounded flex flex-col gap-5 pbs-[3.75rem] bs-full', {
                  'border-primary': plan.popular
                })}
              >
                {plan.popular ? (
                  <Chip color='primary' label='Popular' size='small' className='absolute block-start-4 inline-end-5' variant='tonal' />
                ) : null}
                <div className='flex justify-center'>
                  <img src={plan.img} height={120} width={120} alt='' />
                </div>
                <div className='text-center flex flex-col gap-1'>
                  <Typography variant='h4'>{plan.name}</Typography>
                  <Typography>{plan.sites}</Typography>
                </div>
                <div className='flex flex-col items-center'>
                  <div className='flex justify-center items-end gap-1'>
                    <Typography component='sup' className='self-start font-medium'>
                      BDT
                    </Typography>
                    <Typography variant='h2' component='span' color='primary.main'>
                      {plan.price}
                    </Typography>
                  </div>
                  <Typography color='text.secondary'>{plan.usd}</Typography>
                </div>
                <div className='flex flex-col gap-3'>
                  {[
                    `Save ${plan.sites} to publish`,
                    'Usage stays a word cap, not an article count',
                    'Word cap is applied when the plan is activated'
                  ].map(item => (
                    <div key={item} className='flex items-center gap-2'>
                      <i className='ri-check-line text-primary' />
                      <Typography>{item}</Typography>
                    </div>
                  ))}
                </div>
                <Button
                  fullWidth
                  component='a'
                  href={wa(plan.message)}
                  target='_blank'
                  rel='noopener noreferrer'
                  color='primary'
                  variant={plan.popular ? 'contained' : 'outlined'}
                  startIcon={<i className='ri-whatsapp-line' />}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Grid>
          ))}
        </Grid>

        <Typography variant='body2' color='text.secondary' className='text-center'>
          USD prices are approximate (about 123.7 BDT per USD). Final amount may vary with exchange rate and payment fees. Only the Max plan can add unlimited websites.{' '}
          <a href={wa('Custom order')} target='_blank' rel='noopener noreferrer'>
            Request a custom order
          </a>
          .
        </Typography>

        <div className='flex flex-col gap-6'>
          <div className='flex flex-col text-center gap-2'>
            <Typography variant='h4'>Payment methods</Typography>
            <Typography>Send the screenshot of your payment on WhatsApp. We confirm it, then set the account to Pro.</Typography>
          </div>
          <Grid container spacing={6}>
            {payments.map(method => (
              <Grid key={method.title} size={{ xs: 12, md: 4 }}>
                <CardContent className='border rounded flex flex-col gap-3 bs-full'>
                  <div className='flex items-center gap-3'>
                    <CustomAvatar color='primary' variant='rounded' skin='light' size={40}>
                      <i className={classnames(method.icon, 'text-[22px]')} />
                    </CustomAvatar>
                    <Typography variant='h6'>{method.title}</Typography>
                  </div>
                  {method.lines?.map(line => (
                    <Typography key={line}>{line}</Typography>
                  ))}
                  {method.href ? (
                    <Button component='a' href={method.href} target='_blank' rel='noopener noreferrer' variant='text' className='self-start'>
                      {method.linkLabel}
                    </Button>
                  ) : null}
                </CardContent>
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}>
              <CardContent className='border rounded flex flex-col gap-4'>
                <div className='flex items-center gap-3'>
                  <CustomAvatar color='primary' variant='rounded' skin='light' size={40}>
                    <i className='ri-bank-line text-[22px]' />
                  </CustomAvatar>
                  <Typography variant='h6'>Bank transfer</Typography>
                </div>
                <div className='overflow-x-auto'>
                  <table className='is-full'>
                    <tbody>
                      {bankRows.map(([label, value]) => (
                        <tr key={label} className='border-be'>
                          <td className='p-3 text-textSecondary is-[40%]'>{label}</td>
                          <td className='p-3 font-medium'>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Grid>
          </Grid>
        </div>

        <div className='flex flex-col gap-6'>
          <div className='flex flex-col text-center gap-2'>
            <Typography variant='h4'>How to order</Typography>
          </div>
          <Grid container spacing={6}>
            {steps.map((step, index) => (
              <Grid key={step} size={{ xs: 12, sm: 6, md: 3 }}>
                <CardContent className='border rounded flex flex-col items-center text-center gap-3 bs-full'>
                  <CustomAvatar color='primary' size={40}>
                    {index + 1}
                  </CustomAvatar>
                  <Typography>{step}</Typography>
                </CardContent>
              </Grid>
            ))}
          </Grid>
          <Typography className='text-center'>
            Send screenshots and custom order requests to WhatsApp:{' '}
            <a href={`https://wa.me/${WHATSAPP}`} target='_blank' rel='noopener noreferrer'>
              +880 1642 319711
            </a>
          </Typography>
        </div>
      </div>
    </section>
  )
}

export default ManualPlans

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'

// Third-party Imports
import classnames from 'classnames'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

const FreeTrial = () => {
  return (
    <section className='bg-backgroundPaper'>
      <div className='bg-primaryLight'>
        <div className={classnames('flex justify-between flex-wrap md:relative', frontCommonStyles.layoutSpacing)}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <div className='flex flex-col gap-11 items-center md:items-start justify-center plb-10'>
                <div className='flex flex-col gap-2 max-md:text-center'>
                  <Typography variant='h4' color='primary.main'>
                    Get a 5000-word trial
                  </Typography>
                  <Typography>Sign up and the 5,000 words are added automatically. They stay on the account.</Typography>
                </div>
                <Button component={Link} href='/register' variant='contained'>
                  Get a 5000-word trial
                </Button>
              </div>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <div className='md:absolute md:inline-end-[90px] xl:inline-end-[2%] flex justify-center block-end-0'>
                <img src='/images/front-pages/pricing-illustration.png' alt='girl with laptop' className='bs-[270px]' />
              </div>
            </Grid>
          </Grid>
        </div>
      </div>
    </section>
  )
}

export default FreeTrial

'use client'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const PrivacyAndTerms = () => {
  const { lang: locale } = useParams()

  return (
    <div className='flex flex-col justify-center items-center min-bs-[100dvh] relative p-6 bg-backgroundDefault'>
      <Card className='max-w-[800px] w-full m-auto mt-10 mb-10 shadow-lg'>
        <CardContent className='p-6 sm:!p-12 flex flex-col gap-6'>

          <div className='text-center mb-4'>
            <Typography variant='h3' className='mb-2'>Privacy Policy & Terms of Service</Typography>
            <Typography color='textSecondary'>Last Updated: June 11, 2026</Typography>
          </div>

          <Divider />

          {/* TERMS OF SERVICE SECTION */}
          <section className='flex flex-col gap-4'>
            <Typography variant='h4' color='primary'>Terms of Service</Typography>

            <Typography variant='h6'>1. Acceptance of Terms</Typography>
            <Typography variant='body1'>
              By accessing and registering an account on AffiGenie Writer, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </Typography>

            <Typography variant='h6'>2. Description of Service</Typography>
            <Typography variant='body1'>
              AffiGenie Writer provides a suite of AI-powered tools, including but not limited to article generation, chat interfaces, image generation, AffiGenie Links for internal linking, and AffiGenie Magnets. We reserve the right to modify, suspend, or discontinue any part of the service at any time.
            </Typography>

            <Typography variant='h6'>3. User Accounts & Security</Typography>
            <Typography variant='body1'>
              To use our services, you must register for an account providing a valid email address and username. You are entirely responsible for maintaining the confidentiality of your password and account. You agree to notify us immediately of any unauthorized use of your account.
            </Typography>

            <Typography variant='h6'>4. AI-Generated Content & Acceptable Use</Typography>
            <Typography variant='body1'>
              You retain the rights to the content you generate using AffiGenie Writer. However, you agree not to use our platform to generate illegal, harmful, harassing, or highly offensive content. We reserve the right to terminate accounts that violate these usage guidelines.
            </Typography>
          </section>

          <Divider className='my-4' />

          {/* PRIVACY POLICY SECTION */}
          <section className='flex flex-col gap-4'>
            <Typography variant='h4' color='primary'>Privacy Policy</Typography>

            <Typography variant='h6'>1. Information We Collect</Typography>
            <Typography variant='body1'>
              We collect personal information that you voluntarily provide to us when registering on the platform, specifically your username, email address, and securely hashed passwords. We also collect usage data regarding your interactions with our AI generation tools.
            </Typography>

            <Typography variant='h6'>2. How We Use Your Information</Typography>
            <Typography variant='body1'>
              Your information is used to provide, maintain, and improve our services. This includes authenticating your secure dashboard sessions, processing your subscription (if applicable), and providing customer support.
            </Typography>

            <Typography variant='h6'>3. Third-Party Services & APIs</Typography>
            <Typography variant='body1'>
              To power our advanced generation features, AffiGenie Writer shares necessary prompt data with third-party sub-processors. This includes the Gemini API for text and logic generation, as well as the YouTube and Serper APIs for fetching relevant media and search data to enrich your content. These services are governed by their respective privacy policies.
            </Typography>

            <Typography variant='h6'>4. Data Security</Typography>
            <Typography variant='body1'>
              We implement industry-standard security measures, including bcrypt credential hashing and secure session verifications, to protect your personal information from unauthorized access, alteration, or disclosure.
            </Typography>

            <Typography variant='h6'>5. Contact Us</Typography>
            <Typography variant='body1'>
              If you have any questions about these Terms or our Privacy Policy, please contact our support team.
            </Typography>
          </section>

          <div className='mt-8 flex justify-center'>
            <Button
              variant='contained'
              component={Link}
              href={getLocalizedUrl('/register', locale)}
            >
              Back to Registration
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}

export default PrivacyAndTerms

// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// SVG Imports
import Lines from '@assets/svg/front-pages/landing-page/Lines'
import LaptopCharging from '@assets/svg/front-pages/landing-page/LaptopCharging'
import TransitionUp from '@assets/svg/front-pages/landing-page/TransitionUp'
import Edit from '@assets/svg/front-pages/landing-page/Edit'
import Cube from '@assets/svg/front-pages/landing-page/Cube'
import LifeBuoy from '@assets/svg/front-pages/landing-page/Lifebuoy'
import Document from '@assets/svg/front-pages/landing-page/Document'

// Styles Imports
import styles from './styles.module.css'
import frontCommonStyles from '@views/apps/styles.module.css'

// Data
const feature = [
  {
    icon: <LaptopCharging />,
    title: 'Advanced AI Models',
    description: 'Powered by state-of-the-art LLMs to generate high-quality and human-like content.'
  },
  {
    icon: <TransitionUp />,
    title: 'Intelligent Chatbot Engine',
    description: 'Deploy context-aware, custom-trained chatbots to your website in minutes.'
  },
  {
    icon: <Edit />,
    title: 'SEO-First Generation',
    description: "Don't just write—rank. Every output is optimized for search engines."
  },
  {
    icon: <Cube />,
    title: 'API-First Architecture',
    description: 'Connect AffiGenie directly to your existing tech stack with our flexible, easy-to-use API.'
  },
  {
    icon: <LifeBuoy />,
    title: 'Lightning-Fast Processing',
    description: 'Our backend is optimized to deliver high-quality, full-length content in seconds, not minutes.'
  },
  {
    icon: <Document />,
    title: 'Intuitive Dashboard',
    description: 'Manage your AI agents, and adjust parameters through a clean UI'
  }
]

const UsefulFeature = () => {
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
    <section id='features' ref={ref} className='bg-backgroundPaper'>
      <div className={classnames('flex flex-col gap-12 plb-[100px]', frontCommonStyles.layoutSpacing)}>
        <div className={classnames('flex flex-col items-center justify-center')}>
          <div className='flex items-center justify-center mbe-6 gap-3'>
            <Lines />
            <Typography color='text.primary' className='font-medium uppercase'>
              Useful Feature
            </Typography>
          </div>
          <div className='flex items-baseline max-sm:flex-col gap-x-2 mbe-3 sm:mbe-2'>
            <Typography variant='h4' className='font-bold'>
              AffiGenie
            </Typography>
            <Typography variant='h5' > to accelerate Your Content Workflow</Typography>
          </div>
          <Typography className='font-medium text-center'>
            More than just a generator — it's a comprehensive engine designed for speed, scale, and intelligence.
          </Typography>
        </div>
        <div>
          <Grid container rowSpacing={12} columnSpacing={6}>
            {feature.map((item, index) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={index}>
                <div className='flex flex-col gap-2 justify-center items-center'>
                  <div className={classnames('mbe-2', styles.featureIcon)}>
                    <div className='flex items-center border-2 rounded-full p-5 is-[82px] bs-[82px]'>{item.icon}</div>
                  </div>
                  <Typography variant='h5'>{item.title}</Typography>
                  <Typography className='max-is-[364px] text-center'>{item.description}</Typography>
                </div>
              </Grid>
            ))}
          </Grid>
        </div>
      </div>
    </section>
  )
}

export default UsefulFeature

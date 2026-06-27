// React Imports
import { useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Badge from '@mui/material/Badge'
import Rating from '@mui/material/Rating'
import { useKeenSlider } from 'keen-slider/react'
import classnames from 'classnames'

// Styled Component Imports
import AppKeenSlider from '@/libs/styles/AppKeenSlider'

// SVG Imports
import Lines from '@assets/svg/front-pages/landing-page/Lines'
import Levis from '@assets/svg/front-pages/landing-page/Levis'
import Continental from '@assets/svg/front-pages/landing-page/Continental'
import Eckerd from '@assets/svg/front-pages/landing-page/Eckerd'
import Dribbble from '@assets/svg/front-pages/landing-page/Dribbble'
import Airbnb from '@assets/svg/front-pages/landing-page/Airbnb'

// Styles Imports
import frontCommonStyles from '@views/apps/styles.module.css'

// Data
const data = [
  {
    desc: "AffiGenie has completely transformed my daily workflow. I am generating high quality blog drafts in minutes instead of hours. It feels like having an expert copywriter on my team.",
    svg: <Eckerd color='#2882C3' />,
    rating: 5,
    name: 'Sarah Jenkins',
    position: 'Content Director'
  },
  {
    desc: 'The chatbot integration was effortless. We deployed it on our e commerce site and saw our support ticket volume drop significantly within the first week.',
    svg: <Levis color='#A8112E' />,
    rating: 5,
    name: 'Mark Reynolds',
    position: 'Tech Lead'
  },
  {
    desc: "I have tested several AI platforms, but none match the speed and accuracy of AffiGenie. It has become the most important tool in our marketing stack.",
    svg: <Airbnb color='#FF5A60' />,
    rating: 4,
    name: 'Elena Rodriguez',
    position: 'Digital Strategist'
  },
  {
    desc: "The SEO optimization is what makes this tool stand out. My organic traffic has doubled since integrating AffiGenie into our content pipeline. It is a true game changer for our growth.",
    svg: <Continental color='#F39409' />,
    rating: 5,
    name: 'David Chen',
    position: 'SEO Specialist'
  },
  {
    desc: "Finally, an AI tool that actually understands our brand voice. AffiGenie creates content that sounds like us, not like a machine. It saves our team countless hours every week.",
    svg: <Dribbble color='#ea4c89' />,
    rating: 5,
    name: 'Jessica Thompson',
    position: 'Digital Strategist'
  }
]

const CustomerReviews = () => {
  // States
  const [loaded, setLoaded] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [details, setDetails] = useState()

  // Hooks
  const [sliderRef, instanceRef] = useKeenSlider(
    {
      loop: true,
      slideChanged: slider => setCurrentSlide(slider.track.details.rel),
      created: () => setLoaded(true),
      detailsChanged: s => setDetails(s.track.details),
      slides: {
        perView: 4,
        origin: 'center'
      },
      breakpoints: {
        '(max-width: 1200px)': {
          slides: {
            perView: 3,
            spacing: 26,
            origin: 'center'
          }
        },
        '(max-width: 900px)': {
          slides: {
            perView: 2,
            spacing: 26,
            origin: 'center'
          }
        },
        '(max-width: 600px)': {
          slides: {
            perView: 1,
            spacing: 26,
            origin: 'center'
          }
        }
      }
    },
    [
      slider => {
        let timeout
        const mouseOver = false

        function clearNextTimeout() {
          clearTimeout(timeout)
        }

        function nextTimeout() {
          clearTimeout(timeout)
          if (mouseOver) return
          timeout = setTimeout(() => {
            slider.next()
          }, 2000)
        }

        slider.on('created', nextTimeout)
        slider.on('dragStarted', clearNextTimeout)
        slider.on('animationEnded', nextTimeout)
        slider.on('updated', nextTimeout)
      }
    ]
  )

  const scaleStyle = idx => {
    if (!details) return {}
    const activeSlideIndex = details.rel

    return {
      transition: 'transform 0.2s ease-in-out, opacity 0.2s ease-in-out',
      ...(activeSlideIndex === idx ? { transform: 'scale(1)', opacity: 1 } : { transform: 'scale(0.9)', opacity: 0.5 })
    }
  }

  return (
    <section className='flex flex-col gap-16 plb-[100px]'>
      <div className={classnames('flex flex-col items-center justify-center', frontCommonStyles.layoutSpacing)}>
        <div className='flex items-center justify-center mbe-6 gap-3'>
          <Lines />
          <Typography color='text.primary' className='font-medium uppercase'>
            Real Customers Reviews
          </Typography>
        </div>
        <div className='flex items-baseline flex-wrap gap-2 mbe-3 sm:mbe-2'>
          <Typography variant='h4' className='font-bold'>
            Trusted by
          </Typography>
          <Typography variant='h5'>Marketing Teams</Typography>
        </div>
        <Typography className='font-medium text-center'>
          Real feedback from professionals using AffiGenie to scale their output.
        </Typography>
      </div>
      <AppKeenSlider>
        <>
          <div ref={sliderRef} className='keen-slider mbe-6'>
            {data.map((item, index) => (
              <div key={index} className='keen-slider__slide flex p-6 sm:p-4'>
                <Card elevation={8} className='flex items-center' style={scaleStyle(index)}>
                  <CardContent className='p-8 items-center mlb-auto'>
                    <div className='flex flex-col gap-4 items-center justify-center text-center'>
                      {/* {item.svg} */}
                      <Typography color='text.primary'>{item.desc}</Typography>
                      <Rating value={item.rating} readOnly />
                      <div>
                        <Typography color='text.primary' className='font-medium'>
                          {item.name}
                        </Typography>
                        <Typography variant='body2'>{item.position}</Typography>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
          {loaded && instanceRef.current && (
            <div className='swiper-dots'>
              {[...Array(instanceRef.current.track.details.slides.length).keys()].map(idx => {
                return (
                  <Badge
                    key={idx}
                    variant='dot'
                    component='div'
                    className={classnames({ active: currentSlide === idx })}
                    onClick={() => instanceRef.current?.moveToIdx(idx)}
                  />
                )
              })}
            </div>
          )}
        </>
      </AppKeenSlider>
      {/* <div className='flex flex-wrap items-center justify-center gap-x-16 gap-y-6 mli-3'>
        <Levis color='var(--mui-palette-text-secondary)' />
        <Continental color='var(--mui-palette-text-secondary)' />
        <Airbnb color='var(--mui-palette-text-secondary)' />
        <Eckerd color='var(--mui-palette-text-secondary)' />
        <Dribbble color='var(--mui-palette-text-secondary)' />
      </div> */}
    </section>
  )
}

export default CustomerReviews

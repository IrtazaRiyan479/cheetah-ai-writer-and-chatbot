export const db = [
  {
    title: 'Basic',
    monthlyPrice: 0,
    currentPlan: false,
    popularPlan: false,
    subtitle: 'Get a 5000-word trial',
    imgSrc: '/images/illustrations/objects/pricing-basic.png',
    imgHeight: 120,
    yearlyPlan: {
      monthly: 0,
      annually: 0
    },
    planBenefits: ['5,000 words on signup', 'Words never expire', 'Free article types']
  },
  {
    monthlyPrice: 49,
    title: 'Standard',
    popularPlan: true,
    currentPlan: false,
    subtitle: 'One-time word pack',
    imgSrc: '/images/illustrations/objects/pricing-standard.png',
    imgHeight: 120,
    yearlyPlan: {
      monthly: 40,
      annually: 480
    },
    planBenefits: ['50,000 words added forever', 'Pro features included', 'Buy again any time']
  },
  {
    monthlyPrice: 99,
    popularPlan: false,
    currentPlan: false,
    title: 'Max',
    subtitle: 'Largest one-time word pack',
    imgSrc: '/images/illustrations/objects/pricing-enterprise.png',
    imgHeight: 120,
    yearlyPlan: {
      monthly: 80,
      annually: 960
    },
    planBenefits: ['200,000 words added forever', 'Everything in Pro', 'Buy again any time']
  }
]

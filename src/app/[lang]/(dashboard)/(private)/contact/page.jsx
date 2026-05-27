// Component Imports
import FAQ from '@/views/apps/contact'

// Data Imports
import { getFaqData } from '@/app/server/actions'

const FAQPage = async () => {
  // Vars
  const data = await getFaqData()

  return <FAQ data={data} />
}

export default FAQPage

// Component Imports
import FAQ from '@/views/apps/contact'
import ModuleGate from '@/components/access/ModuleGate'

// Data Imports
import { getFaqData } from '@/app/server/actions'

const FAQPage = async () => {
  // Vars
  const data = await getFaqData()

  return (
    <ModuleGate featureKey='module-contact'>
      <FAQ data={data} />
    </ModuleGate>
  )
}

export default FAQPage

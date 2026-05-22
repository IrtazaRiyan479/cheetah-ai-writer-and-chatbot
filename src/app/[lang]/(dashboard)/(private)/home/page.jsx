// Component Imports
import LandingPageWrapper from '@views/apps/home'
import { IntersectionProvider } from '@/contexts/intersectionContext'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const LandingPage = async () => {
  // Vars
  const mode = await getServerMode()
return (
  <IntersectionProvider>
    <LandingPageWrapper mode={mode} />
  </IntersectionProvider>
  )
}

export default LandingPage

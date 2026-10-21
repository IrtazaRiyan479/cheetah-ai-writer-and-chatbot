// Component Imports
import LandingPageWrapper from '@views/apps/home'
import { IntersectionProvider } from '@/contexts/intersectionContext'
import ModuleGate from '@/components/access/ModuleGate'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const LandingPage = async () => {
  // Vars
  const mode = await getServerMode()
return (
  <ModuleGate featureKey='module-home'>
    <IntersectionProvider>
      <LandingPageWrapper mode={mode} />
    </IntersectionProvider>
  </ModuleGate>
  )
}

export default LandingPage

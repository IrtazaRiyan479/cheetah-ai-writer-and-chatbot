import ModuleGate from '@/components/access/ModuleGate'
// Next Imports
import dynamic from 'next/dynamic'

// Component Imports
import MagnetsMain from '@views/apps/magnets'

const Content = dynamic(() => import('@views/apps/magnets/content'))

// Vars
const ContentMain = () => ({
  'content': <Content />,
})

const MagnetsMainPage = () => {
  return (
    <ModuleGate featureKey='module-magnets'>
      <MagnetsMain tabContentList={ContentMain()} />
    </ModuleGate>
  )
}

export default MagnetsMainPage

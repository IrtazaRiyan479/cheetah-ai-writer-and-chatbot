import ModuleGate from '@/components/access/ModuleGate'
// Next Imports
import dynamic from 'next/dynamic'

// Component Imports
import LinksMain from '@views/apps/links'

const Content = dynamic(() => import('@views/apps/links/content'))

// Vars
const ContentMain = () => ({
  'content': <Content />,
})

const LinksMainPage = () => {
  return (
    <ModuleGate featureKey='module-links'>
      <LinksMain tabContentList={ContentMain()} />
    </ModuleGate>
  )
}

export default LinksMainPage

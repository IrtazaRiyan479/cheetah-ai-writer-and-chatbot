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
  return <MagnetsMain tabContentList={ContentMain()} />
}

export default MagnetsMainPage

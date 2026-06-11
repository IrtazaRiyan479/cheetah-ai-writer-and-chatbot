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
  return <LinksMain tabContentList={ContentMain()} />
}

export default LinksMainPage

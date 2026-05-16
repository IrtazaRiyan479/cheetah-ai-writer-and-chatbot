// Next Imports
import dynamic from 'next/dynamic'

// Component Imports
import Settings from '@views/apps/magnets'

const StoreDetailsTab = dynamic(() => import('@views/apps/magnets/store-details'))

// Vars
const tabContentList = () => ({
  'store-details': <StoreDetailsTab />,
})

const eCommerceSettings = () => {
  return <Settings tabContentList={tabContentList()} />
}

export default eCommerceSettings

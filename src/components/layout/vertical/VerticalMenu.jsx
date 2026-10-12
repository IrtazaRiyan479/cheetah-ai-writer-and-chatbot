'use client' // Make sure this is a client component since we are using useSession

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import { useTheme } from '@mui/material/styles'
import Chip from '@mui/material/Chip'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Data Imports
import menuData from '@/data/navigation/verticalMenuData'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// GenerateMenu Imports
import { GenerateVerticalMenu } from '@components/GenerateMenu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

// NextAuth Import
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { MODULE_FEATURES } from '@/libs/entitlement'

const RenderExpandIcon = ({ open, transitionDuration }) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ dictionary, scrollMenu }) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const params = useParams()

  // --- FETCH USER SESSION ---
  const { data: session } = useSession()
  const [hiddenHrefs, setHiddenHrefs] = useState([])

  useEffect(() => {
    let active = true
    fetch('/api/pricing/copy')
      .then(response => response.json())
      .then(data => {
        if (!active) return
        const modes = data.modes || {}
        setHiddenHrefs(MODULE_FEATURES.filter(item => modes[item.key] === 'off').map(item => item.href))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const { lang: locale } = params
  const ScrollWrapper = 'div'

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      className='bs-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
      onScroll={container => scrollMenu(container, false)}
    >
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        popoutMenuOffset={{ mainAxis: 17 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-fill' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {/* Pass the session to menuData so it can decide which links to render */}
        <GenerateVerticalMenu menuData={menuData(session, dictionary, params).filter(item => !hiddenHrefs.includes(item.href))} />
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu

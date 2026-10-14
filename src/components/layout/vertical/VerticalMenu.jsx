'use client'

import { useParams } from 'next/navigation'

import { useTheme } from '@mui/material/styles'

import menuData from '@/data/navigation/verticalMenuData'

import { Menu, MenuItem, MenuSection, SubMenu } from '@menu/vertical-menu'

import { GenerateVerticalMenu } from '@components/GenerateMenu'

import useVerticalNav from '@menu/hooks/useVerticalNav'

import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { MODULE_FEATURES } from '@/libs/entitlement'

const RenderExpandIcon = ({ open, transitionDuration }) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ dictionary, scrollMenu }) => {
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const params = useParams()

  const { data: session } = useSession()
  const [hiddenHrefs, setHiddenHrefs] = useState([])
  const [menuReady, setMenuReady] = useState(false)

  useEffect(() => {
    let active = true
    const load = () =>
      fetch('/api/pricing/copy')
        .then(response => response.json())
        .then(data => {
          if (!active) return
          const modes = data.modes || {}
          setHiddenHrefs(MODULE_FEATURES.filter(item => modes[item.key] === 'off').map(item => item.href))
          setMenuReady(true)
        })
        .catch(() => {
          if (!active) return
          setHiddenHrefs([])
          setMenuReady(true)
        })

    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    const interval = window.setInterval(load, 12000)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [])

  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const { lang: locale } = params
  const ScrollWrapper = 'div'

  const items = useMemo(() => {
    const data = menuData(session, dictionary, params)
    return data.filter(item => !hiddenHrefs.includes(item.href))
  }, [session, dictionary, params, hiddenHrefs])

  return (
    <ScrollWrapper
      className='bs-full overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
      onScroll={container => scrollMenu(container, false)}
    >
      <Menu
        popoutMenuOffset={{ mainAxis: 17 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-fill' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {menuReady ? <GenerateVerticalMenu key={hiddenHrefs.join('|')} menuData={items} /> : null}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu

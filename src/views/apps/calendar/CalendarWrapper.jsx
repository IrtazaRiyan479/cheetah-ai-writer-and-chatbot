'use client'

import { useCallback, useEffect, useState } from 'react'

import { useMediaQuery } from '@mui/material'
import { toast } from 'react-toastify'
import { useSession } from 'next-auth/react'

import { useDispatch, useSelector } from 'react-redux'

import Calendar from './Calendar'
import SidebarLeft from './SidebarLeft'
import AddEventSidebar from './AddEventSidebar'

import { setEvents } from '@/redux-store/slices/calendar'

import AppFullCalendar from '@/libs/styles/AppFullCalendar'

const ADMIN_WP_SITES_EMAIL = 'abrarshovon@admin.com'

const PREDEFINED_WP_SITE_OPTIONS = [
  { value: 'cheekypetpark', label: 'Cheeky Pet Park' },
  { value: 'webmarketics', label: 'Web Marketics' },
  { value: 'specialfootgear', label: 'Special Foot Gear' },
  { value: 'riderequips', label: 'Rider Equips' },
  { value: 'handfultool', label: 'Handful Tool' },
  { value: 'babiescarrier', label: 'Babies Carrier' }
]

const calendarsColor = {
  Scheduled: 'primary',
  Published: 'success',
  Draft: 'warning',
  Revision: 'info',
  Promotion: 'error'
}

async function persist(kind, payload) {
  if (kind === 'delete') {
    const res = await fetch(`/api/calendar?id=${encodeURIComponent(payload.id)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) throw new Error(data.error || 'Could not remove this publishing slot.')

    return {}
  }

  const res = await fetch('/api/calendar', {
    method: kind === 'create' ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()

  if (!res.ok) throw new Error(data.error || 'Could not save this publishing slot.')

  return data.event
}

const AppCalendar = () => {
  const [calendarApi, setCalendarApi] = useState(null)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [addEventSidebarOpen, setAddEventSidebarOpen] = useState(false)
  const [siteOptions, setSiteOptions] = useState([])

  const dispatch = useDispatch()
  const calendarStore = useSelector(state => state.calendarReducer)
  const { data: session, status: sessionStatus } = useSession()
  const mdAbove = useMediaQuery(theme => theme.breakpoints.up('md'))
  const handleLeftSidebarToggle = () => setLeftSidebarOpen(!leftSidebarOpen)
  const handleAddEventSidebarToggle = () => setAddEventSidebarOpen(!addEventSidebarOpen)

  const canUsePredefinedSites =
    sessionStatus === 'authenticated' &&
    String(session?.user?.email || '')
      .trim()
      .toLowerCase() === ADMIN_WP_SITES_EMAIL

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        toast.error(data.error || 'Could not load the publishing calendar.')
      }

      if (Array.isArray(data.events)) dispatch(setEvents(data.events))

      if (Array.isArray(data.warnings)) {
        data.warnings.forEach(message => {
          if (message) toast.warning(String(message))
        })
      }
    } catch {
      toast.error('Could not load the publishing calendar.')
    }
  }, [dispatch])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (sessionStatus === 'loading') return

    let cancelled = false

    const loadSites = async () => {
      const options = canUsePredefinedSites ? [...PREDEFINED_WP_SITE_OPTIONS] : []

      try {
        const res = await fetch('/api/custom-wp-sites')

        if (res.ok) {
          const data = await res.json()
          const saved = Array.isArray(data.sites) ? data.sites : []

          saved.forEach(site => {
            if (!site?.id) return

            options.push({
              value: `db_${site.id}`,
              label: site.name || site.url || `db_${site.id}`
            })
          })
        }
      } catch {
        // Keep whatever sites were already resolved.
      }

      if (!cancelled) setSiteOptions(options)
    }

    loadSites()

    return () => {
      cancelled = true
    }
  }, [canUsePredefinedSites, sessionStatus])

  const onPersist = async (kind, payload) => {
    try {
      return await persist(kind, payload)
    } catch (error) {
      toast.error(error.message || 'Calendar save failed.')

      return null
    }
  }

  return (
    <AppFullCalendar className='app-calendar'>
      <SidebarLeft
        mdAbove={mdAbove}
        dispatch={dispatch}
        calendarApi={calendarApi}
        calendarStore={calendarStore}
        calendarsColor={calendarsColor}
        leftSidebarOpen={leftSidebarOpen}
        handleLeftSidebarToggle={handleLeftSidebarToggle}
        handleAddEventSidebarToggle={handleAddEventSidebarToggle}
      />
      <div className='p-5 pbe-0 grow overflow-visible bg-backgroundPaper rounded'>
        <Calendar
          dispatch={dispatch}
          calendarApi={calendarApi}
          calendarStore={calendarStore}
          setCalendarApi={setCalendarApi}
          calendarsColor={calendarsColor}
          handleLeftSidebarToggle={handleLeftSidebarToggle}
          handleAddEventSidebarToggle={handleAddEventSidebarToggle}
          onPersist={onPersist}
          onReload={loadEvents}
        />
      </div>
      <AddEventSidebar
        dispatch={dispatch}
        calendarApi={calendarApi}
        calendarStore={calendarStore}
        addEventSidebarOpen={addEventSidebarOpen}
        handleAddEventSidebarToggle={handleAddEventSidebarToggle}
        onPersist={onPersist}
        siteOptions={siteOptions}
      />
    </AppFullCalendar>
  )
}

export default AppCalendar

'use client'

import { useCallback, useEffect, useState } from 'react'

import { useMediaQuery } from '@mui/material'
import { toast } from 'react-toastify'

import { useDispatch, useSelector } from 'react-redux'

import Calendar from './Calendar'
import SidebarLeft from './SidebarLeft'
import AddEventSidebar from './AddEventSidebar'

import { setEvents } from '@/redux-store/slices/calendar'

const calendarsColor = {
  Draft: 'warning',
  Published: 'success',
  Scheduled: 'primary'
}

async function persist(kind, payload) {
  if (kind === 'delete') {
    const res = await fetch(`/api/calendar?id=${encodeURIComponent(payload.id)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) throw new Error(data.error || 'Could not remove this article from the calendar.')

    return { success: true }
  }

  const res = await fetch('/api/calendar', {
    method: kind === 'create' ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) throw new Error(data.error || 'Could not save this article.')

  return data.event
}

const AppCalendar = () => {
  const [calendarApi, setCalendarApi] = useState(null)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [addEventSidebarOpen, setAddEventSidebarOpen] = useState(false)
  const [siteOptions, setSiteOptions] = useState([])
  const [selectedSites, setSelectedSites] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [sitesLoaded, setSitesLoaded] = useState(false)

  const dispatch = useDispatch()
  const calendarStore = useSelector(state => state.calendarReducer)
  const mdAbove = useMediaQuery(theme => theme.breakpoints.up('md'))
  const handleLeftSidebarToggle = () => setLeftSidebarOpen(!leftSidebarOpen)
  const handleAddEventSidebarToggle = () => setAddEventSidebarOpen(!addEventSidebarOpen)

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.error) {
        toast.error(data.error || 'Could not load the publishing calendar.')

        return
      }

      if (Array.isArray(data.events)) dispatch(setEvents(data.events))

      setDrafts(Array.isArray(data.drafts) ? data.drafts : [])
      setSiteOptions(Array.isArray(data.sites) ? data.sites : [])
      setSitesLoaded(true)
    } catch {
      toast.error('Could not load the publishing calendar.')
    }
  }, [dispatch])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (!sitesLoaded) return

    const keys = siteOptions.map(site => site.value)

    setSelectedSites(prev => (prev == null ? keys : prev.filter(key => keys.includes(key))))
  }, [siteOptions, sitesLoaded])

  const toggleSite = key => {
    setSelectedSites(prev => {
      const base = prev == null ? siteOptions.map(site => site.value) : prev

      return base.includes(key) ? base.filter(item => item !== key) : [...base, key]
    })
  }

  const toggleAllSites = checked => {
    setSelectedSites(checked ? siteOptions.map(site => site.value) : [])
  }

  const siteKeySet = new Set(siteOptions.map(site => site.value))
  const events = (calendarStore.events || []).filter(event => {
    if (!siteOptions.length || selectedSites == null) return true

    const siteKey = String(event?.extendedProps?.siteKey || '').trim()
    const match = siteOptions.find(site => site.value === siteKey || site.label === siteKey)

    if (match) return selectedSites.includes(match.value)

    // Articles with no saved website follow View All. A partial site selection hides them.
    return selectedSites.length === siteOptions.length && selectedSites.every(key => siteKeySet.has(key))
  })

  const onPersist = async (kind, payload) => {
    try {
      const event = await persist(kind, payload)

      await loadEvents()

      return event
    } catch (error) {
      toast.error(error.message || 'Calendar save failed.')

      return null
    }
  }

  return (
    <>
      <SidebarLeft
        mdAbove={mdAbove}
        dispatch={dispatch}
        calendarApi={calendarApi}
        calendarStore={calendarStore}
        calendarsColor={calendarsColor}
        leftSidebarOpen={leftSidebarOpen}
        handleLeftSidebarToggle={handleLeftSidebarToggle}
        handleAddEventSidebarToggle={handleAddEventSidebarToggle}
        siteOptions={siteOptions}
        selectedSites={selectedSites}
        onToggleSite={toggleSite}
        onToggleAllSites={toggleAllSites}
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
          events={events}
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
        drafts={drafts}
      />
    </>
  )
}

export default AppCalendar

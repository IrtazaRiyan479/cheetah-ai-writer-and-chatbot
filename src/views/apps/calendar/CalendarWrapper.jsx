'use client'

import { useEffect, useState } from 'react'

import { useMediaQuery } from '@mui/material'
import { toast } from 'react-toastify'

import { useDispatch, useSelector } from 'react-redux'

import Calendar from './Calendar'
import SidebarLeft from './SidebarLeft'
import AddEventSidebar from './AddEventSidebar'

import { setEvents } from '@/redux-store/slices/calendar'

import AppFullCalendar from '@/libs/styles/AppFullCalendar'

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

    if (!res.ok) throw new Error('Could not remove this publishing slot.')

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

  const dispatch = useDispatch()
  const calendarStore = useSelector(state => state.calendarReducer)
  const mdAbove = useMediaQuery(theme => theme.breakpoints.up('md'))
  const handleLeftSidebarToggle = () => setLeftSidebarOpen(!leftSidebarOpen)
  const handleAddEventSidebarToggle = () => setAddEventSidebarOpen(!addEventSidebarOpen)

  useEffect(() => {
    let cancelled = false

    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && Array.isArray(data.events)) dispatch(setEvents(data.events))
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load the publishing calendar.')
      })

    return () => {
      cancelled = true
    }
  }, [dispatch])

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
        />
      </div>
      <AddEventSidebar
        dispatch={dispatch}
        calendarApi={calendarApi}
        calendarStore={calendarStore}
        addEventSidebarOpen={addEventSidebarOpen}
        handleAddEventSidebarToggle={handleAddEventSidebarToggle}
        onPersist={onPersist}
      />
    </AppFullCalendar>
  )
}

export default AppCalendar

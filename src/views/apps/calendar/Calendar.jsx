import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material/styles'
import 'bootstrap-icons/font/bootstrap-icons.css'
import FullCalendar from '@fullcalendar/react'
import listPlugin from '@fullcalendar/list'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

import { filterEvents, selectedEvent, updateEvent } from '@/redux-store/slices/calendar'

const blankEvent = {
  title: '',
  start: '',
  end: '',
  allDay: false,
  url: '',
  extendedProps: {
    calendar: 'Scheduled',
    guests: [],
    description: ''
  }
}

export function serializeCalendarEvent(calendarEvent) {
  return {
    id: calendarEvent.id,
    title: calendarEvent.title,
    start: calendarEvent.start,
    end: calendarEvent.end || calendarEvent.start,
    allDay: calendarEvent.allDay,
    url: calendarEvent.url || '',
    calendar: calendarEvent.extendedProps?.calendar || 'Scheduled',
    guests: calendarEvent.extendedProps?.guests || [],
    description: calendarEvent.extendedProps?.description || '',
    siteKey: calendarEvent.extendedProps?.siteKey || ''
  }
}

const Calendar = props => {
  const {
    calendarStore,
    calendarApi,
    setCalendarApi,
    calendarsColor,
    dispatch,
    handleAddEventSidebarToggle,
    handleLeftSidebarToggle,
    onPersist,
    onReload
  } = props

  const calendarRef = useRef(null)
  const theme = useTheme()

  useEffect(() => {
    if (calendarApi === null) {
      setCalendarApi(calendarRef.current?.getApi())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const calendarOptions = {
    events: calendarStore.events,
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'sidebarToggle, prev, next, title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    views: {
      week: {
        titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
      }
    },
    editable: true,
    eventResizableFromStart: true,
    dragScroll: true,
    dayMaxEvents: 2,
    navLinks: true,
    eventClassNames({ event: calendarEvent }) {
      const colorName = calendarsColor[calendarEvent._def.extendedProps.calendar]

      return [`event-bg-${colorName}`]
    },
    eventClick({ event: clickedEvent, jsEvent }) {
      jsEvent.preventDefault()
      dispatch(selectedEvent(clickedEvent))
      handleAddEventSidebarToggle()

      if (clickedEvent.url) window.open(clickedEvent.url, '_blank')
    },
    customButtons: {
      sidebarToggle: {
        icon: 'bi bi-list',
        click() {
          handleLeftSidebarToggle()
        }
      }
    },
    dateClick(info) {
      const ev = { ...blankEvent, extendedProps: { ...blankEvent.extendedProps } }

      ev.start = info.date
      ev.end = info.date
      ev.allDay = true
      dispatch(selectedEvent(ev))
      handleAddEventSidebarToggle()
    },
    async eventDrop(info) {
      const saved = await onPersist?.('update', serializeCalendarEvent(info.event))

      if (!saved) {
        info.revert()
        onReload?.()

        return
      }

      dispatch(updateEvent(saved))
      dispatch(filterEvents())
    },
    async eventResize(info) {
      const saved = await onPersist?.('update', serializeCalendarEvent(info.event))

      if (!saved) {
        info.revert()
        onReload?.()

        return
      }

      dispatch(updateEvent(saved))
      dispatch(filterEvents())
    },
    ref: calendarRef,
    direction: theme.direction
  }

  return <FullCalendar {...calendarOptions} />
}

export default Calendar

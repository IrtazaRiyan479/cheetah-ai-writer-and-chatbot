import { useEffect, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Popover from '@mui/material/Popover'
import Typography from '@mui/material/Typography'
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
    articleId: calendarEvent.extendedProps?.articleId || calendarEvent.id,
    title: calendarEvent.title,
    start: calendarEvent.start,
    end: calendarEvent.end || calendarEvent.start,
    allDay: false,
    url: '',
    calendar: calendarEvent.extendedProps?.calendar || 'Scheduled',
    guests: [],
    description: calendarEvent.extendedProps?.description || '',
    siteKey: calendarEvent.extendedProps?.siteKey || ''
  }
}

function clipTitle(title) {
  const text = String(title || 'Untitled article')

  if (text.length <= 100) return text

  return `${text.slice(0, 97)}...`
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function localDayFromMarker(value) {
  const marker = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(marker.getTime())) return null

  // Day-cell markers keep the calendar day in UTC fields (FullCalendar local timezone).
  return new Date(marker.getUTCFullYear(), marker.getUTCMonth(), marker.getUTCDate())
}

function weekSlotStart(info) {
  const hidden = info.hiddenSegs || []
  const first = hidden[0]
  const raw = first?.eventRange?.range?.start || first?.eventRange?.instance?.range?.start || first?.start
  const fromSeg = raw ? asDate(raw) : null
  const base = fromSeg || asDate(info.date) || new Date()

  base.setMinutes(0, 0, 0)

  return base
}

function formatWhen(value) {
  const date = asDate(value)

  if (!date) return ''

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
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
    onReload,
    events = []
  } = props

  const calendarRef = useRef(null)
  const eventsRef = useRef(events)
  const theme = useTheme()
  const [more, setMore] = useState(null)

  eventsRef.current = events

  useEffect(() => {
    if (calendarApi === null) {
      setCalendarApi(calendarRef.current?.getApi())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openPlainEvent = event => {
    dispatch(
      selectedEvent({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end || event.start,
        allDay: false,
        url: '',
        extendedProps: event.extendedProps || {}
      })
    )
    setMore(null)
    handleAddEventSidebarToggle()
  }

  const calendarOptions = {
    events,
    plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'sidebarToggle, prev, next, title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    views: {
      dayGridMonth: {
        dayMaxEvents: 2,
        displayEventTime: false
      },
      timeGridWeek: {
        eventMaxStack: 2,
        slotDuration: '01:00:00',
        slotEventOverlap: false,
        eventMinHeight: 26,
        displayEventTime: false,
        titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
      },
      timeGridDay: {
        buttonText: 'day',
        slotDuration: '01:00:00',
        allDaySlot: false,
        displayEventTime: false,
        eventMaxStack: 2,
        eventMinHeight: 26
      },
      listMonth: {
        buttonText: 'list'
      }
    },
    editable: true,
    eventResizableFromStart: true,
    dragScroll: true,
    navLinks: true,
    navLinkDayClick: 'timeGridDay',
    eventClassNames({ event: calendarEvent }) {
      const colorName = calendarsColor[calendarEvent._def.extendedProps.calendar]

      return [`event-bg-${colorName}`]
    },
    eventClick({ event: clickedEvent, jsEvent }) {
      jsEvent.preventDefault()
      dispatch(selectedEvent(clickedEvent))
      handleAddEventSidebarToggle()
    },
    eventContent(arg) {
      if (String(arg.view?.type || '').startsWith('list')) return undefined

      const color = arg.event.extendedProps?.siteColor || '#7367F0'

      return (
        <div className='ag-cal-title'>
          <span className='ag-cal-site-dot' style={{ backgroundColor: color }} />
          <span className='ag-cal-title-text' title={arg.event.title}>
            {arg.event.title}
          </span>
        </div>
      )
    },
    moreLinkClick(info) {
      info.jsEvent?.preventDefault?.()

      const viewType = info.view?.type
      const source = eventsRef.current || []
      let items = []
      let date = new Date()

      if (viewType === 'timeGridWeek') {
        const slotStart = weekSlotStart(info)

        date = slotStart
        const slotEnd = slotStart.getTime() + 60 * 60 * 1000

        items = source.filter(event => {
          const time = asDate(event.start)

          return time && time.getTime() >= slotStart.getTime() && time.getTime() < slotEnd
        })
      } else {
        date = localDayFromMarker(info.date) || new Date()
        items = source
          .filter(event => {
            const time = asDate(event.start)

            return time && sameDay(time, date)
          })
          .sort((a, b) => new Date(a.start) - new Date(b.start))
          .slice(0, 9)
      }

      setMore({
        top: info.jsEvent?.clientY || 0,
        left: info.jsEvent?.clientX || 0,
        items,
        date
      })

      return true
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
      ev.allDay = false
      dispatch(selectedEvent(ev))
      handleAddEventSidebarToggle()
    },
    async eventDrop(info) {
      const saved = await onPersist?.('update', { ...serializeCalendarEvent(info.event), intent: 'move' })

      if (!saved) {
        info.revert()
        onReload?.()

        return
      }

      dispatch(updateEvent(saved))
      dispatch(filterEvents())
    },
    async eventResize(info) {
      const saved = await onPersist?.('update', { ...serializeCalendarEvent(info.event), intent: 'move' })

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

  return (
    <>
      <FullCalendar {...calendarOptions} />
      <Popover
        open={Boolean(more)}
        onClose={() => setMore(null)}
        anchorReference='anchorPosition'
        anchorPosition={more ? { top: more.top, left: more.left } : undefined}
        slotProps={{ paper: { sx: { width: 320, maxWidth: '90vw' } } }}
      >
        <Box className='flex flex-col' sx={{ py: 1 }}>
          {(more?.items || []).map(event => {
            const color = event.extendedProps?.siteColor || '#7367F0'

            return (
              <Box
                key={event.id}
                component='button'
                type='button'
                onClick={() => openPlainEvent(event)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  px: 2,
                  py: 1,
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <Box
                  component='span'
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flex: 'none',
                    backgroundColor: color
                  }}
                />
                <Typography variant='body2' title={event.title} sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {clipTitle(event.title)}
                </Typography>
              </Box>
            )
          })}
          <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
            <Button
              fullWidth
              size='small'
              variant='text'
              onClick={() => {
                calendarApi?.changeView('timeGridDay', more?.date)
                setMore(null)
              }}
            >
              View all
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

export default Calendar

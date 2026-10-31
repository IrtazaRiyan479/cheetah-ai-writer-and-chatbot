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

function startOfLocalDay(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const LANE_DOT_COLOR = {
  Draft: 'var(--mui-palette-warning-main)',
  Published: 'var(--mui-palette-success-main)',
  Scheduled: 'var(--mui-palette-primary-main)'
}

function siteTint(color) {
  const value = String(color || '').trim()
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)

  if (hex) {
    let raw = hex[1]

    if (raw.length === 3) raw = raw.split('').map(char => char + char).join('')

    const int = Number.parseInt(raw, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255

    return `rgba(${r}, ${g}, ${b}, 0.16)`
  }

  const hsl = value.match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i)

  if (hsl) return `hsla(${hsl[1]}, ${hsl[2]}%, ${hsl[3]}%, 0.16)`

  return ''
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

  useEffect(() => {
    const api = calendarRef.current?.getApi()

    if (!api) return undefined

    const frame = window.requestAnimationFrame(() => api.updateSize())

    return () => window.cancelAnimationFrame(frame)
  }, [events])

  const openPlainEvent = event => {
    dispatch(
      selectedEvent({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end || event.start,
        allDay: false,
        url: event.url || '',
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
        titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
      },
      timeGridDay: {
        buttonText: 'day',
        slotDuration: '01:00:00',
        allDaySlot: true,
        eventMaxStack: 2
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
    eventClassNames({ event: calendarEvent, view }) {
      const colorName = calendarsColor[calendarEvent.extendedProps?.calendar] || 'primary'
      const isList = String(view?.type || '').startsWith('list')

      if (isList || !siteTint(calendarEvent.extendedProps?.siteColor)) return [`event-bg-${colorName}`]

      return ['ag-cal-site-bg']
    },
    eventClick({ event: clickedEvent, jsEvent }) {
      jsEvent.preventDefault()
      dispatch(
        selectedEvent({
          id: clickedEvent.id,
          title: clickedEvent.title,
          start: clickedEvent.start,
          end: clickedEvent.end || clickedEvent.start,
          allDay: false,
          url: clickedEvent.url || '',
          extendedProps: { ...(clickedEvent.extendedProps || {}) }
        })
      )
      handleAddEventSidebarToggle()
    },
    eventDidMount(info) {
      if (String(info.view?.type || '').startsWith('list')) return

      const siteColor = info.event.extendedProps?.siteColor
      const tint = siteTint(siteColor)

      if (!tint) return

      info.el.style.setProperty('--fc-event-bg-color', tint)
      info.el.style.setProperty('--fc-event-border-color', 'transparent')
      info.el.style.setProperty('--fc-event-text-color', siteColor)
      info.el.style.setProperty('background-color', tint, 'important')
      info.el.style.setProperty('border-color', 'transparent', 'important')
      info.el.style.setProperty('color', siteColor, 'important')
      info.el.querySelectorAll('.fc-event-title, .fc-event-time').forEach(node => {
        node.style.setProperty('color', siteColor, 'important')
      })

      const title = info.el.querySelector('.fc-event-title')

      if (!title || title.querySelector('.ag-cal-type-dot')) return

      const dot = document.createElement('span')

      dot.className = 'ag-cal-type-dot'
      dot.style.backgroundColor = LANE_DOT_COLOR[info.event.extendedProps?.calendar] || LANE_DOT_COLOR.Scheduled
      title.prepend(dot)
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
      const clicked = info.date instanceof Date ? info.date : new Date(info.date)
      const now = new Date()
      const today = startOfLocalDay(now)
      const clickedDay = startOfLocalDay(clicked)
      const start = clickedDay && today && clickedDay < today ? now : clicked
      const ev = { ...blankEvent, extendedProps: { ...blankEvent.extendedProps } }

      ev.start = start
      ev.end = start
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
            const colorName = calendarsColor[event.extendedProps?.calendar] || 'primary'

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
                    bgcolor: `${colorName}.main`
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
                calendarApi?.changeView('listMonth', more?.date)
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

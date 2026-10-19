import { createSlice } from '@reduxjs/toolkit'

import { PUBLISH_CALENDARS } from '@/fake-db/apps/calendar'

const initialState = {
  events: [],
  filteredEvents: [],
  selectedEvent: null,
  selectedCalendars: [...PUBLISH_CALENDARS]
}

const filterEventsUsingCheckbox = (events, selectedCalendars) => {
  return events.filter(event => selectedCalendars.includes(event.extendedProps?.calendar))
}

export const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    setEvents: (state, action) => {
      state.filteredEvents = action.payload || []
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    filterEvents: state => {
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    addEvent: (state, action) => {
      if (!action.payload?.id) return

      state.filteredEvents.push(action.payload)
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    updateEvent: (state, action) => {
      const payload = action.payload

      state.filteredEvents = state.filteredEvents.map(event => {
        if (payload._def && event.id === payload._def.publicId) {
          return {
            id: event.id,
            url: payload._def.url,
            title: payload._def.title,
            allDay: payload._def.allDay,
            end: payload._instance.range.end,
            start: payload._instance.range.start,
            extendedProps: payload._def.extendedProps
          }
        }

        if (event.id === payload.id) return payload

        return event
      })
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    deleteEvent: (state, action) => {
      state.filteredEvents = state.filteredEvents.filter(event => event.id !== action.payload)
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    selectedEvent: (state, action) => {
      state.selectedEvent = action.payload
    },
    filterCalendarLabel: (state, action) => {
      const index = state.selectedCalendars.indexOf(action.payload)

      if (index !== -1) state.selectedCalendars.splice(index, 1)
      else state.selectedCalendars.push(action.payload)

      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    },
    filterAllCalendarLabels: (state, action) => {
      state.selectedCalendars = action.payload ? [...PUBLISH_CALENDARS] : []
      state.events = filterEventsUsingCheckbox(state.filteredEvents, state.selectedCalendars)
    }
  }
})

export const {
  setEvents,
  filterEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  selectedEvent,
  filterCalendarLabel,
  filterAllCalendarLabels
} = calendarSlice.actions

export default calendarSlice.reducer

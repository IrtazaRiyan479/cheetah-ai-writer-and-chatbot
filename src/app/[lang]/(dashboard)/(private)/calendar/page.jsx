'use client'

import Card from '@mui/material/Card'

import AppCalendar from '@views/apps/calendar/CalendarWrapper'
import AppFullCalendar from '@/libs/styles/AppFullCalendar'

const CalendarPage = () => {
  return (
    <Card className='overflow-visible'>
      <AppFullCalendar className='app-calendar'>
        <AppCalendar />
      </AppFullCalendar>
    </Card>
  )
}

export default CalendarPage

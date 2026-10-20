'use client'

import Card from '@mui/material/Card'

import ModuleGate from '@/components/access/ModuleGate'
import AppCalendar from '@views/apps/calendar/CalendarWrapper'
import AppFullCalendar from '@/libs/styles/AppFullCalendar'

const CalendarPage = () => {
  return (
    <ModuleGate featureKey='module-calendar'>
      <Card className='overflow-visible'>
        <AppFullCalendar className='app-calendar'>
          <AppCalendar />
        </AppFullCalendar>
      </Card>
    </ModuleGate>
  )
}

export default CalendarPage

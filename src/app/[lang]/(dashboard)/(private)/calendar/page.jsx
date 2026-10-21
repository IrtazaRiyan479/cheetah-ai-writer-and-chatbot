'use client'

import Card from '@mui/material/Card'

import ModuleGate from '@/components/access/ModuleGate'
import AppCalendar from '@views/apps/calendar/CalendarWrapper'

const CalendarPage = () => {
  return (
    <ModuleGate featureKey='module-calendar'>
      <Card className='overflow-visible ag-calendar-fill' sx={{ width: '100%', maxWidth: 'none' }}>
        <AppCalendar />
      </Card>
    </ModuleGate>
  )
}

export default CalendarPage

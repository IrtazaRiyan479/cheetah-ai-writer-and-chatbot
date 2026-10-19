const date = new Date()
const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)

export const PUBLISH_CALENDARS = ['Scheduled', 'Published', 'Draft', 'Revision', 'Promotion']

export const events = [
  {
    id: 'sample-scheduled',
    url: '',
    title: 'Sample: schedule a WordPress post',
    start: nextDay,
    end: nextDay,
    allDay: false,
    extendedProps: {
      calendar: 'Scheduled',
      guests: ['WordPress'],
      description: 'Example only. Real events load from your articles.'
    }
  }
]

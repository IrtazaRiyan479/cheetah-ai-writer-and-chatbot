import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import Typography from '@mui/material/Typography'
import FormControlLabel from '@mui/material/FormControlLabel'

import classnames from 'classnames'

import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'

import { filterAllCalendarLabels, filterCalendarLabel, selectedEvent } from '@/redux-store/slices/calendar'

const ACTION_LABELS = { Draft: 'Draft', Published: 'Publish', Scheduled: 'Schedule' }

const SidebarLeft = props => {
  const {
    mdAbove,
    leftSidebarOpen,
    calendarStore,
    calendarsColor,
    calendarApi,
    dispatch,
    handleLeftSidebarToggle,
    handleAddEventSidebarToggle,
    siteOptions = [],
    selectedSites,
    sitesLoading = false,
    onToggleSite,
    onToggleAllSites
  } = props

  const colorsArr = calendarsColor ? Object.entries(calendarsColor) : []
  const allSitesChecked = Boolean(siteOptions.length) && (selectedSites == null || selectedSites.length === siteOptions.length)

  const renderFilters = colorsArr.length
    ? colorsArr.map(([key, value]) => {
        return (
          <FormControlLabel
            className='mbe-1'
            key={key}
            label={ACTION_LABELS[key] || key}
            control={
              <Checkbox
                color={value}
                checked={calendarStore.selectedCalendars.indexOf(key) > -1}
                onChange={() => dispatch(filterCalendarLabel(key))}
              />
            }
          />
        )
      })
    : null

  const handleSidebarToggleSidebar = () => {
    dispatch(selectedEvent(null))
    handleAddEventSidebarToggle()
  }

  return (
    <Drawer
      open={leftSidebarOpen}
      onClose={handleLeftSidebarToggle}
      variant={mdAbove ? 'permanent' : 'temporary'}
      ModalProps={{
        disablePortal: true,
        disableAutoFocus: true,
        disableScrollLock: true,
        keepMounted: true
      }}
      className={classnames('block', { static: mdAbove, absolute: !mdAbove })}
      slotProps={{
        paper: {
          className: classnames('items-start is-[280px] shadow-none rounded rounded-se-none rounded-ee-none', {
            static: mdAbove,
            absolute: !mdAbove
          })
        }
      }}
      sx={{
        zIndex: 3,
        '& .MuiDrawer-paper': {
          zIndex: mdAbove ? 2 : 'drawer'
        },
        '& .MuiBackdrop-root': {
          borderRadius: 1,
          position: 'absolute'
        }
      }}
    >
      <div className='is-full p-5'>
        <Button
          fullWidth
          variant='contained'
          onClick={handleSidebarToggleSidebar}
          startIcon={<i className='ri-add-line' />}
        >
          Schedule Article
        </Button>
      </div>
      <Divider className='is-full' />
      <AppReactDatepicker
        inline
        onChange={date => date && calendarApi?.gotoDate(date)}
        onMonthChange={date => date && calendarApi?.gotoDate(date)}
        onYearChange={date => date && calendarApi?.gotoDate(date)}
        boxProps={{
          className: 'flex justify-center is-full',
          sx: { '& .react-datepicker': { boxShadow: 'none !important', border: 'none !important' } }
        }}
      />
      <Divider className='is-full' />
      <div className='flex flex-col p-5 is-full'>
        <Typography variant='h5' className='mbe-4'>
          Publish Filters
        </Typography>
        <FormControlLabel
          className='mbe-1'
          label='View All'
          control={
            <Checkbox
              color='secondary'
              checked={calendarStore.selectedCalendars.length === colorsArr.length}
              onChange={e => dispatch(filterAllCalendarLabels(e.target.checked))}
            />
          }
        />
        {renderFilters}
      </div>
      <Divider className='is-full' />
      <div className='flex flex-col p-5 is-full'>
        <Typography variant='h5' className='mbe-4'>
          Websites
        </Typography>
        {siteOptions.length ? (
          <>
            <FormControlLabel
              className='mbe-1'
              label='View All'
              control={
                <Checkbox color='secondary' checked={allSitesChecked} onChange={e => onToggleAllSites?.(e.target.checked)} />
              }
            />
            {siteOptions.map(site => (
              <FormControlLabel
                className='mbe-1'
                key={site.value}
                label={site.label}
                control={
                  <Checkbox
                    checked={selectedSites == null || selectedSites.includes(site.value)}
                    onChange={() => onToggleSite?.(site.value)}
                    sx={{
                      color: site.color || '#2563EB',
                      '&.Mui-checked': { color: site.color || '#2563EB' }
                    }}
                  />
                }
              />
            ))}
          </>
        ) : sitesLoading ? (
          <Typography variant='body2' color='text.secondary'>
            Loading websites…
          </Typography>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            No WordPress sites yet.
          </Typography>
        )}
      </div>
    </Drawer>
  )
}

export default SidebarLeft

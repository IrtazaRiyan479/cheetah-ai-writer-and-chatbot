import { useState, useEffect, forwardRef, useCallback } from 'react'

import { usePathname, useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import FormControl from '@mui/material/FormControl'

import PerfectScrollbar from 'react-perfect-scrollbar'
import { toast } from 'react-toastify'

import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'

import { deleteEvent, selectedEvent, filterEvents } from '@/redux-store/slices/calendar'

// eslint-disable-next-line no-unused-vars
const SITE_OPTIONS = ['WordPress', 'Medium', 'LinkedIn', 'Newsletter', 'Facebook', 'Pinterest']
const LOCALES = ['en', 'fr', 'ar']
const ACTION_TYPES = ['Draft', 'Published', 'Scheduled']
const ACTION_LABELS = { Draft: 'Draft', Published: 'Publish', Scheduled: 'Schedule' }

const defaultState = {
  articleId: '',
  allDay: false,
  description: '',
  calendar: 'Scheduled',
  publishDate: new Date(),
  windowTime: new Date(),
  siteKey: ''
}

function localeFromPath(pathname) {
  const segment = String(pathname || '')
    .split('/')
    .filter(Boolean)[0]

  return LOCALES.includes(segment) ? segment : 'en'
}

function combineLocalDateTime(day, time) {
  const date = new Date(day)
  const clock = new Date(time)

  if (Number.isNaN(date.getTime()) || Number.isNaN(clock.getTime())) return null

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), clock.getHours(), clock.getMinutes(), 0, 0)
}

const AddEventSidebar = props => {
  const {
    calendarStore,
    dispatch,
    addEventSidebarOpen,
    handleAddEventSidebarToggle,
    onPersist,
    onReload,
    calendarApi,
    siteOptions = [],
    drafts = []
  } = props

  const [values, setValues] = useState(defaultState)
  const [siteError, setSiteError] = useState(false)
  const [articleError, setArticleError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [articleContent, setArticleContent] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [articleLoad, setArticleLoad] = useState('idle')
  const router = useRouter()
  const pathname = usePathname()
  const locale = localeFromPath(pathname)

  const PickersComponent = forwardRef(({ ...props }, ref) => {
    return (
      <TextField
        inputRef={ref}
        fullWidth
        {...props}
        label={props.label || ''}
        className='is-full'
        error={props.error}
      />
    )
  })

  const isBelowSmScreen = useMediaQuery(theme => theme.breakpoints.down('sm'))
  const selected = calendarStore.selectedEvent

  const articleOptions = drafts.map(draft => ({
    id: draft.id,
    title: draft.title || 'Untitled article'
  }))

  if (selected?.id && !articleOptions.some(item => item.id === selected.id)) {
    articleOptions.unshift({
      id: selected.id,
      title: selected.title || 'Untitled article'
    })
  }

  const showGenerate = drafts.length === 0
  const noSites = siteOptions.length === 0

  const goWriter = () => {
    router.push(`/${locale}/writer`)
  }

  const resetToStoredValues = useCallback(() => {
    if (calendarStore.selectedEvent !== null) {
      const event = calendarStore.selectedEvent
      let start = event.start ? new Date(event.start) : new Date()
      const lane = ACTION_TYPES.includes(event.extendedProps?.calendar) ? event.extendedProps.calendar : 'Scheduled'

      if (Number.isNaN(start.getTime())) start = new Date()

      if (!event.id) {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())

        if (startDay < today) start = now
      }

      setValues({
        articleId: event.id || '',
        allDay: false,
        description: event.extendedProps?.description || '',
        calendar: lane,
        publishDate: start,
        windowTime: start,
        siteKey: event.extendedProps?.siteKey || ''
      })
      setSiteError(false)
      setArticleError(false)
    }
  }, [calendarStore.selectedEvent])

  const resetToEmptyValues = useCallback(() => {
    const now = new Date()

    setValues({ ...defaultState, publishDate: now, windowTime: now })
    setSiteError(false)
    setArticleError(false)
  }, [])

  const handleSidebarClose = () => {
    setValues(defaultState)
    setSiteError(false)
    setArticleError(false)
    setConfirmDelete(false)
    dispatch(selectedEvent(null))
    handleAddEventSidebarToggle()
  }

  const onSubmit = async event => {
    event.preventDefault()

    const isNew = !calendarStore.selectedEvent?.id

    if (noSites) return

    if (!values.articleId || values.articleId === '__generate') {
      setArticleError(true)

      return
    }

    if (!values.siteKey) {
      setSiteError(true)

      return
    }

    const payload = {
      intent: 'action',
      articleId: values.articleId,
      id: values.articleId,
      calendar: values.calendar,
      siteKey: values.siteKey,
      description: values.description,
      title: articleTitle,
      content: articleContent,
      allDay: false
    }

    let when = null

    if (values.calendar === 'Scheduled') {
      const start = combineLocalDateTime(values.publishDate, values.windowTime)

      if (!start || start.getTime() <= Date.now() + 60 * 1000) return

      payload.start = start
      when = start
    }

    if (articleLoad === 'loading') return

    setSaving(true)

    try {
      const isWp = String(values.articleId).startsWith('wp_')

      if (!isWp) {
        const status = values.calendar === 'Published' ? 'publish' : values.calendar === 'Draft' ? 'draft' : 'future'
        const picked = articleOptions.find(article => article.id === values.articleId)

        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: picked?.title || 'Untitled article',
            content: articleContent,
            status,
            siteKey: values.siteKey,
            scheduledAt: when ? when.toISOString() : '',
            articleId: values.articleId
          })
        })

        const result = await res.json().catch(() => ({}))

        if (!res.ok || !result.success) {
          toast.error(typeof result.error === 'string' ? result.error : 'Could not publish this article.')

          return
        }

        calendarApi?.gotoDate(when || new Date())
        await onReload?.()
        dispatch(filterEvents())
        handleSidebarClose()

        return
      }

      const saved = await onPersist?.(isNew ? 'create' : 'update', payload)

      if (!saved?.id && !saved?.success) return

      calendarApi?.gotoDate(saved?.start || when || new Date())
      dispatch(filterEvents())
      handleSidebarClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteButtonClick = () => {
    if (!calendarStore.selectedEvent?.id) {
      handleSidebarClose()

      return
    }

    setConfirmDelete(true)
  }

  const confirmDeleteArticle = async () => {
    const id = calendarStore.selectedEvent?.extendedProps?.articleId || calendarStore.selectedEvent?.id

    if (!id) return

    setDeleting(true)

    try {
      const removed = await onPersist?.('delete', { id })

      if (removed == null) return

      dispatch(deleteEvent(id))
      dispatch(deleteEvent(calendarStore.selectedEvent.id))
      dispatch(filterEvents())
      setConfirmDelete(false)
      handleSidebarClose()
    } finally {
      setDeleting(false)
    }
  }

  const RenderSidebarFooter = () => {
    const scheduleStart =
      values.calendar === 'Scheduled' ? combineLocalDateTime(values.publishDate, values.windowTime) : null

    const scheduleBlocked =
      values.calendar === 'Scheduled' && (!scheduleStart || scheduleStart.getTime() <= Date.now() + 60 * 1000)
    const disabled = saving || noSites || !values.articleId || articleLoad === 'loading' || scheduleBlocked

    if (!calendarStore.selectedEvent?.id) {
      return (
        <div className='flex gap-4'>
          <Button type='submit' variant='contained' disabled={disabled}>
            {saving ? 'Saving...' : 'Add'}
          </Button>
          <Button variant='outlined' color='secondary' onClick={resetToEmptyValues}>
            Reset
          </Button>
        </div>
      )
    }

    return (
      <div className='flex gap-4'>
        <Button type='submit' variant='contained' disabled={disabled}>
          {saving ? 'Saving...' : 'Update'}
        </Button>
        <Button variant='outlined' color='secondary' onClick={resetToStoredValues}>
          Reset
        </Button>
      </div>
    )
  }

  const ScrollWrapper = isBelowSmScreen ? 'div' : PerfectScrollbar

  useEffect(() => {
    const articleId = String(values.articleId || '')

    if (!articleId || articleId === '__generate') {
      setArticleContent('')
      setArticleTitle('')
      setArticleLoad('idle')

      return
    }

    let active = true

    setArticleLoad('loading')
    fetch(`/api/calendar?article=${encodeURIComponent(articleId)}`, { cache: 'no-store' })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return

        const content = data?.article?.content || ''

        setArticleContent(content)
        setArticleTitle(typeof data?.article?.title === 'string' ? data.article.title : '')
        setArticleLoad(!ok || !data?.article ? 'error' : content ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!active) return

        setArticleContent('')
        setArticleTitle('')
        setArticleLoad('error')
      })

    return () => {
      active = false
    }
  }, [values.articleId])

  useEffect(() => {
    if (calendarStore.selectedEvent !== null) resetToStoredValues()
    else resetToEmptyValues()
  }, [addEventSidebarOpen, resetToStoredValues, resetToEmptyValues, calendarStore.selectedEvent])

  return (
    <>
      <Drawer
        anchor='right'
        open={addEventSidebarOpen}
        onClose={handleSidebarClose}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { width: ['100%', 400] } }}
      >
        <Box className='flex justify-between items-center sidebar-header pli-5 plb-4 border-be'>
          <Typography variant='h5'>
            {calendarStore.selectedEvent?.id ? 'Update Publishing Slot' : 'Schedule Article'}
          </Typography>
          {calendarStore.selectedEvent?.id ? (
            <Box className='flex items-center' sx={{ gap: 1 }}>
              <IconButton size='small' onClick={handleDeleteButtonClick} disabled={deleting}>
                <i className='ri-delete-bin-7-line text-2xl' />
              </IconButton>
              <IconButton size='small' onClick={handleSidebarClose}>
                <i className='ri-close-line text-2xl' />
              </IconButton>
            </Box>
          ) : (
            <IconButton size='small' onClick={handleSidebarClose}>
              <i className='ri-close-line text-2xl' />
            </IconButton>
          )}
        </Box>
        <ScrollWrapper
          {...(isBelowSmScreen
            ? { className: 'bs-full overflow-y-auto overflow-x-hidden' }
            : { options: { wheelPropagation: false, suppressScrollX: true } })}
        >
          <Box className='sidebar-body p-5'>
            <form onSubmit={onSubmit} autoComplete='off'>
              <FormControl fullWidth className='mbe-5' error={articleError}>
                <InputLabel id='event-article'>Article title</InputLabel>
                <Select
                  label='Article title'
                  value={values.articleId}
                  labelId='event-article'
                  onChange={e => {
                    if (e.target.value === '__generate') {
                      goWriter()

                      return
                    }

                    setArticleError(false)
                    setValues({ ...values, articleId: e.target.value })
                  }}
                  renderValue={selectedId => {
                    const item = articleOptions.find(article => article.id === selectedId)
                    const title = item?.title || ''

                    if (!title) return 'Select an article'

                    return title.length > 80 ? `${title.slice(0, 80)}...` : title
                  }}
                >
                  <MenuItem value='' disabled>
                    Select an article
                  </MenuItem>
                  {articleOptions.map(article => (
                    <MenuItem key={article.id} value={article.id} sx={{ whiteSpace: 'normal' }}>
                      {article.title}
                    </MenuItem>
                  ))}
                  {showGenerate ? <MenuItem value='__generate'>+ generate article</MenuItem> : null}
                </Select>
                {articleError ? (
                  <Typography variant='caption' color='error' className='mts-1'>
                    Choose an article.
                  </Typography>
                ) : null}
                {values.articleId && articleLoad === 'loading' ? (
                  <Typography variant='caption' color='text.secondary' className='mts-1'>
                    Loading the full article…
                  </Typography>
                ) : null}
                {values.articleId && articleLoad === 'ready' ? (
                  <Typography variant='caption' color='text.secondary' className='mts-1'>
                    Full article loaded. The action below republishes this content.
                  </Typography>
                ) : null}
                {values.articleId && articleLoad === 'error' ? (
                  <Typography variant='caption' color='error' className='mts-1'>
                    Could not load the article body. The saved copy will be used and the post will not be blanked.
                  </Typography>
                ) : null}
                {calendarStore.selectedEvent?.url ? (
                  <Button
                    size='small'
                    variant='contained'
                    className='mts-2'
                    component='a'
                    href={calendarStore.selectedEvent.url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    Open article
                  </Button>
                ) : null}
              </FormControl>
              <FormControl fullWidth className='mbe-5' error={siteError || noSites}>
                <InputLabel id='event-wp-site'>WordPress site</InputLabel>
                <Select
                  label='WordPress site'
                  value={values.siteKey}
                  labelId='event-wp-site'
                  onChange={e => {
                    setSiteError(false)
                    setValues({ ...values, siteKey: e.target.value })
                  }}
                >
                  <MenuItem value='' disabled>
                    Select a site
                  </MenuItem>
                  {siteOptions.map(site => (
                    <MenuItem key={site.value} value={site.value}>
                      {site.label}
                    </MenuItem>
                  ))}
                  {values.siteKey && !siteOptions.some(site => site.value === values.siteKey) ? (
                    <MenuItem value={values.siteKey}>{values.siteKey}</MenuItem>
                  ) : null}
                </Select>
                {noSites ? (
                  <Typography variant='caption' color='error' className='mts-1'>
                    Add a WordPress site in the writer before scheduling.
                  </Typography>
                ) : null}
                {siteError ? (
                  <Typography variant='caption' color='error' className='mts-1'>
                    Choose the WordPress site this article belongs to.
                  </Typography>
                ) : null}
                {noSites ? (
                  <Button className='mts-2' variant='outlined' onClick={goWriter}>
                    Add a WordPress site
                  </Button>
                ) : null}
              </FormControl>
              <FormControl fullWidth className='mbe-5'>
                <InputLabel id='event-calendar'>Action Type</InputLabel>
                <Select
                  label='Action Type'
                  value={values.calendar}
                  labelId='event-calendar'
                  onChange={e => setValues({ ...values, calendar: e.target.value })}
                >
                  {ACTION_TYPES.map(name => (
                    <MenuItem key={name} value={name}>
                      {ACTION_LABELS[name]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {values.calendar === 'Scheduled' ? (
                <>
                  <div className='mbe-5'>
                    <AppReactDatepicker
                      id='event-publish-date'
                      selected={values.publishDate}
                      minDate={new Date()}
                      dateFormat='yyyy-MM-dd'
                      customInput={<PickersComponent label='Publish at' registername='publishDate' />}
                      onChange={date => date !== null && setValues({ ...values, publishDate: new Date(date) })}
                    />
                    {values.calendar === 'Scheduled' &&
                    (!combineLocalDateTime(values.publishDate, values.windowTime) ||
                      combineLocalDateTime(values.publishDate, values.windowTime).getTime() <=
                        Date.now() + 60 * 1000) ? (
                      <Typography variant='caption' color='error'>
                        Choose a time at least one minute in the future.
                      </Typography>
                    ) : null}
                  </div>
                  <div className='mbe-5'>
                    <AppReactDatepicker
                      id='event-window-ends'
                      selected={values.windowTime}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption='Time'
                      dateFormat='h:mm aa'
                      customInput={<PickersComponent label='Window ends' registername='windowTime' />}
                      onChange={date => date !== null && setValues({ ...values, windowTime: new Date(date) })}
                    />
                  </div>
                </>
              ) : null}
              {/*
              <TextField
                fullWidth
                type='url'
                id='event-url'
                className='mbe-5'
                label='Live or edit URL'
                value={values.url || ''}
                onChange={e => setValues({ ...values, url: e.target.value })}
              />
              <FormControl fullWidth className='mbe-5'>
                <InputLabel id='event-guests'>Publish to</InputLabel>
                <Select
                  multiple
                  label='Publish to'
                  value={values.guests || []}
                  labelId='event-guests'
                  id='event-guests-select'
                  onChange={e =>
                    setValues({
                      ...values,
                      guests: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                    })
                  }
                >
                  {SITE_OPTIONS.map(site => (
                    <MenuItem key={site} value={site}>
                      {site}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            */}
              <TextField
                rows={4}
                multiline
                fullWidth
                className='mbe-5'
                label='Notes'
                id='event-description'
                value={values.description}
                onChange={e => setValues({ ...values, description: e.target.value })}
              />
              <div className='flex items-center'>
                <RenderSidebarFooter />
              </div>
            </form>
          </Box>
        </ScrollWrapper>
      </Drawer>
      <Dialog open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)}>
        <DialogTitle>Delete this article forever?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This article will be deleted from the live site forever. It will be permanently removed from WordPress and
            cannot be restored.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color='secondary' onClick={() => setConfirmDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={confirmDeleteArticle} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete forever'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default AddEventSidebar

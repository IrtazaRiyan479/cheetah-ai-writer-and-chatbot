'use client'
import { useEffect, useRef } from 'react'

// Third-party imports
import { useDispatch, useSelector } from 'react-redux'
import classNames from 'classnames'

// MUI Imports (ADDED THIS to detect mobile screens)
import useMediaQuery from '@mui/material/useMediaQuery'

// Component Imports
import TaskCard from './TaskCard'
import SendMsgForm from '@views/apps/chat/SendMsgForm'

// Util Imports
import { commonLayoutClasses } from '@layouts/utils/layoutClasses'

const ImageGeneratorBoard = () => {
  const kanbanStore = useSelector(state => state.kanbanReducer)
  const dispatch = useDispatch()

  const feedRef = useRef(null)
  const feedTasks = kanbanStore.tasks

  // ADDED THIS: Get the screen size just like ChatWrapper does
  const isBelowSmScreen = useMediaQuery(theme => theme.breakpoints.down('sm'))

  // Auto-scroll horizontally to the right when a new image is added
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollLeft = feedRef.current.scrollWidth
    }
  }, [feedTasks.length])

  return (
    <div
      className={classNames(
        commonLayoutClasses.contentHeightFixed,
        'flex flex-col is-full bs-full overflow-hidden relative bg-transparent'
      )}
    >
      {/* 1. Horizontal Scroll Area */}
      <div
        ref={feedRef}
        className='flex-grow flex gap-6 p-6 overflow-x-auto scroll-smooth items-start [&::-webkit-scrollbar]:hidden'
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {feedTasks.length > 0 ? (
          feedTasks.map((task, index) => (
            <TaskCard key={task.id} task={task} index={index} />
          ))
        ) : (
          <div className='flex items-center justify-center w-full h-full text-textDisabled min-h-[400px]'>
            Start by typing a prompt below...
          </div>
        )}
      </div>

      {/* 2. The Unaltered Form Area */}
      {/* Removed the 'p-6' padding so it stretches full width like in Chat */}
      <div className='mt-auto shrink-0 w-full'>
        <SendMsgForm
          dispatch={dispatch}
          activeUser={{ id: 'ai-generator' }}
          // PASSED THE PROP HERE so the form knows to shrink the send button on mobile!
          isBelowSmScreen={isBelowSmScreen}
        />
      </div>
    </div>
  )
}

export default ImageGeneratorBoard

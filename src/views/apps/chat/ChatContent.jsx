// React Imports
import { useEffect, useState } from 'react'

// MUI Imports (Keep any you still need, remove unused ones)
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CardContent from '@mui/material/CardContent'

// Component Imports
import ChatLog from './ChatLog'
import SendMsgForm from './SendMsgForm'

const ChatContent = props => {
  // Props
  const {
    chatStore,
    dispatch,
    isBelowMdScreen,
    isBelowLgScreen,
    isBelowSmScreen,
    messageInputRef
  } = props

  // 1. CREATE A MOCK AI USER
  // This replaces the need to select a user from the sidebar.
  // SendMsgForm needs an ID to function properly.
  const aiUser = {
    id: 'ai-assistant',
    fullName: 'AI Assistant',
    role: 'Bot'
  }

  // 2. REMOVE THE activeUser CONDITION
  // We return the chat interface unconditionally so it always shows up.
  return (
    <>
      <div className='flex flex-col flex-grow is-full overflow-hidden'>

        <ChatLog
          chatStore={chatStore}
          isBelowMdScreen={isBelowMdScreen}
          isBelowSmScreen={isBelowSmScreen}
          isBelowLgScreen={isBelowLgScreen}
        />

        <SendMsgForm
          dispatch={dispatch}
          activeUser={aiUser} /* Pass our mock user here so the form doesn't crash */
          isBelowSmScreen={isBelowSmScreen}
          messageInputRef={messageInputRef}
        />

      </div>
    </>
  )
}

export default ChatContent

// React Imports
import { useRef, useEffect } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'

// Third-party Imports
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'
import ReactMarkdown from 'react-markdown'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Formats the chat data into a structured format for display.
const formatedChatData = (chats, profileUserId) => {
  const formattedChatData = []
  if (!chats || chats.length === 0) return formattedChatData

  let chatMessageSenderId = chats[0].senderId
  let msgGroup = { senderId: chatMessageSenderId, messages: [] }

  chats.forEach((chat, index) => {
    if (chatMessageSenderId === chat.senderId) {
      msgGroup.messages.push({ time: chat.time, message: chat.message })
    } else {
      chatMessageSenderId = chat.senderId
      formattedChatData.push(msgGroup)
      msgGroup = {
        senderId: chat.senderId,
        messages: [{ time: chat.time, message: chat.message }]
      }
    }
    if (index === chats.length - 1) formattedChatData.push(msgGroup)
  })

  return formattedChatData
}

const ChatLog = ({ messages, isBelowMdScreen, isBelowSmScreen, isBelowLgScreen }) => {
  const PROFILE_USER_ID = 'user'
  const AI_USER_ID = 'ai-assistant'

  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const formattedChats = formatedChatData(messages, PROFILE_USER_ID)
  const ScrollWrapper = isBelowLgScreen ? 'div' : PerfectScrollbar

  return (
    <ScrollWrapper
      ref={scrollRef}
      className='bs-full overflow-y-auto overflow-x-hidden bg-[var(--mui-palette-customColors-chatBg)]'
      options={{ wheelPropagation: false }}
    >
      <CardContent className='p-0'>
        {formattedChats.map((msgGroup, index) => {
          const isSender = msgGroup.senderId === PROFILE_USER_ID

          return (
            <div
              key={index}
              className={classnames('flex p-5 gap-4', {
                'flex-row-reverse': isSender,
                'mt-2': index !== 0
              })}
            >
              {/* Avatar */}
              <CustomAvatar
                skin='light'
                color={isSender ? 'primary' : 'secondary'}
                className='bs-8 is-8'
              >
                {isSender ? <i className='ri-user-line' /> : <i className='ri-robot-2-line' />}
              </CustomAvatar>

              {/* Message Bubbles */}
              <div
                className={classnames('flex flex-col gap-2', {
                  'items-end': isSender,
                  'items-start': !isSender
                })}
              >
                {msgGroup.messages.map((msg, msgIndex) => (
                  <div
                    key={msgIndex}
                    className={classnames('p-3 rounded-md max-w-[85%] sm:max-w-[75%]', {
                      'bg-primary text-white rounded-tr-none shadow-primary/30': isSender,
                      'bg-backgroundPaper text-textPrimary rounded-tl-none shadow-sm': !isSender
                    })}
                  >
        {/* MARKDOWN FOR AI, PLAIN TEXT FOR USER */}
                    {!isSender ? (
                      <div className="markdown-chat-content text-inherit">
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <Typography color="inherit" className='mb-2 leading-relaxed' {...props} />,
                            h1: ({ node, ...props }) => <Typography variant='h5' color="inherit" className='mt-4 mb-2 font-bold' {...props} />,
                            h2: ({ node, ...props }) => <Typography variant='h6' color="inherit" className='mt-3 mb-2 font-bold' {...props} />,
                            h3: ({ node, ...props }) => <Typography variant='subtitle1' color="inherit" className='mt-2 mb-1 font-bold' {...props} />,
                            strong: ({ node, ...props }) => <span className='font-bold' {...props} />,
                            ul: ({ node, ...props }) => <ul className='list-disc pl-5 mb-2 space-y-1' {...props} />,
                            ol: ({ node, ...props }) => <ol className='list-decimal pl-5 mb-2 space-y-1' {...props} />,
                            li: ({ node, ...props }) => <li className='text-sm' {...props} />,
                            code: ({ node, inline, ...props }) =>
                              inline
                                ? <code className='bg-black/10 px-1 py-0.5 rounded text-sm font-mono' {...props} />
                                : <pre className='bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto mb-2 text-sm font-mono'><code {...props} /></pre>
                          }}
                        >
                          {msg.message}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <Typography color='inherit'>{msg.message}</Typography>
                    )}
                  </div>
                ))}

                {/* Time Stamp */}
                <div className={classnames('flex items-center gap-2', {
                    'justify-end': isSender
                  })}
                >
                  <Typography variant='caption' color='text.disabled'>
                    {new Date(msgGroup.messages[msgGroup.messages.length - 1].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </ScrollWrapper>
  )
}

export default ChatLog

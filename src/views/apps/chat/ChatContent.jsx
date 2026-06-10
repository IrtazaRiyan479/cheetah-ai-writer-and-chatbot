'use client'
// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

// Component Imports
import ChatLog from './ChatLog'
import SendMsgForm from './SendMsgForm'
import CustomAvatar from '@core/components/mui/Avatar'

const ChatContent = props => {
  const { isBelowMdScreen, isBelowLgScreen, isBelowSmScreen, messageInputRef } = props

  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState([])

  // 1. Fetch Chat History on Load
  useEffect(() => {
    const fetchChat = async () => {
      const res = await fetch('/api/chat')
      const data = await res.json()

      if (data.length > 0) {
        setMessages(data)
      } else {
        setMessages([{ senderId: 'ai-assistant', message: 'Hello! I am Cheetah AI. What would you like to create today?', time: new Date().toISOString() }])
      }
    }
    fetchChat()
  }, [])

  // 2. Reset Chat Logic
  const handleResetChat = async () => {
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([{ senderId: 'ai-assistant', message: 'Chat history cleared. How can I help you?', time: new Date().toISOString() }])
  }

  // 3. Send Message Logic
  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isTyping) return

    const userMsg = { senderId: 'user', message: userText, time: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      // Save User Message to DB
      await fetch('/api/chat', { method: 'POST', body: JSON.stringify(userMsg) })

      // Call Gemini API
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, history: messages })
      })

      const data = await res.json()

      if (data.success) {
        const aiMsg = { senderId: 'ai-assistant', message: data.text, time: new Date().toISOString() }
        setMessages(prev => [...prev, aiMsg])

        // Save AI Message to DB
        await fetch('/api/chat', { method: 'POST', body: JSON.stringify(aiMsg) })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setMessages(prev => [...prev, { senderId: 'ai-assistant', message: '**Error:** Failed to connect.', time: new Date().toISOString() }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className='flex flex-col flex-grow is-full overflow-hidden'>
      {/* NEW: Chat Header with Reset Button */}
      <div className='flex items-center justify-between border-b p-5 border-divider'>
        <div className='flex items-center gap-4'>
          <CustomAvatar skin='light' color='primary' className='bs-10 is-10'>
            <i className='ri-robot-2-line text-xl' />
          </CustomAvatar>
          <div>
            <Typography variant='h6'>Cheetah AI</Typography>
            <Typography variant='body2'>Online</Typography>
          </div>
        </div>
        <Button
          color='error'
          variant='outlined'
          size='small'
          startIcon={<i className='ri-delete-bin-7-line' />}
          onClick={handleResetChat}
          disabled={isTyping}
        >
          Reset Chat
        </Button>
      </div>

      <ChatLog
        messages={messages}
        isBelowMdScreen={isBelowMdScreen}
        isBelowSmScreen={isBelowSmScreen}
        isBelowLgScreen={isBelowLgScreen}
      />

      <SendMsgForm
        handleSendMessage={handleSendMessage}
        isTyping={isTyping}
        isBelowSmScreen={isBelowSmScreen}
        messageInputRef={messageInputRef}
      />
    </div>
  )
}

export default ChatContent

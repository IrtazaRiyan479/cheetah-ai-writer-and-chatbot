'use client'
// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'

// Component Imports
import ChatLog from './ChatLog'
import SendMsgForm from './SendMsgForm'
import CustomAvatar from '@core/components/mui/Avatar'
import { featureKeyForModel } from '@/libs/entitlement'
import { ProLabel, useFeatureAccess } from '@views/apps/writer/FeatureAccessContext'

const DEFAULT_CHAT_MODEL = 'gemini-3.1-flash-lite'

const availableModels = [
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 3.5 Flash', value: 'gemini-3.5-flash' },
  { label: 'Gemini 3.1 Pro', value: 'gemini-3.1-pro-preview-customtools' },
  { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  { label: 'Claude Haiku 5.5', value: 'claude-haiku-5-5' },
  { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
  { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
  { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
  { label: 'Claude Sonnet 5.5', value: 'claude-sonnet-5-5' },
  { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
  { label: 'Claude Opus 5.5', value: 'claude-opus-5-5' },
  { label: 'GPT-5.2', value: 'gpt-5.2' },
  { label: 'GPT-5 Mini', value: 'gpt-5-mini' },
  { label: 'Grok 4.7', value: 'grok-4.7' }
]

const ChatContent = props => {
  const { isBelowMdScreen, isBelowLgScreen, isBelowSmScreen, messageInputRef } = props
  const { requireFeature, modeOf, featureModes } = useFeatureAccess()

  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState([])
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL)

  const models = availableModels.filter(item => modeOf(featureKeyForModel(item.value)) !== 'off')
  const selectedModel = models.some(item => item.value === model) ? model : models[0]?.value || DEFAULT_CHAT_MODEL

  useEffect(() => {
    const fetchChat = async () => {
      const res = await fetch('/api/chat')
      const data = await res.json()

      if (data.length > 0) {
        setMessages(data)
      } else {
        setMessages([{ senderId: 'ai-assistant', message: 'Hello! I am AffiGenie. What would you like to create today?', time: new Date().toISOString() }])
      }
    }
    fetchChat()
  }, [])

  useEffect(() => {
    const allowed = availableModels.filter(item => modeOf(featureKeyForModel(item.value)) !== 'off')

    if (!allowed.length || allowed.some(item => item.value === model)) return

    const fallback = allowed.some(item => item.value === DEFAULT_CHAT_MODEL) ? DEFAULT_CHAT_MODEL : allowed[0].value

    setModel(fallback)
  }, [featureModes, modeOf, model])

  const handleModelChange = event => {
    const next = event.target.value

    if (!requireFeature(featureKeyForModel(next))) return

    setModel(next)
  }

  const handleResetChat = async () => {
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([{ senderId: 'ai-assistant', message: 'Chat history cleared. How can I help you?', time: new Date().toISOString() }])
  }

  const handleSendMessage = async (userText) => {
    if (!userText.trim() || isTyping) return

    const userMsg = { senderId: 'user', message: userText, time: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const saveUserMessage = fetch('/api/chat', { method: 'POST', body: JSON.stringify(userMsg) })

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          history: messages.slice(-6),
          model: selectedModel,
          settings: { model: selectedModel }
        })
      })

      await saveUserMessage.catch(() => {})

      const data = await res.json().catch(() => ({}))

      if (data.success) {
        const aiMsg = { senderId: 'ai-assistant', message: data.text, time: new Date().toISOString() }
        setMessages(prev => [...prev, aiMsg])

        await fetch('/api/chat', { method: 'POST', body: JSON.stringify(aiMsg) })
      } else {
        throw new Error(data.error || 'Failed to connect.')
      }
    } catch (error) {
      const raw = String(error?.message || 'Failed to connect.').replace(/\s+/g, ' ').trim()
      const detail = raw.length > 280 ? `${raw.slice(0, 280)}…` : raw

      setMessages(prev => [...prev, { senderId: 'ai-assistant', message: `**Error:** ${detail}`, time: new Date().toISOString() }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className='flex flex-col flex-grow is-full overflow-hidden'>
      <div className='flex items-center justify-between border-b p-5 border-divider gap-3 flex-wrap'>
        <div className='flex items-center gap-4'>
          <CustomAvatar skin='light' color='primary' className='bs-10 is-10'>
            <i className='ri-robot-2-line text-xl' />
          </CustomAvatar>
          <div>
            <Typography variant='h6'>AffiGenie</Typography>
            <Typography variant='body2'>Online</Typography>
          </div>
        </div>
        <div className='flex items-center gap-3 flex-wrap justify-end'>
          <FormControl size='small' sx={{ minWidth: 200, maxWidth: 280 }}>
            <Select value={selectedModel} onChange={handleModelChange} inputProps={{ 'aria-label': 'Chat model' }}>
              {models.map(item => (
                <MenuItem key={item.value} value={item.value}>
                  <ProLabel featureKey={featureKeyForModel(item.value)}>{item.label}</ProLabel>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

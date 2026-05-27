// React Imports
import { useState } from 'react'

// MUI Imports
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'

// Component Imports
import CustomIconButton from '@core/components/mui/IconButton'

const SendMsgForm = ({ handleSendMessage, isTyping, isBelowSmScreen, messageInputRef }) => {
  const [msg, setMsg] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    if (msg.trim() && !isTyping) {
      handleSendMessage(msg)
      setMsg('')
    }
  }

  return (
    <form
      autoComplete='off'
      onSubmit={onSubmit}
      className='bg-[var(--mui-palette-customColors-chatBg)] p-4 border-t border-divider flex gap-4 items-end'
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder='Message Cheetah AI...'
        value={msg}
        onChange={e => setMsg(e.target.value)}
        sx={{
          '& fieldset': { border: '0' },
          '& .MuiOutlinedInput-root': {
            background: 'var(--mui-palette-background-paper)',
            borderRadius: 'var(--mui-shape-customBorderRadius-lg)',
            boxShadow: 'var(--mui-customShadows-xs)'
          }
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit(e)
          }
        }}
        size='small'
        inputRef={messageInputRef}
      />

      <div className='flex items-center gap-2'>
        {/* Restored UI Options */}
        <IconButton size='small' className='text-textPrimary'>
          <i className='ri-mic-line' />
        </IconButton>
        <IconButton size='small' component='label' htmlFor='upload-img' className='text-textPrimary'>
          <i className='ri-attachment-line' />
          <input hidden type='file' id='upload-img' />
        </IconButton>

        {isBelowSmScreen ? (
          <CustomIconButton variant='contained' color='primary' type='submit' disabled={isTyping || !msg.trim()}>
             {isTyping ? <CircularProgress size={20} color="inherit" /> : <i className='ri-send-plane-line' />}
          </CustomIconButton>
        ) : (
          <Button
            variant='contained'
            color='primary'
            type='submit'
            disabled={isTyping || !msg.trim()}
            endIcon={isTyping ? <CircularProgress size={20} color="inherit" /> : <i className='ri-send-plane-line' />}
          >
            {isTyping ? 'Thinking...' : 'Send'}
          </Button>
        )}
      </div>
    </form>
  )
}

export default SendMsgForm

'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CodeIcon from '@mui/icons-material/Code'
import WebIcon from '@mui/icons-material/Web'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ReactMarkdown from 'react-markdown'

import { evaluateFormula, isGenericCalculator, stepsFor } from '@/utils/magnetTool'

const MAGNET_MODELS = [
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

const DEFAULT_MAGNET_MODEL = 'gemini-3.5-flash'
const PROMPT_PLACEHOLDER =
  'e.g. A quiz that recommends a laptop from budget and daily use, a week-by-week moving checklist, or a comparison of two products'

function unwrapFence(value) {
  const trimmed = String(value || '').trim()
  const full = trimmed.match(/^```(?:html|xml|svg|markdown|md)?\s*([\s\S]*?)```$/i)

  return full ? full[1].trim() : trimmed
}

function looksLikeHtml(value) {
  const tags = String(value || '').match(/<\/?[a-z][\w:-]*(\s[^>]*)?>/gi) || []

  if (tags.length < 2) return false

  return /<(?:!doctype|html|body|div|section|article|main|table|thead|tbody|tr|td|figure|img|svg|ul|ol|li|style|form|canvas|h[1-6]|p|a|button|span)\b/i.test(value)
}

function splitDeliverable(raw) {
  const text = unwrapFence(raw)
  const start = text.search(/<(?:!doctype|html|head|body|div|section|article|main|table|figure|ul|ol|svg|style|img|form|canvas)\b/i)

  if (start < 0 || !looksLikeHtml(text.slice(start))) return { markdown: text, html: '' }

  return { markdown: text.slice(0, start).trim(), html: text.slice(start).trim() }
}

function documentFor(html) {
  if (/<(?:!doctype|html)\b/i.test(html)) return html

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:8px;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:transparent;color:#1c1c1c;}img,video,svg{max-width:100%;height:auto;}*{box-sizing:border-box;}a{color:#5b4dff;}</style></head><body>${html}</body></html>`
}

function HtmlFrame({ html }) {
  return (
    <iframe
      title='Tool result'
      sandbox='allow-same-origin'
      srcDoc={documentFor(html)}
      onLoad={event => {
        const frame = event.currentTarget
        const height = frame.contentDocument?.documentElement?.scrollHeight || 360

        frame.style.height = `${Math.min(Math.max(height + 12, 180), 4000)}px`
      }}
      style={{ width: '100%', border: 0, minHeight: 180, background: 'transparent', display: 'block' }}
    />
  )
}

function MarkdownBlock({ value }) {
  if (!String(value || '').trim()) return null

  return (
    <Box className='prose dark:prose-invert max-w-none text-textPrimary leading-relaxed space-y-4'>
      <ReactMarkdown
        components={{
          h2: ({ node, ...props }) => (
            <Typography variant='h5' className='font-bold pt-4 border-b border-divider pb-2 text-textPrimary' {...props} />
          ),
          h3: ({ node, ...props }) => (
            <Typography variant='h6' className='font-bold pt-2 border-b border-divider pb-1 text-textPrimary' {...props} />
          ),
          p: ({ node, ...props }) => <Typography variant='body1' className='text-textSecondary text-[15px] mb-4' {...props} />,
          strong: ({ node, ...props }) => <Box component='span' sx={{ fontWeight: 'bold', color: 'text.primary' }} {...props} />,
          ul: ({ node, ...props }) => <Box component='ul' className='list-disc pl-5 mb-4' {...props} />,
          li: ({ node, ...props }) => <Typography component='li' variant='body1' className='text-textSecondary text-[15px]' {...props} />
        }}
      >
        {value}
      </ReactMarkdown>
    </Box>
  )
}

function ResultView({ value, output }) {
  const parts = splitDeliverable(value)
  const html = parts.html || (output === 'html' && looksLikeHtml(unwrapFence(value)) ? unwrapFence(value) : '')
  const markdown = html && parts.html ? parts.markdown : html ? '' : unwrapFence(value)

  return (
    <Box className='flex flex-col gap-4'>
      <MarkdownBlock value={markdown} />
      {html ? <HtmlFrame html={html} /> : null}
    </Box>
  )
}

const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷' }

function formatCalc(value) {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10
  const text = String(rounded)

  return text.length > 12 ? rounded.toExponential(6) : text
}

function compute(left, right, op) {
  if (op === '+') return left + right
  if (op === '-') return left - right
  if (op === '*') return left * right
  if (op === '/') return right === 0 ? NaN : left / right

  return right
}

function ArithmeticCalculator({ magnet }) {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [op, setOp] = useState(null)
  const [fresh, setFresh] = useState(true)

  const inputDigit = digit => {
    setDisplay(prev => {
      if (fresh || prev === '0' || prev === 'Error') return String(digit)
      if (prev.replace('-', '').replace('.', '').length >= 12) return prev

      return prev + digit
    })
    setFresh(false)
  }

  const inputDot = () => {
    setDisplay(prev => {
      if (fresh || prev === 'Error') return '0.'
      if (prev.includes('.')) return prev

      return `${prev}.`
    })
    setFresh(false)
  }

  const clearAll = () => {
    setDisplay('0')
    setStored(null)
    setOp(null)
    setFresh(true)
  }

  const chooseOp = next => {
    const value = Number(display)

    if (!Number.isFinite(value)) {
      clearAll()

      return
    }

    if (op && stored != null && !fresh) {
      const result = compute(stored, value, op)
      const text = formatCalc(result)

      setDisplay(text)
      setStored(Number.isFinite(result) ? result : null)
      setOp(Number.isFinite(result) ? next : null)
    } else {
      setStored(value)
      setOp(next)
    }

    setFresh(true)
  }

  const equals = () => {
    if (!op || stored == null) return
    const result = compute(stored, Number(display), op)

    setDisplay(formatCalc(result))
    setStored(null)
    setOp(null)
    setFresh(true)
  }

  const percent = () => {
    const value = Number(display)

    if (!Number.isFinite(value)) return
    setDisplay(formatCalc(value / 100))
    setFresh(true)
  }

  const negate = () => {
    const value = Number(display)

    if (!Number.isFinite(value) || value === 0) return
    setDisplay(formatCalc(-value))
  }

  const backspace = () => {
    if (fresh || display === 'Error') return
    const next = display.length <= 1 || (display.startsWith('-') && display.length <= 2) ? '0' : display.slice(0, -1)

    setDisplay(next)
    if (next === '0') setFresh(true)
  }

  const onKeyDown = event => {
    if (event.target?.closest?.('button') && (event.key === 'Enter' || event.key === ' ')) return
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault()
      inputDigit(event.key)

      return
    }

    if (event.key === '.') {
      event.preventDefault()
      inputDot()

      return
    }

    if (event.key === 'Enter' || event.key === '=') {
      event.preventDefault()
      equals()

      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      clearAll()

      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      backspace()

      return
    }

    if (event.key === '+' || event.key === '-' || event.key === '*' || event.key === '/') {
      event.preventDefault()
      chooseOp(event.key)

      return
    }

    if (event.key === '%') {
      event.preventDefault()
      percent()
    }
  }

  const press = key => {
    if (key === 'AC') return clearAll()
    if (key === '±') return negate()
    if (key === '%') return percent()
    if (key === '=') return equals()
    if (key === '.') return inputDot()
    if (key === '+' || key === '-' || key === '*' || key === '/') return chooseOp(key)

    return inputDigit(key)
  }

  const rows = [
    ['AC', '±', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '=']
  ]

  return (
    <Box className='flex flex-col gap-3' sx={{ width: '100%', maxWidth: 360, mx: 'auto' }} tabIndex={0} onKeyDown={onKeyDown}>
      <Box className='text-center'>
        <Typography variant='h5' className='font-extrabold' color='text.primary'>
          {magnet.title}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {magnet.description}
        </Typography>
      </Box>
      <Paper variant='outlined' sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Typography variant='caption' color='text.secondary' sx={{ minHeight: 18, display: 'block', textAlign: 'right' }}>
          {op ? OP_LABEL[op] : ''}
        </Typography>
        <Typography variant='h3' sx={{ fontFamily: 'ui-monospace, monospace', textAlign: 'right', wordBreak: 'break-all' }}>
          {display}
        </Typography>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {rows.flat().map(key => (
          <Button
            key={key}
            variant={key === '=' || key === '+' || key === '-' || key === '*' || key === '/' ? 'contained' : 'outlined'}
            color='primary'
            onClick={() => press(key)}
            sx={{ minHeight: 52, fontSize: 18, fontWeight: 700, gridColumn: key === '0' ? 'span 2' : undefined }}
            aria-label={OP_LABEL[key] || key}
          >
            {OP_LABEL[key] || key}
          </Button>
        ))}
      </Box>
    </Box>
  )
}

function ToolFields({ inputs, values, onChange, disabled }) {
  return inputs.map(input => (
    <Box key={input.id}>
      <Typography variant='subtitle2' color='text.primary' className='font-bold mb-1 block'>
        {input.label}
      </Typography>
      {input.type === 'select' && input.options?.length ? (
        <TextField
          select
          fullWidth
          size='small'
          value={values[input.id] || ''}
          disabled={disabled}
          onChange={event => onChange({ ...values, [input.id]: event.target.value })}
        >
          {input.options.map(option => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          fullWidth
          size='small'
          type={input.type === 'number' ? 'number' : 'text'}
          multiline={input.type === 'textarea'}
          rows={input.type === 'textarea' ? 3 : 1}
          placeholder={input.placeholder}
          value={values[input.id] || ''}
          disabled={disabled}
          onChange={event => onChange({ ...values, [input.id]: event.target.value })}
          InputProps={
            input.suffix
              ? { endAdornment: <InputAdornment position='end'>{input.suffix}</InputAdornment> }
              : undefined
          }
        />
      )}
    </Box>
  ))
}

function FormulaTool({ magnet }) {
  const [values, setValues] = useState({})
  const ready = magnet.inputs.every(input => String(values[input.id] ?? '').trim() !== '')
  const scope = ready ? Object.fromEntries(magnet.inputs.map(input => [input.id, Number(values[input.id])])) : null
  const result = scope && Object.values(scope).every(Number.isFinite) ? evaluateFormula(magnet.formula, scope) : null
  const places = magnet.decimals ?? 2
  const shown =
    result == null
      ? '—'
      : `${magnet.resultPrefix || ''}${result.toLocaleString(undefined, {
          maximumFractionDigits: places,
          minimumFractionDigits: 0
        })}${magnet.resultSuffix || ''}`

  return (
    <Box className='flex flex-col gap-4' sx={{ width: '100%' }}>
      <Box className='text-center'>
        <Typography variant='h5' color='text.primary' className='font-extrabold mb-2'>
          {magnet.title}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {magnet.description}
        </Typography>
      </Box>
      <Divider />
      <ToolFields inputs={magnet.inputs} values={values} onChange={setValues} />
      <Paper variant='outlined' sx={{ p: 2.5, textAlign: 'center' }}>
        <Typography variant='caption' color='text.secondary'>
          {magnet.resultLabel || 'Result'}
        </Typography>
        <Typography variant='h4' className='font-bold' color='text.primary'>
          {shown}
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
          {(magnet.formula || '').replaceAll('*', ' × ').replaceAll('/', ' ÷ ')}
        </Typography>
      </Paper>
    </Box>
  )
}

function stepMark(step, phase) {
  if (phase === 'ready' || phase === 'error') return phase === 'ready' ? 'Done' : 'Stopped'
  if (phase === 'planning') return 'Waiting'
  if (step.id === 'inputs') return phase === 'inputs' ? 'In progress' : 'Done'
  if (step.id === 'logic') return phase === 'logic' ? 'In progress' : 'Waiting'
  if (step.id === 'local') return 'In progress'

  return 'Waiting'
}

const MagnetsPage = () => {
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState('idle')
  const [statusText, setStatusText] = useState('')
  const [plan, setPlan] = useState(null)
  const [draft, setDraft] = useState(null)
  const [generatedMagnet, setGeneratedMagnet] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [magnetValues, setMagnetValues] = useState({})
  const [isExecuting, setIsExecuting] = useState(false)
  const [magnetResult, setMagnetResult] = useState(null)
  const [embedOpen, setEmbedOpen] = useState(false)
  const [model, setModel] = useState(DEFAULT_MAGNET_MODEL)

  const working = phase === 'planning' || phase === 'inputs' || phase === 'logic'

  const readApiJson = async res => {
    const raw = await res.text()

    try {
      return raw ? JSON.parse(raw) : {}
    } catch {
      const looksHtml = /^\s*</.test(raw)

      return {
        success: false,
        error: looksHtml
          ? `The magnets API returned a web page instead of JSON (HTTP ${res.status}). The request never reached a model.`
          : `The magnets API returned an unreadable response (HTTP ${res.status}).`
      }
    }
  }

  const postMagnet = async body => {
    const res = await fetch('/api/magnets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await readApiJson(res)

    if (!res.ok || data.success === false) {
      throw new Error(data.error || `The magnets API failed (HTTP ${res.status}).`)
    }

    return data
  }

  const handleCreateMagnet = async () => {
    const trimmed = prompt.trim()

    if (!trimmed) return

    setPhase('planning')
    setStatusText(`Reading “${trimmed}”.`)
    setPlan(null)
    setDraft(null)
    setGeneratedMagnet(null)
    setMagnetResult(null)
    setMagnetValues({})
    setErrorMessage('')

    if (isGenericCalculator(trimmed)) {
      setPlan({
        title: 'Calculator',
        description: 'A general-purpose calculator for everyday arithmetic.',
        summary: 'A general-purpose calculator. This was not turned into a niche tool.',
        kind: 'arithmetic',
        steps: stepsFor('arithmetic')
      })
      setGeneratedMagnet({
        mode: 'arithmetic',
        title: 'Calculator',
        description: 'A general-purpose calculator for everyday arithmetic.'
      })
      setStatusText('Built a general-purpose calculator locally. No model request was sent.')
      setPhase('ready')

      return
    }

    try {
      setStatusText('Sending the planning request…')
      const planned = await postMagnet({ action: 'plan', prompt: trimmed, model })

      if (planned.instant && planned.magnetConfig) {
        setPlan(planned.plan)
        setGeneratedMagnet(planned.magnetConfig)
        setStatusText('Built a general-purpose calculator locally. No model request was sent.')
        setPhase('ready')

        return
      }

      const nextPlan = planned.plan

      setPlan(nextPlan)
      setPhase('inputs')
      setStatusText(`Plan: ${nextPlan.summary} Sending the request that chooses the inputs…`)
      const inputsResponse = await postMagnet({ action: 'build', step: 'inputs', prompt: trimmed, plan: nextPlan, model })

      setDraft(inputsResponse.draft)
      setPhase('logic')
      setStatusText(
        nextPlan.kind === 'formula'
          ? 'Inputs are ready. Sending the request that writes the calculation…'
          : 'Questions are ready. Sending the request that writes the result instructions…'
      )
      const built = await postMagnet({
        action: 'build',
        step: 'logic',
        prompt: trimmed,
        plan: nextPlan,
        draft: inputsResponse.draft,
        model
      })

      setGeneratedMagnet(built.magnetConfig)
      setDraft(null)
      setStatusText('Preview ready.')
      setPhase('ready')
    } catch (error) {
      console.error(error)
      const message = error?.message || 'The browser could not reach the magnets API.'

      setErrorMessage(message)
      setStatusText(message)
      setPhase('error')
    }
  }

  const handleRunMagnet = async () => {
    setIsExecuting(true)
    setMagnetResult(null)
    setErrorMessage('')

    try {
      const data = await postMagnet({
        action: 'execute',
        aiInstructions: generatedMagnet.aiInstructions,
        output: generatedMagnet.output,
        userInputs: magnetValues,
        model
      })

      if (data.result) setMagnetResult(data.result)
      else setErrorMessage('The tool did not return a result.')
    } catch (error) {
      console.error(error)
      setErrorMessage(error?.message || 'The browser could not reach the magnets API.')
    } finally {
      setIsExecuting(false)
    }
  }

  const handleCopyResult = () => {
    if (magnetResult) {
      navigator.clipboard.writeText(magnetResult)
      alert('Result copied to clipboard!')
    }
  }

  const handleCopyEmbed = () => {
    const embedStr = `<iframe src="https://yourdomain.com/embed/magnet-id" width="100%" height="600" style="border:none;"></iframe>`

    navigator.clipboard.writeText(embedStr)
    alert('Embed code copied to clipboard!')
    setEmbedOpen(false)
  }

  const previewTitle = generatedMagnet?.title || plan?.title || 'Building your tool'

  return (
    <Box className='flex flex-col gap-6'>
      <Card variant='outlined' className='border-divider shadow-sm rounded-xl overflow-hidden bg-backgroundPaper'>
        <Box
          className='p-6 border-b border-divider bg-actionHover/30'
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap' }}
        >
          <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
            <Typography variant='h5' className='font-bold text-textPrimary tracking-tight flex items-center gap-2'>
              <AutoAwesomeIcon color='primary' fontSize='large' /> AffiGenieMagnets
            </Typography>
            <Typography variant='body2' className='text-textSecondary mt-1.5 max-w-3xl leading-relaxed'>
              Describe any interactive tool. Quizzes, calculators, checklists, comparisons, planners, generators, and layouts all use the same builder. The preview opens while it is built so you can test the result.
            </Typography>
          </Box>
          <FormControl size='small' sx={{ minWidth: 220, flex: '0 1 260px' }}>
            <Typography variant='caption' color='text.secondary' className='font-bold uppercase tracking-wider mb-1'>
              Model
            </Typography>
            <Select value={model} onChange={event => setModel(event.target.value)} disabled={working}>
              {MAGNET_MODELS.map(item => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <CardContent className='p-6'>
          <Typography variant='subtitle2' color='text.secondary' className='font-bold uppercase tracking-wider mb-4'>
            What do you want to build?
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder={PROMPT_PLACEHOLDER}
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            disabled={working}
            variant='outlined'
            sx={{ bgcolor: 'action.hover' }}
          />
          <Box className='flex justify-start pt-4'>
            <Button
              variant='contained'
              color='primary'
              size='large'
              onClick={handleCreateMagnet}
              disabled={!prompt.trim() || working}
              startIcon={working ? <CircularProgress size={20} color='inherit' /> : <AutoAwesomeIcon />}
              className='font-bold px-6 py-2.5'
            >
              {phase === 'planning' ? 'Planning the tool…' : working ? 'Building the tool…' : 'Create AffiGenieMagnet'}
            </Button>
          </Box>
          {errorMessage ? (
            <Alert severity='error' sx={{ mt: 3, whiteSpace: 'pre-wrap', alignItems: 'flex-start' }}>
              {errorMessage}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {phase !== 'idle' ? (
        <Card sx={{ boxShadow: 3, overflow: 'hidden' }}>
          <Box
            sx={{
              px: 3,
              py: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              gap: 2
            }}
          >
            <Typography variant='h6' className='font-bold flex items-center gap-2' color='text.primary'>
              <WebIcon color='primary' /> Live Preview: Test Your Tool
            </Typography>
            <Button variant='outlined' size='small' startIcon={<CodeIcon />} onClick={() => setEmbedOpen(true)} disabled={!generatedMagnet}>
              Embed Code
            </Button>
          </Box>
          <CardContent
            sx={{
              p: { xs: 3, md: 6 },
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Paper
              elevation={4}
              sx={{
                p: { xs: 3, md: 4 },
                maxWidth: generatedMagnet?.mode === 'assistant' ? 920 : 650,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                borderRadius: 3
              }}
            >
              {phase !== 'ready' ? (
                <Box className='flex flex-col gap-2' aria-live='polite'>
                  <Typography variant='h5' className='font-extrabold' color='text.primary'>
                    {previewTitle}
                  </Typography>
                  {plan?.summary ? (
                    <Typography variant='body2' color='text.secondary'>
                      {plan.summary}
                    </Typography>
                  ) : null}
                  <Alert severity={phase === 'error' ? 'error' : 'info'} sx={{ whiteSpace: 'pre-wrap' }}>
                    {statusText}
                  </Alert>
                  {plan?.steps?.length ? (
                    <Box className='flex flex-col gap-1'>
                      {plan.steps.map(step => (
                        <Typography
                          key={step.id}
                          variant='body2'
                          color={stepMark(step, phase) === 'In progress' ? 'primary' : 'text.secondary'}
                        >
                          {stepMark(step, phase)}: {step.label}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              ) : null}

              {generatedMagnet?.mode === 'arithmetic' ? <ArithmeticCalculator magnet={generatedMagnet} /> : null}
              {generatedMagnet?.mode === 'formula' ? <FormulaTool magnet={generatedMagnet} /> : null}

              {!generatedMagnet && draft?.inputs?.length ? (
                <Box className='flex flex-col gap-3'>
                  <Divider />
                  <Typography variant='body2' color='text.secondary'>
                    These inputs are on the page. The result is not connected until the next step finishes.
                  </Typography>
                  <ToolFields inputs={draft.inputs} values={{}} onChange={() => {}} disabled />
                </Box>
              ) : null}

              {generatedMagnet?.mode === 'assistant' ? (
                <Box className='flex flex-col gap-4'>
                  <Box className='text-center'>
                    <Typography variant='h5' color='text.primary' className='font-extrabold mb-2'>
                      {generatedMagnet.title}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {generatedMagnet.description}
                    </Typography>
                  </Box>
                  <Divider />
                  <ToolFields inputs={generatedMagnet.inputs || []} values={magnetValues} onChange={setMagnetValues} />
                  <Button
                    variant='contained'
                    color='primary'
                    size='large'
                    onClick={handleRunMagnet}
                    disabled={isExecuting}
                    className='mt-2 py-3 font-bold shadow-md'
                  >
                    {isExecuting ? <CircularProgress size={24} color='inherit' /> : generatedMagnet.buttonText}
                  </Button>
                  {magnetResult ? (
                    <Box className='mt-4'>
                      <Typography variant='h6' className='font-bold mb-3 flex items-center gap-2 text-textPrimary'>
                        Generated Result
                      </Typography>
                      <Paper variant='outlined' className='p-6 md:p-8 bg-backgroundPaper border-divider rounded-xl shadow-sm relative'>
                        <Box className='absolute top-3 right-3 flex items-center gap-1 bg-backgroundPaper/80 backdrop-blur-sm p-1 rounded-md border border-divider'>
                          <Tooltip title='Copy Content'>
                            <IconButton size='small' onClick={handleCopyResult}>
                              <i className='ri-file-copy-line text-sm text-textSecondary hover:text-textPrimary' />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Box className='pt-1'>
                          <ResultView value={magnetResult} output={generatedMagnet.output} />
                        </Box>
                      </Paper>
                    </Box>
                  ) : null}
                </Box>
              ) : null}

              {phase === 'ready' && generatedMagnet?.mode === 'arithmetic' ? (
                <Typography variant='caption' color='text.secondary' textAlign='center'>
                  General-purpose calculator. Built on this page, so no model request was sent.
                </Typography>
              ) : null}
            </Paper>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={embedOpen} onClose={() => setEmbedOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant='h6' className='font-bold'>
            Embed this Tool
          </Typography>
          <IconButton onClick={() => setEmbedOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant='body2' color='text.secondary' className='mb-4'>
            Copy and paste this HTML snippet into your website, blog, or CMS to display your custom AffiGenieMagnet.
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '0.875rem', wordBreak: 'break-all' }}>
            {`<iframe src="https://yourdomain.com/embed/magnet-id" width="100%" height="600" style="border:none;"></iframe>`}
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEmbedOpen(false)} color='inherit'>
            Cancel
          </Button>
          <Button variant='contained' onClick={handleCopyEmbed} startIcon={<ContentCopyIcon />}>
            Copy Code
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default MagnetsPage

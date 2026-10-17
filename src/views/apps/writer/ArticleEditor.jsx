'use client'

import { useState, useEffect, useRef } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

import { Color } from '@tiptap/extension-color'
import { ListItem } from '@tiptap/extension-list-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import { Node, mergeAttributes, Extension } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { styled } from '@mui/material/styles'
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Switch from '@mui/material/Switch'

import { toast } from 'react-toastify'

import { serializeError } from '@/utils/serializeError'

import { useFeatureAccess } from './FeatureAccessContext'

import {
  getAffigenieArticleCss,
  prepareArticleHtml,
  finalizeArticleHtml,
  linkMapSnapshots,
  buildArticleIdentityMarker,
  titleCaseWords
} from '@/app/api/generate/utils/articleHtml'

function mediaKey(item) {
  if (!item) return ''

  if (typeof item === 'object' && item.id != null) {
    return `${String(item.source || 'img').toLowerCase()}:${item.id}`
  }

  const url = typeof item === 'string' ? item : item.url || ''

  if (!url) return ''

  try {
    const u = new URL(url)

    u.search = ''
    u.hash = ''
    const unsplash = u.pathname.match(/photo-([a-zA-Z0-9_-]+)/)

    if (unsplash) return `unsplash:${unsplash[1]}`
    const pexels = u.pathname.match(/\/photos\/(\d+)/)

    if (pexels) return `pexels:${pexels[1]}`
    const pix = u.pathname.match(/\/get\/g([a-f0-9]+)_/)

    if (pix) return `pixabay-file:${pix[1]}`

    return `${u.origin}${u.pathname.replace(/\/$/, '')}`
  } catch {
    return String(url).split('?')[0]
  }
}

function stripLeadingHeading(html, heading) {
  if (!html || !heading) return html
  const escaped = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const patterns = [
    new RegExp(`^\\s*<h[1-3][^>]*>\\s*${escaped}\\s*<\\/h[1-3]>`, 'i'),
    new RegExp(`^\\s*<p[^>]*>\\s*<strong>\\s*${escaped}\\s*<\\/strong>\\s*<\\/p>`, 'i'),
    new RegExp(`^\\s*#+\\s*${escaped}\\s*`, 'i')
  ]

  let out = String(html)

  for (const re of patterns) out = out.replace(re, '')

  return out
}

function waitHtml(index, text) {
  const raw = String(text || '').trim()
  const isWritingStatus = !raw || /^writing\b/i.test(raw)

  if (isWritingStatus) {
    return `<p class="wait-section wait-anchor wait-section-${index}" data-wait-section="${index}" style="display:none;margin:0;padding:0;height:0;overflow:hidden;border:0;background:transparent;">&#8203;</p>`
  }

  const safe = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `<p class="wait-section wait-section-${index}" data-wait-section="${index}" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;line-height:1.5;">${safe}</p>`
}

function failedSectionHtml(index, heading, { showHeading = true } = {}) {
  const safeHeading = String(heading || 'Section')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const retryBtn = `<button type="button" data-retry-section="${index}" class="retry-section-btn" title="Retry this section" contenteditable="false"></button>`

  const headingRow = showHeading
    ? `<h2 data-failed-heading="${index}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:40px;margin-bottom:8px;font-size:1.5rem;font-weight:700;color:rgba(38,43,67,0.9);line-height:1.3;">${safeHeading}${retryBtn}</h2>`
    : `<p data-failed-section="${index}" style="display:flex;justify-content:flex-end;margin:16px 0 8px;">${retryBtn}</p>`

  return `${headingRow}
<p class="failed-section failed-section-${index}" data-failed-section="${index}" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:8px;padding:12px 16px;margin:0 0 16px;font-size:14px;line-height:1.5;">Section failed, retry later...</p>`
}

function sectionTextToHtml(finalSectionText, language) {
  let cleanMd = String(finalSectionText || '')
    .replace(/^##\s+.*$/gm, '')
    .trim()

  cleanMd = cleanMd.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (match, code) => {
    const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')

    return `<pre style="background-color: #111827; color: #f3f4f6; padding: 16px; border-radius: 12px; margin: 24px 0; overflow-x: auto; font-family: monospace; font-size: 0.875rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #374151;"><code>${escapedCode}</code></pre>`
  })

  cleanMd = cleanMd.replace(/:\-\-+/g, '').replace(/\-\-+:/g, '')
  cleanMd = cleanMd.replace(/(?:\|.*\|\n)+/g, match => {
    const rows = match.trim().split('\n')
    let html = '<table><tbody>'

    rows.forEach((row, index) => {
      if (row.match(/^\|?[\s:|-]+\|?$/)) return
      const isHeader = index === 0
      const tag = isHeader ? 'th' : 'td'

      const cells = row
        .split('|')
        .map(c => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''))

      html += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>'
    })
    html += '</tbody></table>'

    return html
  })

  cleanMd = cleanMd.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
  cleanMd = cleanMd.replace(/<\/blockquote>\n<blockquote>/g, '<br/>')

  cleanMd = cleanMd.replace(/^[\s]*(?:-|\*)\s+(.*)$/gm, '<ul><li>$1</li></ul>')
  cleanMd = cleanMd.replace(/^[\s]*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>')

  cleanMd = cleanMd.replace(/<\/ul>\s*<ul>/g, '')
  cleanMd = cleanMd.replace(/<\/ol>\s*<ol>/g, '')

  cleanMd = cleanMd.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
  cleanMd = cleanMd.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
  cleanMd = cleanMd.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
  cleanMd = cleanMd.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')

  cleanMd = cleanMd.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  cleanMd = cleanMd.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  cleanMd = cleanMd.replace(
    /^---$/gm,
    '<hr style="margin: 32px 0; border: 0; border-top: 1px solid rgba(38, 43, 67, 0.12);" />'
  )

  cleanMd = cleanMd.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" style="border-radius: 12px; max-width: 100%; width: 672px; margin: 32px auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); aspect-ratio: 16/9; object-fit: cover;" />'
  )

  cleanMd = cleanMd.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" style="color: #666CFF; text-decoration: underline; font-weight: 500;">$1</a>'
  )

  cleanMd = cleanMd.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  cleanMd = cleanMd.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '<em>$1</em>')
  cleanMd = cleanMd.replace(/(?<!\w)_(.*?)_(?!\w)/g, '<em>$1</em>')
  cleanMd = cleanMd.replace(
    /`([^`]+)`/g,
    '<code style="background-color: rgba(38, 43, 67, 0.06); padding: 2px 6px; border-radius: 4px; color: #666CFF; font-family: monospace; font-size: 0.875rem; border: 1px solid rgba(38, 43, 67, 0.12);">$1</code>'
  )
  cleanMd = cleanMd.replace(/~~(.*?)~~/g, '<s>$1</s>')

  cleanMd = cleanMd.replace(/(<(ul|ol|table|blockquote|pre|hr|h[1-6]|img|div|figure))/g, '\n\n$1')
  cleanMd = cleanMd.replace(/(<\/(ul|ol|table|blockquote|pre|h[1-6]|figure)>)/g, '$1\n\n')

  const html = cleanMd
    .split(/\n\n+/)
    .map(block => {
      block = block.trim()
      if (!block) return ''
      if (block.match(/^(<h|<ul|<ol|<blockquote|<pre|<table|<hr|<img|<div|<figure)/)) return block

      return `<p>${block.replace(/\n/g, '<br/>')}</p>`
    })
    .join('')

  return prepareArticleHtml(html, { language })
}

function upsertWaitInEditor(editor, index, text) {
  if (!editor) return

  const current = editor.getHTML()

  const re = new RegExp(`<p[^>]*(?:data-wait-section="${index}"|wait-section-${index})[^>]*>[\\s\\S]*?<\\/p>`, 'i')

  if (re.test(current)) {
    editor.commands.setContent(current.replace(re, waitHtml(index, text)), false)
  } else {
    editor.chain().focus('end').insertContent(waitHtml(index, text)).run()
  }
}

function removeWaitInEditor(editor, index) {
  if (!editor) return

  const re = new RegExp(`<p[^>]*(?:data-wait-section="${index}"|wait-section-${index})[^>]*>[\\s\\S]*?<\\/p>`, 'i')

  editor.commands.setContent(editor.getHTML().replace(re, ''), false)
}

const ProgressCircularWithLabel = ({ value, color }) => {
  return (
    <div className='relative inline-flex'>
      <CircularProgress variant='determinate' value={value} color={color} size={40} />
      <div className='flex absolute top-0 left-0 right-0 bottom-0 items-center justify-center'>
        <Typography variant='caption' component='div' color='text.secondary' className='font-bold'>
          {`${Math.round(value)}%`}
        </Typography>
      </div>
    </div>
  )
}

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  blockSize: 10,
  borderRadius: 5,
  backgroundColor: 'var(--mui-palette-customColors-trackBg)',
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 5
  }
}))

const EditorToolbar = ({ editor }) => {
  if (!editor) {
    return null
  }

  const editorState = useEditorState({
    editor,
    selector: ctx => ({
      isBold: ctx.editor.isActive('bold'),
      canBold: ctx.editor.can().chain().toggleBold().run(),
      isItalic: ctx.editor.isActive('italic'),
      canItalic: ctx.editor.can().chain().toggleItalic().run(),
      isStrike: ctx.editor.isActive('strike'),
      canStrike: ctx.editor.can().chain().toggleStrike().run(),
      isCode: ctx.editor.isActive('code'),
      canCode: ctx.editor.can().chain().toggleCode().run(),
      isParagraph: ctx.editor.isActive('paragraph'),
      isHeading1: ctx.editor.isActive('heading', { level: 1 }),
      isHeading2: ctx.editor.isActive('heading', { level: 2 }),
      isHeading3: ctx.editor.isActive('heading', { level: 3 }),
      isHeading4: ctx.editor.isActive('heading', { level: 4 }),
      isHeading5: ctx.editor.isActive('heading', { level: 5 }),
      isHeading6: ctx.editor.isActive('heading', { level: 6 }),
      isBulletList: ctx.editor.isActive('bulletList'),
      isOrderedList: ctx.editor.isActive('orderedList'),
      isCodeBlock: ctx.editor.isActive('codeBlock'),
      isBlockquote: ctx.editor.isActive('blockquote'),
      canUndo: ctx.editor.can().chain().undo().run(),
      canRedo: ctx.editor.can().chain().redo().run()
    })
  })

  const insertAfterSelection = content => {
    const { to } = editor.state.selection

    editor.chain().focus().insertContentAt(to, content).run()
  }

  return (
    <div className='flex flex-wrap gap-x-4 gap-y-2 p-5'>
      <Chip
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editorState.canBold}
        {...(editorState.isBold && { variant: 'tonal', color: 'primary' })}
        label='bold'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editorState.canItalic}
        {...(editorState.isItalic && { variant: 'tonal', color: 'primary' })}
        label='italic'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editorState.canStrike}
        {...(editorState.isStrike && { variant: 'tonal', color: 'primary' })}
        label='strike'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editorState.canCode}
        {...(editorState.isCode && { variant: 'tonal', color: 'primary' })}
        label='code'
      />
      <Chip onClick={() => editor.chain().focus().unsetAllMarks().run()} label='clear marks' />
      <Chip onClick={() => editor.chain().focus().clearNodes().run()} label='clear nodes' />
      <Chip
        onClick={() => editor.chain().focus().setParagraph().run()}
        {...(editorState.isParagraph && { variant: 'tonal', color: 'primary' })}
        label='paragraph'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        {...(editorState.isHeading1 && { variant: 'tonal', color: 'primary' })}
        label='h1'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        {...(editorState.isHeading2 && { variant: 'tonal', color: 'primary' })}
        label='h2'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        {...(editorState.isHeading3 && { variant: 'tonal', color: 'primary' })}
        label='h3'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        {...(editorState.isHeading4 && { variant: 'tonal', color: 'primary' })}
        label='h4'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        {...(editorState.isHeading5 && { variant: 'tonal', color: 'primary' })}
        label='h5'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
        {...(editorState.isHeading6 && { variant: 'tonal', color: 'primary' })}
        label='h6'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        {...(editorState.isBulletList && { variant: 'tonal', color: 'primary' })}
        label='bulletlist'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        {...(editorState.isOrderedList && { variant: 'tonal', color: 'primary' })}
        label='orderedlist'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        {...(editorState.isCodeBlock && { variant: 'tonal', color: 'primary' })}
        label='codeblock'
      />
      <Chip
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        {...(editorState.isBlockquote && { variant: 'tonal', color: 'primary' })}
        label='blockquote'
      />
      <Chip onClick={() => insertAfterSelection('<hr>')} label='horizontal rule' />
      <Chip onClick={() => insertAfterSelection('<br>')} label='hard break' />
      <Chip onClick={() => editor.chain().focus().undo().run()} disabled={!editorState.canUndo} label='undo' />
      <Chip onClick={() => editor.chain().focus().redo().run()} disabled={!editorState.canRedo} label='redo' />
      <Chip
        onClick={() => editor.chain().focus().setColor('var(--mui-palette-primary-main, #8C57FF)').run()}
        label='primary'
      />
    </div>
  )
}

const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true }
    }
  },
  parseHTML() {
    return [{ tag: 'video' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        style:
          'width: 100%; aspect-ratio: 16/9; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 24px auto; display: block; max-width: 48rem;'
      })
    ]
  }
})

const RetrySectionButton = Node.create({
  name: 'retrySectionButton',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return {
      index: {
        default: 0,
        parseHTML: element => Number(element.getAttribute('data-retry-section') || 0),
        renderHTML: attributes => ({ 'data-retry-section': String(attributes.index) })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'button[data-retry-section]' }]
  },
  renderHTML({ node }) {
    return [
      'button',
      {
        type: 'button',
        'data-retry-section': String(node.attrs.index),
        class: 'retry-section-btn',
        contenteditable: 'false',
        title: 'Retry this section'
      }
    ]
  },
  addNodeView() {
    return ({ node }) => {
      const btn = document.createElement('button')

      btn.type = 'button'
      btn.className = 'retry-section-btn'
      btn.setAttribute('data-retry-section', String(node.attrs.index))
      btn.setAttribute('contenteditable', 'false')
      btn.title = 'Retry this section'
      btn.innerHTML =
        '<i class="ri-refresh-line" style="font-size:20px;line-height:1;pointer-events:none;display:block;"></i>'

      return {
        dom: btn,
        ignoreMutation: () => true,
        stopEvent: event => event.type !== 'click'
      }
    }
  }
})

const GlobalAttributes = Extension.create({
  name: 'globalAttributes',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle', 'paragraph', 'heading', 'link', 'image', 'table', 'tableCell', 'tableHeader', 'tableRow'],
        attributes: {
          class: {
            default: null,
            parseHTML: element => element.getAttribute('class'),
            renderHTML: attributes => {
              if (!attributes.class) return {}

              return { class: attributes.class }
            }
          },
          'data-wait-section': {
            default: null,
            parseHTML: element => element.getAttribute('data-wait-section'),
            renderHTML: attributes => {
              if (!attributes['data-wait-section']) return {}

              return { 'data-wait-section': attributes['data-wait-section'] }
            }
          },
          'data-failed-section': {
            default: null,
            parseHTML: element => element.getAttribute('data-failed-section'),
            renderHTML: attributes => {
              if (!attributes['data-failed-section']) return {}

              return { 'data-failed-section': attributes['data-failed-section'] }
            }
          },
          'data-failed-heading': {
            default: null,
            parseHTML: element => element.getAttribute('data-failed-heading'),
            renderHTML: attributes => {
              if (!attributes['data-failed-heading']) return {}

              return { 'data-failed-heading': attributes['data-failed-heading'] }
            }
          },
          'data-label': {
            default: null,
            parseHTML: element => element.getAttribute('data-label'),
            renderHTML: attributes => {
              if (!attributes['data-label']) return {}

              return { 'data-label': attributes['data-label'] }
            }
          },
          style: {
            default: null,
            parseHTML: element => element.getAttribute('style'),
            renderHTML: attributes => {
              if (!attributes.style) return {}

              return { style: attributes.style }
            }
          }
        }
      }
    ]
  }
})

const extensions = [
  TextStyle,
  Color.configure({ types: ['textStyle'] }),
  StarterKit.configure({
    heading: false,
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
      HTMLAttributes: {
        style: 'list-style-type: disc; margin-left: 32px; padding-left: 0; margin-top: 16px; margin-bottom: 16px;'
      }
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
      HTMLAttributes: {
        style: 'list-style-type: decimal; margin-left: 32px; padding-left: 0; margin-top: 16px; margin-bottom: 16px;'
      }
    },
    blockquote: {
      HTMLAttributes: {
        style:
          'border-left: 4px solid #666CFF; padding-left: 16px; padding-top: 8px; padding-bottom: 8px; margin: 16px 0; font-style: italic; color: rgba(38, 43, 67, 0.7); background-color: rgba(38, 43, 67, 0.03); border-top-right-radius: 8px; border-bottom-right-radius: 8px;'
      }
    },

    listItem: {
      HTMLAttributes: { style: 'margin-bottom: 8px;' }
    },
    paragraph: {
      HTMLAttributes: { style: 'margin-top: 0; margin-bottom: 16px;' }
    }
  }),
  GlobalAttributes,
  RetrySectionButton,
  TaskList,
  TaskItem.configure({ nested: true }),
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }).extend({
    renderHTML({ node, HTMLAttributes }) {
      const hasLevel = this.options.levels.includes(node.attrs.level)
      const level = hasLevel ? node.attrs.level : this.options.levels[0]

      const styles = {
        1: 'font-size: 1.875rem; font-weight: 800; margin-top: 48px; margin-bottom: 24px; color: rgba(38, 43, 67, 0.9); line-height: 1.2;',
        2: 'font-size: 1.5rem; font-weight: 700; margin-top: 40px; margin-bottom: 16px; color: rgba(38, 43, 67, 0.9); line-height: 1.3;',
        3: 'font-size: 1.25rem; font-weight: 600; margin-top: 32px; margin-bottom: 12px; color: rgba(38, 43, 67, 0.9); line-height: 1.4;',
        4: 'font-size: 1.125rem; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: rgba(38, 43, 67, 0.9); line-height: 1.5;',
        5: 'font-size: 1rem; font-weight: 700; margin-top: 16px; margin-bottom: 8px; color: rgba(38, 43, 67, 0.9); line-height: 1.5;',
        6: 'font-size: 0.875rem; font-weight: 700; margin-top: 16px; margin-bottom: 8px; color: rgba(38, 43, 67, 0.7); text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.5;'
      }

      return ['h' + level, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style: styles[level] }), 0]
    }
  }),
  Placeholder.configure({ placeholder: 'Document ready.' }),
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        mapHref: {
          default: null,
          parseHTML: element => {
            const own = element.getAttribute('data-map-href')

            if (own) return own

            const parent = element.parentElement

            if (parent && parent.tagName === 'A') {
              const parentHref = parent.getAttribute('href')

              if (parentHref && parentHref !== '#' && !/youtube\.com|youtu\.be/i.test(parentHref)) return parentHref
            }

            return null
          },
          renderHTML: attributes => {
            if (!attributes.mapHref) return {}

            return { 'data-map-href': attributes.mapHref }
          }
        },
        youtubeHref: {
          default: null,
          parseHTML: element => {
            const own = element.getAttribute('data-youtube-href')

            if (own) return own

            const parent = element.parentElement

            if (parent && parent.tagName === 'A') {
              const parentHref = parent.getAttribute('href') || ''

              if (parentHref && /youtube\.com|youtu\.be/i.test(parentHref)) return parentHref
            }

            return null
          },
          renderHTML: attributes => {
            if (!attributes.youtubeHref) return {}

            return { 'data-youtube-href': attributes.youtubeHref }
          }
        },
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: () => ({})
        }
      }
    },
    renderHTML({ HTMLAttributes }) {
      const src = String(HTMLAttributes.src || '')
      const parsedStyle = String(HTMLAttributes.style || '')
      const isAmazon = /(?:m\.media-amazon\.com|images-amazon\.com|ssl-images-amazon\.com)/i.test(src)

      const heroStyle =
        'border-radius: 12px; max-width: 100%; width: 672px; margin: 32px auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); aspect-ratio: 16/9; object-fit: cover; cursor: pointer;'

      const productStyle =
        'display:block;max-width:min(100%, 480px);width:auto;height:auto;max-height:640px;margin:24px auto;object-fit:contain;aspect-ratio:auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.06);'

      const thumbStyle =
        'width:80px;height:80px;max-width:100%;object-fit:contain;aspect-ratio:auto;border-radius:8px;background:#ffffff;'

      const style = !isAmazon ? heroStyle : /width\s*:\s*80px/i.test(parsedStyle) ? thumbStyle : productStyle
      const defaults = { ...(this.options.HTMLAttributes || {}) }

      delete defaults.style

      const { style: _parsedStyle, ...rest } = HTMLAttributes

      return ['img', mergeAttributes(defaults, rest, { style })]
    }
  }).configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: {
      style:
        'border-radius: 12px; max-width: 100%; width: 672px; margin: 32px auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); aspect-ratio: 16/9; object-fit: cover; cursor: pointer;'
    }
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      style: 'color: #666CFF; text-decoration: underline; cursor: pointer;'
    }
  }),
  Youtube.configure({
    controls: true,
    nocookie: true,
    HTMLAttributes: {
      style:
        'width: 100%; aspect-ratio: 16/9; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin: 24px 0; border: none; display: block; max-width: 100%;'
    }
  }),
  Table.configure({
    HTMLAttributes: {
      style:
        'width: 100%; border-collapse: separate; border-spacing: 0; margin: 32px 0; text-align: left; font-size: 0.875rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border-radius: 12px; overflow: hidden; border: 1px solid rgba(38, 43, 67, 0.12); display: table; max-width: 100%;'
    }
  }),
  TableRow.configure({
    HTMLAttributes: {
      style: 'transition: background-color 0.2s ease;'
    }
  }),
  TableHeader.configure({
    HTMLAttributes: {
      style:
        'background-color: rgba(38, 43, 67, 0.04); padding: 16px; font-weight: 600; color: rgba(38, 43, 67, 0.9); border-bottom: 1px solid rgba(38, 43, 67, 0.12); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;'
    }
  }),
  TableCell.configure({
    HTMLAttributes: {
      style:
        'padding: 16px; color: rgba(38, 43, 67, 0.7); border-bottom: 1px solid rgba(38, 43, 67, 0.08); vertical-align: middle;'
    }
  })
]

const convertHtmlToMarkdown = html => {
  if (!html) return ''
  let md = html

  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  md = md.replace(/<ul[^>]*>/gi, '\n')
  md = md.replace(/<\/ul>/gi, '\n')
  md = md.replace(/<ol[^>]*>/gi, '\n')
  md = md.replace(/<\/ol>/gi, '\n')
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n')
  md = md.replace(/<img\b[^>]*data-map-href=(["'])([\s\S]*?)\1[^>]*>/gi, tag => {
    const src = (tag.match(/\bsrc=(["'])([\s\S]*?)\1/i) || [])[2] || ''
    const href = (tag.match(/\bdata-map-href=(["'])([\s\S]*?)\1/i) || [])[2] || ''
    const alt = (tag.match(/\balt=(["'])([\s\S]*?)\1/i) || [])[2] || 'Map'

    if (!src || !href) return tag

    return `[![${alt}](${src})](${href})`
  })
  md = md.replace(/<[^>]*>?/gm, '')

  md = md
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  md = md.replace(/\n{3,}/g, '\n\n')

  return md.trim()
}

const ArticleEditor = ({ settings, setSettings, setStep, outline, setOutline }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draftId')
  const { modeOf } = useFeatureAccess()
  const [isGenerating, setIsGenerating] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sectionProgress, setSectionProgress] = useState({ done: 0, total: 0 })

  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  const isExportMenuOpen = Boolean(exportAnchorEl)

  const abortControllerRef = useRef(null)
  const hasStartedRef = useRef(false)
  const genContextRef = useRef(null)

  const [pollingStatus, setPollingStatus] = useState('')
  const [deepSearchProgress, setDeepSearchProgress] = useState(0)
  const [waitBanner, setWaitBanner] = useState('')

  const progressColors = ['secondary', 'success', 'error', 'warning', 'info', 'primary']

  const progressPercentage =
    sectionProgress.total > 0 ? Math.min(100, (sectionProgress.done / sectionProgress.total) * 100) : 0

  const currentProgressColor = progressColors[currentIndex % progressColors.length] || 'primary'

  const deepSearchColorPalette = ['info', 'secondary', 'primary', 'warning', 'success']
  const deepSearchColorIndex = Math.floor(deepSearchProgress / 10) % deepSearchColorPalette.length
  const deepSearchColor = deepSearchColorPalette[deepSearchColorIndex] || 'primary'

  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [siteSelectionType, setSiteSelectionType] = useState('webmarketics')
  const [customWPData, setCustomWPData] = useState({ name: '', url: '', username: '', password: '' })
  const [saveSiteToDb, setSaveSiteToDb] = useState(false)
  const [userSavedSites, setUserSavedSites] = useState([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishTitle, setPublishTitle] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState(settings?.heroImage || '')
  const [trimTitleAndHero, setTrimTitleAndHero] = useState(true)
  const [publishSuccessData, setPublishSuccessData] = useState(null)

  const editor = useEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-textSecondary [&_hr]:border-t-2 [&_hr]:border-solid [&_hr]:border-gray-300 [&_hr]:my-8 [&_hr]:w-full'
      }
    }
  })

  const clearUploadedMedia = async uploadedUrls => {
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ clearAll: true })
      })
      console.log('Cleanup complete: Uploaded media removed.')
    } catch (error) {
      console.error('Failed to clear uploads:', error)
    }
  }

  const handlePublishToWP = async (status = 'draft', metaTitle, metaDescription) => {
    const contentToPublish = editor?.getHTML() || ''

    const plainContent = contentToPublish
      .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .trim()

    if (!plainContent) {
      toast.error('Add article content before publishing.')

      return
    }

    if (isPublishing) return
    setIsPublishing(true)
    setPublishSuccessData(null)

    try {
      const isCustom = siteSelectionType === 'custom'
      const isDbSaved = siteSelectionType.startsWith('db_')

      let activeSiteId = siteSelectionType
      let activeCustomData = customWPData

      if (isCustom && saveSiteToDb) {
        const saveRes = await fetch('/api/custom-wp-sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customWPData)
        })

        const saveData = await saveRes.json()

        if (saveData.success) {
          setUserSavedSites(prev => [...prev, saveData.site])
        }
      }

      if (isDbSaved) {
        const dbId = siteSelectionType.replace('db_', '')
        const targetDbSite = userSavedSites.find(s => s.id === dbId)

        if (targetDbSite) {
          activeCustomData = {
            url: targetDbSite.url,
            username: targetDbSite.username,
            password: targetDbSite.password
          }
        }
      }

      let finalContent = editor?.getHTML() || ''

      if (typeof window !== 'undefined') {
        const tempDiv = document.createElement('div')

        tempDiv.innerHTML = finalContent

        tempDiv.querySelectorAll('li > p').forEach(p => {
          const parent = p.parentNode

          while (p.firstChild) {
            parent.insertBefore(p.firstChild, p)
          }

          parent.removeChild(p)
        })

        finalContent = tempDiv.innerHTML
      }

      finalContent = linkMapSnapshots(finalContent)

      let finalHeroImage = heroImageUrl

      if (!finalHeroImage) {
        const imgMatch = finalContent.match(/<img[^>]+src=["']([^"']+)["']/i)

        if (imgMatch) {
          finalHeroImage = imgMatch[1]
        }
      }

      if (typeof window !== 'undefined') {
        const publishDiv = document.createElement('div')

        publishDiv.innerHTML = finalContent

        const normalizeSrc = src => {
          const s = String(src || '').trim()

          if (!s) return ''
          if (s.startsWith('data:')) return s

          try {
            const u = new URL(s, window.location.origin)

            u.hash = ''
            u.search = ''

            return u.href.replace(/\/$/, '')
          } catch {
            return s.split('?')[0].split('#')[0].replace(/\/$/, '')
          }
        }

        const removeImgNode = img => {
          const paragraph = img.closest('p') || img.closest('figure')
          const anchor = img.closest('a')

          if (anchor) anchor.remove()
          else img.remove()

          if (
            paragraph &&
            !paragraph.textContent.replace(/\u00a0/g, ' ').trim() &&
            !paragraph.querySelector('img, iframe, video')
          ) {
            paragraph.remove()
          }
        }

        const isLeadingImageOnly = node => {
          const tag = node.tagName?.toLowerCase()

          if (tag !== 'p' && tag !== 'figure' && tag !== 'div') return false

          const hasImg = node.querySelector?.('img')
          const text = (node.textContent || '').replace(/\u00a0/g, ' ').trim()

          return Boolean(hasImg && text.length < 40)
        }

        if (trimTitleAndHero) {
          // Full trim: remove H1 + every hero match + all leading image-only blocks
          publishDiv.querySelectorAll('h1').forEach(node => node.remove())

          const heroNorm = normalizeSrc(finalHeroImage)
          const heroKey = mediaKey(finalHeroImage)

          if (heroNorm) {
            publishDiv.querySelectorAll('img').forEach(img => {
              if (normalizeSrc(img.getAttribute('src')) === heroNorm) removeImgNode(img)
            })
          }

          if (heroKey) {
            publishDiv.querySelectorAll('img').forEach(img => {
              if (mediaKey(img.getAttribute('src') || '') === heroKey) removeImgNode(img)
            })
          }

          Array.from(publishDiv.children).forEach(node => {
            const tag = node.tagName?.toLowerCase()

            if (tag === 'h2' || tag === 'h3' || tag === 'h4') return
            if (isLeadingImageOnly(node)) node.remove()
          })
        } else {
          // Toggle off: keep exactly one leading hero — drop duplicates only
          let keptHero = false

          for (const node of Array.from(publishDiv.children)) {
            const tag = node.tagName?.toLowerCase()

            if (tag === 'h2' || tag === 'h3' || tag === 'h4') break
            if (tag === 'h1') continue

            if (isLeadingImageOnly(node)) {
              if (keptHero) node.remove()
              else keptHero = true
            } else {
              const text = (node.textContent || '').replace(/\u00a0/g, ' ').trim()

              if (text.length > 40) break
            }
          }
        }

        finalContent = publishDiv.innerHTML
      }

      const payload = {
        title: publishTitle,
        content: finalContent,
        status: status,
        siteType: isCustom || isDbSaved ? 'custom' : 'predefined',
        siteId: !isCustom && !isDbSaved ? activeSiteId : null,
        customSite: isCustom || isDbSaved ? activeCustomData : null,
        featuredImageUrl: finalHeroImage,
        trimTitleAndHero,
        language: settings.language,
        metaTitle: metaTitle,
        metaDescription: metaDescription,
        articleType: settings.type || '',
        settings
      }

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()

      if (result.success) {
        setPublishSuccessData({
          link: result.link,
          editLink: result.editLink,
          id: result.wpPostId,
          status: result.status,
          type: result.status === 'draft' ? 'wp-draft-success' : 'wp-publish-success'
        })
      } else {
        const statusCode = res.status

        if (statusCode === 401) toast.error('Sign in to continue.')
        else if ([402, 403].includes(statusCode))
          toast.error(serializeError(result.error) || 'You are not allowed to publish this article.')
        else toast.error(serializeError(result.error))
      }
    } catch (error) {
      toast.error(serializeError(error))
    } finally {
      setIsPublishing(false)
    }
  }

  const handleSaveDraftToDB = async () => {
    if (isPublishing) return
    setIsPublishing(true)

    try {
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()

      if (!session || !Object.keys(session).length) {
        setPublishSuccessData({ type: 'unauthenticated' })
        setIsPublishing(false)

        return
      }

      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: publishTitle || settings?.generatedTitle || 'Untitled Draft',
          content: finalizeArticleHtml(linkMapSnapshots(editor?.getHTML() || ''), {
            language: settings.language,
            articleType: settings.type || '',
            settings
          }),
          outline: outline && outline.length > 0 ? JSON.stringify(outline) : null,
          status: 'draft',
          targetSite: siteSelectionType !== 'custom' ? siteSelectionType : null
        })
      })

      const data = await res.json()

      if (data.success) {
        setPublishSuccessData({ type: 'draft-success' })
      } else {
        if (res.status === 401) toast.error('Sign in to continue.')
        else if ([402, 403].includes(res.status))
          toast.error(serializeError(data?.error) || 'You are not allowed to save this draft.')
        else toast.error(serializeError(data?.error || data))
      }
    } catch (error) {
      toast.error(serializeError(error))
    } finally {
      setIsPublishing(false)
    }
  }

  useEffect(() => {
    const fetchCustomSites = async () => {
      try {
        const res = await fetch('/api/custom-wp-sites')

        if (res.ok) {
          const data = await res.json()

          setUserSavedSites(data.sites || [])
        }
      } catch (error) {
        console.error('Failed to load custom sites', error)
      }
    }

    fetchCustomSites()
  }, [])

  useEffect(() => {
    if (publishDialogOpen) {
      setPublishSuccessData(null)
      setPublishTitle(settings?.generatedTitle || settings?.targetKeyword || 'My AI Generated Article')

      if (settings?.heroImage && !heroImageUrl) {
        setHeroImageUrl(settings.heroImage)
      }
    }
  }, [publishDialogOpen, settings])

  useEffect(() => {
    if (!editor || hasStartedRef.current) return

    if (draftId) {
      hasStartedRef.current = true

      return
    }

    hasStartedRef.current = true
    let isCancelled = false

    abortControllerRef.current = new AbortController()

    const generateArticleSequentially = async () => {
      setIsGenerating(true)
      editor.setEditable(false)
      editor.commands.setContent('')

      const topTitle = settings.generatedTitle || settings.targetKeyword
      let initialContent = `<h1>${topTitle}</h1>`

      if (settings.heroImage) {
        const youtubeHref =
          String(settings.youtubeUrl || '').trim() ||
          (settings.youtubeVideoId
            ? `https://www.youtube.com/watch?v=${settings.youtubeVideoId}`
            : settings.heroImageId && String(settings.heroImageSource || '').includes('youtube')
              ? `https://www.youtube.com/watch?v=${settings.heroImageId}`
              : '')

        const isYoutubeHero =
          Boolean(youtubeHref) && (settings.type === 'youtube-blog' || settings.youtubeVideoId || settings.youtubeUrl)

        if (isYoutubeHero) {
          const safeHref = youtubeHref.replace(/"/g, '&quot;')
          const safeTitle = String(topTitle || '').replace(/"/g, '&quot;')

          initialContent += `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer nofollow" title="Watch on YouTube"><img src="${settings.heroImage}" alt="${safeTitle}" title="${safeTitle}" data-youtube-href="${safeHref}" style="cursor:pointer;" /></a></p>`
        } else {
          initialContent += `<p><img src="${settings.heroImage}" alt="${topTitle}" title="${topTitle}" /></p>`
        }
      } else {
        initialContent += `<p></p>`
      }

      editor.commands.setContent(initialContent)

      if (Array.isArray(outline)) {
        outline.forEach(item => {
          if (item && typeof item.text === 'string') item.text = titleCaseWords(item.text)
        })
      }

      const groupedSections = []

      let currentH2Group = null

      let trackedImages = []
      let trackedInternalLinks = []

      if (settings.heroImage) {
        trackedImages.push(settings.heroImage)

        if (settings.heroImageId != null) {
          trackedImages.push(mediaKey({ id: settings.heroImageId, source: settings.heroImageSource || 'img' }))
        }
      }

      let trackedExternalLinks = []

      outline.forEach((item, index) => {
        if (item.type === 'h2') {
          currentH2Group = { h2: item, h3s: [], originalIndex: index }
          groupedSections.push(currentH2Group)
        } else if (item.type === 'h3') {
          if (currentH2Group) {
            currentH2Group.h3s.push(item)
          } else {
            groupedSections.push({ h2: item, h3s: [], originalIndex: index })
          }
        }
      })

      setSectionProgress({ done: 0, total: groupedSections.length })

      const processAndInsertSection = (i, group, data) => {
        if (!data || !data.success || !data?.text || data.text.trim().length < 30) {
          return failedSectionHtml(i, group.h2?.text, { showHeading: i !== 0 })
        }

        const parts = []

        if (i !== 0) {
          parts.push(`<${group.h2.type}>${group.h2.text}</${group.h2.type}>`)
        }

        let finalSectionText = stripLeadingHeading(data.text, group.h2?.text)

        finalSectionText = String(finalSectionText || '').replace(
          /^\s*(?:#{1,3}\s+[^\n]+|<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)\s*/i,
          ''
        )

        if (data.mediaUrl) {
          trackedImages.push(data.mediaUrl)
        }

        if (data.internalLinkUrl) {
          trackedInternalLinks.push(data.internalLinkUrl)
        }

        if (settings.fetchedExternalLinks && settings.fetchedExternalLinks.length > 0) {
          const newlyUsedLinks = settings.fetchedExternalLinks.filter(
            link => finalSectionText.includes(link) && !trackedExternalLinks.includes(link)
          )

          if (newlyUsedLinks.length > 0) {
            trackedExternalLinks.push(...newlyUsedLinks)
          }
        }

        parts.push(sectionTextToHtml(finalSectionText, settings.language))

        let mediaHtml = data.mediaHtml || ''
        const skipMediaForHeroIntro = i === 0 && !!settings.heroImage

        if (mediaHtml && !skipMediaForHeroIntro) {
          const candidateKeys = [data.mediaUrl, data.mediaId].filter(Boolean).flatMap(v => {
            const keys = [mediaKey(v)]

            if (/^[a-zA-Z0-9_-]{11}$/.test(String(v))) {
              keys.push(mediaKey({ id: v, source: 'youtube' }))
            }

            return keys
          })

          const alreadyUsed = candidateKeys.some(k => liveUsedMedia.has(k))

          if (!alreadyUsed) {
            candidateKeys.forEach(k => {
              if (k) liveUsedMedia.add(k)
            })
            parts.push(mediaHtml)
          }
        }

        if (data.mapHtml) parts.push(data.mapHtml)

        return parts.join('')
      }

      if (settings.deepSearch) {
        for (let i = 0; i < groupedSections.length; i++) {
          if (isCancelled) break

          const group = groupedSections[i]

          setCurrentIndex(group.originalIndex)

          const shouldGenerateMedia = i === 0 && settings.heroImage ? false : settings.aiImagesAndVideos

          const subheadings = group.h3s.map(h3 => h3.text)

          try {
            let allLinks = Array.isArray(settings.internalLinking) ? [...settings.internalLinking] : []

            if (settings.customInternalLink) {
              const customLinks = settings.customInternalLink
                .split(',')
                .map(l => l.trim())
                .filter(l => l)

              allLinks = [...allLinks, ...customLinks]
            }

            const res = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: abortControllerRef.current.signal,
              body: JSON.stringify({
                mode: 'section',
                settings: settings,
                targetKeyword: settings.targetKeyword,
                model: settings.model,
                outlineContext: outline,
                heading: group.h2.text,
                subheadings: subheadings,
                shared: shared || (settings.type === 'product-comparison' ? settings.comparisonShared : null),
                internalLinks: allLinks,
                seoOptimization: settings.seoOptimization,
                manualKeywords: settings.manualKeywords,
                aiImagesAndVideos: shouldGenerateMedia,
                sectionIndex: i,
                totalSections: groupedSections.length,
                toneOfVoice: settings.toneOfVoice,
                customToneOfVoice: settings.customToneOfVoice,
                language: settings.language,
                country: settings.country,
                pointOfView: settings.pointOfView,
                useRealTimeSearchData: settings.useRealTimeSearchData,
                realTimeDataSource: settings.realTimeDataSource,
                externalLinks: settings.fetchedExternalLinks,
                usedExternalLinks: trackedExternalLinks,
                deepSearch: settings.deepSearch,
                articleTitle: settings.generatedTitle,
                improveReadability: settings.improveReadability,
                uploadedMedia: settings.uploadedMedia,
                usedImageUrls: trackedImages,
                usedInternalLinks: trackedInternalLinks
              })
            })

            let data

            try {
              data = await res.json()
            } catch (parseError) {
              const text = await res.text().catch(() => 'Unknown server error')

              throw new Error(`Server returned invalid response: ${text.slice(0, 120)}`)
            }

            if (!res.ok || !data?.success) {
              throw new Error(serializeError(data?.error || data) || `HTTP ${res.status}`)
            }

            if (data.success) {
              let finalSectionText = data.text

              if (data.isDeepSearch && data.interactionId) {
                setPollingStatus(`Initializing Deep Research Agent...`)
                setDeepSearchProgress(5)

                let isCompleted = false
                let pollCount = 0

                while (!isCompleted) {
                  if (isCancelled) break

                  await new Promise(resolve => setTimeout(resolve, 10000))
                  pollCount++

                  if (pollCount === 1) setPollingStatus('Initializing Deep Search capabilities...')
                  if (pollCount === 3) setPollingStatus('Running live web queries...')
                  if (pollCount === 5) setPollingStatus('Scouring authoritative sources & extracting data...')
                  if (pollCount === 8) setPollingStatus('Cross-referencing facts and checking statistics...')
                  if (pollCount === 10) setPollingStatus('Analyzing semantic relevance and topic depth...')
                  if (pollCount === 13) setPollingStatus('Synthesizing research into a comprehensive draft...')
                  if (pollCount === 15) setPollingStatus('Expanding insights with secondary source validation...')
                  if (pollCount === 18) setPollingStatus('Structuring content for optimal readability...')
                  if (pollCount === 20) setPollingStatus('Applying strict SEO constraints and LSI keywords...')
                  if (pollCount === 23) setPollingStatus('Polishing grammar and finalizing Markdown formatting...')
                  if (pollCount === 25) setPollingStatus('Performing final quality checks...')

                  const estimatedProgress = Math.min(95, 5 + Math.floor(pollCount * 2))

                  setDeepSearchProgress(estimatedProgress)

                  try {
                    const pollRes = await fetch(`/api/poll?id=${data.interactionId}`, {
                      signal: abortControllerRef.current.signal
                    })

                    const pollData = await pollRes.json()

                    if (pollData.status === 'completed') {
                      finalSectionText = pollData.text
                      setDeepSearchProgress(100)
                      isCompleted = true
                    }
                  } catch (pollError) {
                    if (pollError.name === 'AbortError') throw pollError
                  }
                }

                await new Promise(resolve => setTimeout(resolve, 1000))
                setPollingStatus('')
                setDeepSearchProgress(0)
              }

              editor
                .chain()
                .focus('end')
                .insertContent(processAndInsertSection(i, group, { ...data, text: finalSectionText }))
                .run()
            } else {
              editor
                .chain()
                .focus('end')
                .insertContent(failedSectionHtml(i, group.h2?.text, { showHeading: i !== 0 }))
                .run()
            }
          } catch (error) {
            if (error.name === 'AbortError') {
              editor.chain().focus('end').insertContent('<p><em>🛑 Generation Stopped.</em></p>').run()
              break
            } else {
              editor
                .chain()
                .focus('end')
                .insertContent(failedSectionHtml(i, group.h2?.text, { showHeading: i !== 0 }))
                .run()
            }
          }

          setSectionProgress({ done: i + 1, total: groupedSections.length })
        }

        if (!isCancelled) {
          setIsGenerating(false)
          setWaitBanner('')
          setCurrentIndex(outline.length)
          editor.setEditable(true)
          clearUploadedMedia(settings.uploadedMedia)
        }

        return
      }

      const resultsBuffer = new Array(groupedSections.length).fill(null)
      const flushed = new Array(groupedSections.length).fill(false)
      let nextInsertIdx = 0

      // Hidden anchors keep finished sections in outline order.
      // Do not show "Writing: {title}" — "AI is currently writing" already names the section.
      // Yellow boxes are only inserted later for a wait or retry message.
      for (let wi = 0; wi < groupedSections.length; wi++) {
        upsertWaitInEditor(editor, wi, '')
      }

      const liveUsedMedia = new Set((settings.usedImageUrls || []).map(mediaKey).filter(Boolean))

      if (settings.heroImage) {
        liveUsedMedia.add(mediaKey(settings.heroImage))

        if (settings.heroImageId != null) {
          liveUsedMedia.add(mediaKey({ id: settings.heroImageId, source: settings.heroImageSource || 'img' }))
        }
      }

      genContextRef.current = {
        groupedSections,
        settings,
        outline,
        liveUsedMedia,
        trackedImages,
        trackedInternalLinks,
        trackedExternalLinks
      }

      let shared = settings.type === 'product-comparison' ? settings.comparisonShared : null

      if (settings.type !== 'product-comparison') {
        try {
          const prepStarted = Date.now()

          const prepRes = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current?.signal,
            body: JSON.stringify({
              mode: 'prepare',
              settings,
              targetKeyword: settings.targetKeyword
            })
          })

          const prep = await prepRes.json()

          if (
            !prepRes.ok &&
            (prepRes.status === 402 ||
              ['WORD_LIMIT', 'PAID_KEYS_FAILED', 'PRO_REQUIRED', 'FEATURE_OFF'].includes(prep?.code))
          ) {
            const message =
              prep?.code === 'PAID_KEYS_FAILED'
                ? 'Low credits. Generation stopped.'
                : serializeError(prep?.error || prep) ||
                  'Free word limit reached. Generation stopped. Upgrade to Pro to continue this article.'

            const safe = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

            editor
              .chain()
              .focus('end')
              .insertContent(
                `<p class="word-limit-notice" data-word-limit="1" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;line-height:1.5;">${safe}</p>`
              )
              .run()
            setIsGenerating(false)
            setWaitBanner('')
            editor.setEditable(true)

            return
          }

          if (prep?.success) shared = prep.shared
          console.info(`[writer] prepare ms=${Date.now() - prepStarted}`)
        } catch (error) {
          if (error?.name === 'AbortError') return
        }
      }

      const CONCURRENCY = Math.max(1, groupedSections.length)
      let haltNotice = false

      const placeAt = (index, html) => {
        const current = editor.getHTML()

        const re = new RegExp(
          `<p[^>]*(?:data-wait-section="${index}"|wait-section-${index})[^>]*>[\\s\\S]*?<\\/p>`,
          'i'
        )

        if (re.test(current)) {
          editor.commands.setContent(current.replace(re, html), false)
        } else {
          editor.chain().focus('end').insertContent(html).run()
        }
      }

      const tryFlush = () => {
        for (let idx = 0; idx < groupedSections.length; idx++) {
          if (flushed[idx] || resultsBuffer[idx] == null) continue
          const { i, group, data, error } = resultsBuffer[idx]

          flushed[idx] = true
          setCurrentIndex(group.originalIndex)

          if (error) {
            if (error.noRetry) {
              if (!haltNotice) {
                haltNotice = true

                const message =
                  error.code === 'PAID_KEYS_FAILED'
                    ? 'Low credits. Generation stopped.'
                    : error.code === 'PRO_REQUIRED' || error.code === 'MAX_REQUIRED'
                      ? error.message || 'This feature requires a higher plan.'
                      : 'Free word limit reached. Generation stopped. Upgrade to Pro to continue this article.'

                const safe = String(message).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')

                placeAt(
                  i,
                  `<p class="word-limit-notice" data-word-limit="1" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;line-height:1.5;">${safe}</p>`
                )
              } else {
                removeWaitInEditor(editor, i)
              }
            } else if (haltNotice || error.silentHalt) {
              removeWaitInEditor(editor, i)
            } else if (error.name === 'AbortError') {
              placeAt(i, '<p><em>Generation stopped.</em></p>')
            } else {
              placeAt(i, failedSectionHtml(i, group.h2?.text, { showHeading: i !== 0 }))
            }
          } else if (data?.skipped) {
            placeAt(i, failedSectionHtml(i, group.h2?.text, { showHeading: i !== 0 }))
          } else {
            placeAt(i, processAndInsertSection(i, group, data))

            if (data?.mediaUrl) trackedImages.push(mediaKey(data.mediaUrl))
            if (data?.mediaId) trackedImages.push(mediaKey(data.mediaId))
            if (data?.internalLinkUrl) trackedInternalLinks.push(data.internalLinkUrl)
          }
        }

        const done = flushed.filter(Boolean).length

        setSectionProgress({ done, total: groupedSections.length })

        if (done < groupedSections.length) {
          setWaitBanner(`Finished ${done} of ${groupedSections.length} sections`)
          const pending = flushed.findIndex(item => !item)

          if (pending >= 0) setCurrentIndex(groupedSections[pending].originalIndex)
        } else if (!isCancelled) {
          setIsGenerating(false)
          setWaitBanner('')
          setCurrentIndex(outline.length)
          editor.setEditable(true)
          clearUploadedMedia(settings.uploadedMedia)
        }
      }

      const sleep = ms => new Promise(r => setTimeout(r, ms))

      const fetchWithRetry = async (url, options, { onRetry } = {}) => {
        const delaysSec = [8]
        const SECTION_TIMEOUT_MS = 90_000

        let lastErr = null

        for (let attempt = 0; attempt <= delaysSec.length; attempt++) {
          try {
            const timeoutCtrl = new AbortController()
            const timer = setTimeout(() => timeoutCtrl.abort(), SECTION_TIMEOUT_MS)

            const parentSignal = options.signal
            const onParentAbort = () => timeoutCtrl.abort()

            if (parentSignal) {
              if (parentSignal.aborted) timeoutCtrl.abort()
              else parentSignal.addEventListener('abort', onParentAbort, { once: true })
            }

            let res

            try {
              res = await fetch(url, { ...options, signal: timeoutCtrl.signal })
            } finally {
              clearTimeout(timer)
              if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort)
            }

            const data = await res.json().catch(() => ({}))

            if (data?.skipped) return data
            if (res.ok) return data

            const code = data?.code || (res.status === 402 ? 'WORD_LIMIT' : '')
            const stopCodes = new Set(['WORD_LIMIT', 'PRO_REQUIRED', 'PAID_KEYS_FAILED', 'FEATURE_OFF'])

            if (stopCodes.has(code) || res.status === 402) {
              const err = new Error(serializeError(data?.error || data) || 'Stopped')

              err.code = code || 'WORD_LIMIT'
              err.noRetry = true
              throw err
            }

            lastErr = new Error(serializeError(data?.error || data) || `HTTP ${res.status}`)
          } catch (e) {
            if (e?.noRetry) throw e
            if (e?.name === 'AbortError' && options.signal?.aborted) throw e
            lastErr = e?.name === 'AbortError' ? new Error('Section timed out after 90s') : e
          }

          if (attempt < delaysSec.length) {
            const sec = delaysSec[attempt]

            onRetry?.(`Waiting ${sec}s, then retrying…`)
            await sleep(sec * 1000)
          }
        }

        throw lastErr || new Error('Generation failed after retries')
      }

      let cursor = 0

      const workers = Array.from({ length: Math.min(CONCURRENCY, groupedSections.length) }, async () => {
        while (cursor < groupedSections.length) {
          if (isCancelled) return
          const i = cursor++
          const group = groupedSections[i]

          const shouldGenerateMedia = i === 0 && settings.heroImage ? false : settings.aiImagesAndVideos
          const subheadings = group.h3s.map(h3 => h3.text)

          let allLinks = Array.isArray(settings.internalLinking) ? [...settings.internalLinking] : []

          if (settings.customInternalLink) {
            const customLinks = settings.customInternalLink
              .split(',')
              .map(l => l.trim())
              .filter(Boolean)

            allLinks = [...allLinks, ...customLinks]
          }

          const usedSnapshot = Array.from(liveUsedMedia)

          const setWait = msg => {
            setWaitBanner(msg)
            if (msg) upsertWaitInEditor(editor, i, msg)
          }

          try {
            const data = await fetchWithRetry(
              '/api/generate',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                  mode: 'section',
                  settings: settings,
                  targetKeyword: settings.targetKeyword,
                  model: settings.model,
                  outlineContext: outline,
                  heading: group.h2.text,
                  subheadings: subheadings,
                  internalLinks: allLinks,
                  seoOptimization: settings.seoOptimization,
                  manualKeywords: settings.manualKeywords,
                  aiImagesAndVideos: shouldGenerateMedia,
                  sectionIndex: i,
                  totalSections: groupedSections.length,
                  toneOfVoice: settings.toneOfVoice,
                  customToneOfVoice: settings.customToneOfVoice,
                  language: settings.language,
                  country: settings.country,
                  pointOfView: settings.pointOfView,
                  useRealTimeSearchData: settings.useRealTimeSearchData,
                  realTimeDataSource: settings.realTimeDataSource,
                  externalLinks: settings.fetchedExternalLinks,
                  usedExternalLinks: trackedExternalLinks,
                  deepSearch: false,
                  articleTitle: settings.generatedTitle,
                  improveReadability: settings.improveReadability,
                  uploadedMedia: settings.uploadedMedia,
                  usedImageUrls: usedSnapshot,
                  usedInternalLinks: trackedInternalLinks,
                  shared: shared || (settings.type === 'product-comparison' ? settings.comparisonShared : null)
                })
              },
              { onRetry: setWait }
            )

            if (isCancelled) return

            resultsBuffer[i] = { i, group, data, error: null }
          } catch (error) {
            if (isCancelled && !error?.noRetry) {
              resultsBuffer[i] = {
                i,
                group,
                data: null,
                error: Object.assign(error?.name === 'AbortError' ? error : new Error('stopped'), {
                  silentHalt: true,
                  name: 'AbortError'
                })
              }
            } else {
              if (error?.noRetry) {
                isCancelled = true
                abortControllerRef.current?.abort()
              }

              resultsBuffer[i] = { i, group, data: null, error }
            }
          }

          tryFlush()
        }
      })

      await Promise.all(workers)
    }

    generateArticleSequentially()

    return () => {
      isCancelled = true

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [editor, outline, settings.targetKeyword, settings.model, settings.generatedTitle])

  useEffect(() => {
    if (!editor || !draftId) return

    const fetchAndLoadDraft = async () => {
      try {
        const res = await fetch('/api/drafts')
        const data = await res.json()

        if (data.articles) {
          const draft = data.articles.find(a => a.id === draftId)

          if (draft) {
            editor.commands.setContent(draft.content)
            setPublishTitle(draft.title)

            const imgMatch = draft.content.match(/<img[^>]+src=["']([^"']+)["']/i)
            const draftImage = imgMatch ? imgMatch[1] : ''

            if (typeof setSettings === 'function') {
              setSettings(prev => ({
                ...prev,
                metaTitle: data.generatedMetaTitle,
                metaDescription: data.generatedMetaDescription,
                generatedTitle: draft.title,
                heroImage: draftImage || prev.heroImage
              }))
            }

            if (draft.outline && setOutline) {
              try {
                const parsedOutline = JSON.parse(draft.outline)

                setOutline(parsedOutline)
              } catch (e) {
                console.error('Failed to parse outline JSON:', e)
              }
            }

            if (draft.targetSite) {
              setSiteSelectionType(draft.targetSite)
            }
          }
        }
      } catch (error) {
        toast.error(serializeError(error))
      } finally {
        setIsGenerating(false)
        setWaitBanner('')
      }
    }

    fetchAndLoadDraft()
  }, [editor, draftId])

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setIsGenerating(false)
    setWaitBanner('')
    if (editor) editor.setEditable(true)
    clearUploadedMedia(settings.uploadedMedia)
  }

  const retrySection = async index => {
    const ctx = genContextRef.current

    if (!ctx || !editor) return

    const group = ctx.groupedSections[index]

    if (!group) return

    const btn = editor.view.dom.querySelector(`[data-retry-section="${index}"]`)

    const iconHtml =
      '<i class="ri-refresh-line" style="font-size:20px;line-height:1;pointer-events:none;display:block;"></i>'

    if (btn) {
      btn.disabled = true
      btn.style.opacity = '0.72'
      btn.style.cursor = 'wait'

      btn.innerHTML = '<span style="font-size:16px;font-weight:800;line-height:1;pointer-events:none;">…</span>'
    }

    setWaitBanner('Retrying section…')

    try {
      const subheadings = group.h3s.map(h => h.text)
      let allLinks = Array.isArray(ctx.settings.internalLinking) ? [...ctx.settings.internalLinking] : []

      if (ctx.settings.customInternalLink) {
        allLinks = [
          ...allLinks,
          ...ctx.settings.customInternalLink
            .split(',')
            .map(l => l.trim())
            .filter(Boolean)
        ]
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'section',
          settings: ctx.settings,
          targetKeyword: ctx.settings.targetKeyword,
          model: ctx.settings.model,
          outlineContext: ctx.outline,
          heading: group.h2.text,
          subheadings,
          internalLinks: allLinks,
          seoOptimization: ctx.settings.seoOptimization,
          manualKeywords: ctx.settings.manualKeywords,
          aiImagesAndVideos: ctx.settings.aiImagesAndVideos,
          sectionIndex: index,
          totalSections: ctx.groupedSections.length,
          toneOfVoice: ctx.settings.toneOfVoice,
          customToneOfVoice: ctx.settings.customToneOfVoice,
          language: ctx.settings.language,
          country: ctx.settings.country,
          pointOfView: ctx.settings.pointOfView,
          useRealTimeSearchData: ctx.settings.useRealTimeSearchData,
          realTimeDataSource: ctx.settings.realTimeDataSource,
          externalLinks: ctx.settings.fetchedExternalLinks,
          usedExternalLinks: ctx.trackedExternalLinks,
          deepSearch: false,
          articleTitle: ctx.settings.generatedTitle,
          improveReadability: ctx.settings.improveReadability,
          uploadedMedia: ctx.settings.uploadedMedia,
          usedImageUrls: Array.from(ctx.liveUsedMedia || []),
          usedInternalLinks: ctx.trackedInternalLinks
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!data?.success || !data?.text || data.text.trim().length < 30) {
        if (btn) {
          btn.disabled = false
          btn.style.opacity = '1'
          btn.style.cursor = 'pointer'
          btn.innerHTML = iconHtml
        }

        setWaitBanner('Still rate limited — try again in a minute.')

        return
      }

      const tag = group.h2?.type === 'h3' ? 'h3' : 'h2'

      const headingHtml =
        index !== 0 && group.h2
          ? `<${tag}>${String(group.h2.text)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</${tag}>`
          : ''

      let mediaHtml = data.mediaHtml || ''
      const mediaKeysToAdd = []

      const candidateKeys = [data.mediaUrl, data.mediaId].filter(Boolean).flatMap(v => {
        const keys = [mediaKey(v)]

        if (/^[a-zA-Z0-9_-]{11}$/.test(String(v))) {
          keys.push(mediaKey({ id: v, source: 'youtube' }))
        }

        return keys
      })

      const alreadyUsed = candidateKeys.some(k => ctx.liveUsedMedia.has(k))

      if (alreadyUsed) {
        mediaHtml = ''
      } else {
        candidateKeys.forEach(k => {
          if (k) {
            ctx.liveUsedMedia.add(k)
            mediaKeysToAdd.push(k)
          }
        })
      }

      const bodyHtml = sectionTextToHtml(data.text, ctx.settings?.language) + mediaHtml + (data.mapHtml || '')
      const replacement = headingHtml + bodyHtml

      let html = editor.getHTML()

      const patterns = [
        new RegExp(
          `<h2[^>]*data-failed-heading="${index}"[^>]*>[\\s\\S]*?<\\/h2>\\s*<p[^>]*(?:data-failed-section="${index}"|failed-section-${index})[^>]*>[\\s\\S]*?<\\/p>`,
          'i'
        ),

        new RegExp(
          `<div[^>]*data-failed-section="${index}"[^>]*>[\\s\\S]*?<\\/div>\\s*<p[^>]*(?:data-failed-section="${index}"|failed-section-${index})[^>]*>[\\s\\S]*?<\\/p>`,
          'i'
        ),

        new RegExp(
          `(?:<button[^>]*data-retry-section="${index}"[^>]*>[\\s\\S]*?<\\/button>\\s*)?<p[^>]*(?:data-failed-section="${index}"|failed-section-${index})[^>]*>[\\s\\S]*?<\\/p>`,
          'i'
        )
      ]

      let replaced = false

      for (const re of patterns) {
        if (re.test(html)) {
          html = html.replace(re, replacement)
          replaced = true
          break
        }
      }

      if (replaced) {
        editor.commands.setContent(html, false)
      } else {
        editor.chain().focus('end').insertContent(replacement).run()
      }

      if (data.mediaUrl) {
        ctx.liveUsedMedia.add(mediaKey(data.mediaUrl))

        if (/^[a-zA-Z0-9_-]{11}$/.test(String(data.mediaUrl))) {
          ctx.liveUsedMedia.add(mediaKey({ id: data.mediaUrl, source: 'youtube' }))
        }
      }

      if (data.mediaId) ctx.liveUsedMedia.add(mediaKey(data.mediaId))
      if (data.internalLinkUrl) ctx.trackedInternalLinks.push(data.internalLinkUrl)
      setWaitBanner('')
    } catch (e) {
      if (btn) {
        btn.disabled = false
        btn.style.opacity = '1'
        btn.style.cursor = 'pointer'
        btn.innerHTML = iconHtml
      }

      setWaitBanner('Retry failed.')
    }
  }

  useEffect(() => {
    if (!editor) return
    const root = editor.view.dom

    let lastMapOpen = 0

    const onClick = e => {
      const btn = e.target?.closest?.('[data-retry-section]')

      if (btn) {
        e.preventDefault()
        retrySection(Number(btn.getAttribute('data-retry-section')))

        return
      }

      const mapImg = e.target?.closest?.('img[data-map-href]')

      if (mapImg) {
        const href = mapImg.getAttribute('data-map-href')

        if (href && href !== '#') {
          e.preventDefault()
          e.stopPropagation()
          const now = Date.now()

          if (now - lastMapOpen > 800) {
            lastMapOpen = now
            window.open(href, '_blank', 'noopener,noreferrer')
          }
        }

        return
      }

      const ytImg = e.target?.closest?.('img[data-youtube-href]')

      if (ytImg) {
        const href = ytImg.getAttribute('data-youtube-href')

        if (href && href !== '#') {
          e.preventDefault()
          e.stopPropagation()
          const now = Date.now()

          if (now - lastMapOpen > 800) {
            lastMapOpen = now
            window.open(href, '_blank', 'noopener,noreferrer')
          }
        }

        return
      }

      const anchor = e.target?.closest?.('a[href]')

      if (!anchor || !root.contains(anchor)) return

      const href = anchor.getAttribute('href') || ''

      if (href === '#') return

      const isMaps = /google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl/i.test(href)
      const isYoutube = /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed\/)/i.test(href)

      if (!isMaps && !isYoutube) return

      e.preventDefault()
      e.stopPropagation()

      const now = Date.now()

      if (now - lastMapOpen < 800) return

      lastMapOpen = now
      window.open(href, '_blank', 'noopener,noreferrer')
    }

    root.addEventListener('click', onClick, true)

    return () => root.removeEventListener('click', onClick, true)
  }, [editor])

  const handleDownloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setExportAnchorEl(null)
  }

  const handleCopyClipboard = content => {
    navigator.clipboard.writeText(content)
    alert('Copied to clipboard!')
    setExportAnchorEl(null)
  }

  const performExport = action => {
    if (!editor) return
    const currentHtml = linkMapSnapshots(editor.getHTML())
    const fileNameBase = (settings.generatedTitle || 'article').replace(/[^a-z0-9]/gi, ' ').toLowerCase()

    const identity = {
      language: settings.language,
      articleType: settings.type || '',
      settings
    }

    const exportHtml = finalizeArticleHtml(currentHtml, identity)
    const identityComment = buildArticleIdentityMarker(settings.type, settings).match(/<!--([\s\S]*?)-->/)
    const markdown = `${convertHtmlToMarkdown(currentHtml)}${identityComment ? `\n\n<!--${identityComment[1]}-->` : ''}`

    if (action === 'copy-html') {
      handleCopyClipboard(exportHtml)
    } else if (action === 'download-html') {
      handleDownloadFile(
        exportHtml,
        `${fileNameBase
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')}.html`,
        'text/html'
      )
    } else if (action === 'copy-md') {
      handleCopyClipboard(markdown)
    } else if (action === 'download-md') {
      handleDownloadFile(
        markdown,
        `${fileNameBase
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')}` + '.md',
        'text/markdown'
      )
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <Typography variant='h4' className='font-bold'>
          Article Generation
        </Typography>
        <div className='flex gap-3'>
          <Button variant='outlined' color='secondary' onClick={() => setStep(1)} disabled={isGenerating}>
            Back to Outline
          </Button>

          {isGenerating ? (
            <Button variant='contained' color='error' onClick={handleStopGeneration}>
              Stop Generation
            </Button>
          ) : (
            <>
              <Button
                variant='contained'
                color='primary'
                onClick={e => setExportAnchorEl(e.currentTarget)}
                endIcon={<i className='ri-arrow-down-s-line' />}
              >
                Export Article
              </Button>
              <Menu
                anchorEl={exportAnchorEl}
                open={isExportMenuOpen}
                onClose={() => setExportAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={() => performExport('copy-html')}>
                  <ListItemIcon>
                    <i className='ri-file-copy-line text-lg' />
                  </ListItemIcon>
                  <ListItemText>Copy HTML</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => performExport('download-html')}>
                  <ListItemIcon>
                    <i className='ri-download-line text-lg' />
                  </ListItemIcon>
                  <ListItemText>Download HTML</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => performExport('copy-md')}>
                  <ListItemIcon>
                    <i className='ri-file-text-line text-lg' />
                  </ListItemIcon>
                  <ListItemText>Copy Markdown</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => performExport('download-md')}>
                  <ListItemIcon>
                    <i className='ri-markdown-line text-lg' />
                  </ListItemIcon>
                  <ListItemText>Download Markdown</ListItemText>
                </MenuItem>
              </Menu>
              {modeOf('wp-publish') === 'off' ? null : (
                <Button variant='contained' color='success' onClick={() => setPublishDialogOpen(true)}>
                  Publish to WP
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Card className='shadow-sm'>
        <CardContent className='p-8'>
          <div className='flex items-center justify-between mbe-8'>
            <Typography variant='h3' className='font-bold capitalize'>
              {settings.generatedTitle || settings.targetKeyword}
            </Typography>

            {isGenerating && (
              <div className='flex items-center gap-3'>
                <ProgressCircularWithLabel value={progressPercentage} color={currentProgressColor} />
                <Typography variant='body2' className='font-bold' color={currentProgressColor}>
                  AI is writing...
                </Typography>
              </div>
            )}
          </div>

          <div className='border rounded-md min-h-[500px] flex flex-col'>
            <EditorToolbar editor={editor} />
            <Divider />

            <div className='flex-1 flex flex-col'>
              <style>{`
                .ProseMirror .retry-section-btn {
                  flex-shrink: 0;
                  width: 40px;
                  height: 40px;
                  padding: 0;
                  border: none;
                  border-radius: 10px;
                  background: #8C57FF;
                  color: #fff;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 8px rgba(140, 87, 255, 0.35);
                  vertical-align: middle;
                  margin-left: 12px;
                  pointer-events: auto;
                }
                .ProseMirror .retry-section-btn:hover { background: #7C3AED; }
                .ProseMirror .retry-section-btn:disabled { opacity: 0.72; cursor: wait; }
                .ProseMirror .retry-section-btn i { pointer-events: none; }
                .ProseMirror p.wait-anchor {
                  display: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  height: 0 !important;
                  overflow: hidden !important;
                  border: 0 !important;
                  background: transparent !important;
                }
                .ProseMirror h2[data-failed-heading] {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 12px;
                }
                ${getAffigenieArticleCss()}
              `}</style>
              <EditorContent editor={editor} />

              {isGenerating &&
                currentIndex < outline.length &&
                (settings.deepSearch ? (
                  <div className='flex flex-col gap-3 px-6 pb-6 mt-4 w-full'>
                    <div className='flex justify-between items-center w-full'>
                      <Typography variant='caption' className='italic font-medium' color={deepSearchColor}>
                        {pollingStatus
                          ? pollingStatus
                          : `AI is currently writing: ${outline[currentIndex]?.text || '...'}`}
                      </Typography>

                      {deepSearchProgress > 0 && (
                        <Typography variant='caption' className='font-bold' color={deepSearchColor}>
                          ~{deepSearchProgress}%
                        </Typography>
                      )}
                    </div>

                    <div className='w-full'>
                      <BorderLinearProgress
                        variant={deepSearchProgress > 0 ? 'determinate' : 'indeterminate'}
                        value={deepSearchProgress > 0 ? deepSearchProgress : undefined}
                        color={deepSearchColor}
                      />
                    </div>
                  </div>
                ) : (
                  <div className='flex flex-col gap-2 px-6 pb-6 mt-2'>
                    <div className='flex items-center gap-2'>
                      <CircularProgress variant='indeterminate' size={24} color={currentProgressColor} />
                      <Typography variant='caption' className='italic font-medium' color={currentProgressColor}>
                        AI is currently writing: {outline[currentIndex]?.text || '...'}
                      </Typography>
                    </div>
                    {waitBanner ? (
                      <Typography
                        variant='caption'
                        sx={{
                          bgcolor: '#FEF3C7',
                          color: '#92400E',
                          border: '1px solid #F59E0B',
                          borderRadius: 1,
                          px: 1.5,
                          py: 1,
                          display: 'block'
                        }}
                      >
                        {waitBanner}
                      </Typography>
                    ) : null}
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          {publishSuccessData?.type === 'unauthenticated'
            ? 'Authentication Required'
            : publishSuccessData?.type === 'draft-success'
              ? '🎉 Draft Saved!'
              : publishSuccessData?.type === 'wp-draft-success'
                ? '📝 Sent to WordPress Drafts'
                : publishSuccessData
                  ? '🎉 Successfully Published!'
                  : 'Publish to WordPress'}
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4 mt-2'>
          {publishSuccessData?.type === 'unauthenticated' ? (
            <div className='flex flex-col items-center justify-center p-6 text-center gap-4'>
              <div className='text-red-500 text-6xl'>
                <i className='ri-error-warning-line' />
              </div>
              <Typography variant='h6'>You must be logged in to save a draft.</Typography>
              <Button variant='contained' color='primary' onClick={() => router.push('/login')}>
                Go to Login
              </Button>
            </div>
          ) : publishSuccessData?.type === 'draft-success' ? (
            <div className='flex flex-col items-center justify-center p-6 text-center gap-4'>
              <div className='text-green-500 text-6xl'>
                <i className='ri-check-line' />
              </div>
              <Typography variant='h6'>Your article has been saved to drafts!</Typography>
              <Button variant='contained' color='primary' onClick={() => router.push('/drafts')}>
                View My Drafts
              </Button>
            </div>
          ) : publishSuccessData?.type === 'wp-draft-success' ? (
            <div className='flex flex-col items-center justify-center p-6 text-center gap-4'>
              <div className='text-orange-500 text-6xl'>
                <i className='ri-draft-line' />
              </div>
              <Typography variant='h6'>Saved as a WordPress draft</Typography>
              <Typography variant='body2' color='text.secondary'>
                It will appear under Posts → Drafts. Your writer can open it and click Schedule.
              </Typography>
              {publishSuccessData.editLink && (
                <Button
                  variant='contained'
                  color='warning'
                  href={publishSuccessData.editLink}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Open Draft in WP Admin
                </Button>
              )}
            </div>
          ) : publishSuccessData ? (
            <div className='flex flex-col items-center justify-center p-6 text-center gap-4'>
              <div className='text-green-500 text-6xl'>
                <i className='ri-check-line' />
              </div>
              <Typography variant='h6'>Your article is live!</Typography>
              <Button
                variant='contained'
                color='primary'
                href={publishSuccessData.link}
                target='_blank'
                rel='noopener noreferrer'
              >
                View Article on Website
              </Button>
            </div>
          ) : (
            <>
              <TextField
                label='Article Title'
                fullWidth
                value={publishTitle}
                onChange={e => setPublishTitle(e.target.value)}
                helperText='This is exactly how the title will appear on your WordPress site.'
                sx={{ mt: 1.5 }}
              />

              <TextField
                label='Hero / Featured Image URL (Optional)'
                fullWidth
                placeholder='https://example.com/my-image.jpg'
                value={heroImageUrl}
                onChange={e => setHeroImageUrl(e.target.value)}
                helperText='Provide a direct link to an image. We will upload it to your WP Media Library.'
              />

              <FormControlLabel
                control={<Switch checked={trimTitleAndHero} onChange={e => setTrimTitleAndHero(e.target.checked)} />}
                label='Remove title and hero from the article body'
              />

              <Divider className='my-2' />

              <FormControl fullWidth size='small' className='mt-2'>
                <InputLabel>Select Target Site</InputLabel>
                <Select
                  value={siteSelectionType}
                  label='Select Target Site'
                  onChange={e => setSiteSelectionType(e.target.value)}
                >
                  <MenuItem value='cheekypetpark'>Cheeky Pet Park</MenuItem>
                  <MenuItem value='webmarketics'>Web Marketics</MenuItem>
                  <MenuItem value='specialfootgear'>Special Foot Gear</MenuItem>
                  <MenuItem value='riderequips'>Rider Equips</MenuItem>
                  <MenuItem value='handfultool'>Handful Tool</MenuItem>
                  <MenuItem value='babiescarrier'>Babies Carrier</MenuItem>

                  {userSavedSites.length > 0 && <Divider />}
                  {userSavedSites.map(site => (
                    <MenuItem key={site.id} value={`db_${site.id}`}>
                      {site.name} (Saved)
                    </MenuItem>
                  ))}

                  <Divider />
                  <MenuItem value='custom'>➕ Add Custom WordPress Site</MenuItem>
                </Select>
              </FormControl>

              {siteSelectionType === 'custom' && (
                <div className='flex flex-col gap-3 p-4 border rounded-md bg-gray-50'>
                  <Typography variant='subtitle2' className='font-bold'>
                    Custom Site Credentials
                  </Typography>

                  <Alert severity='info' className='text-xs py-0'>
                    <strong>How to get an App Password:</strong> Go to your WordPress Admin Dashboard ➔{' '}
                    <strong>Users</strong> ➔ <strong>Profile</strong>. Scroll down to{' '}
                    <strong>Application Passwords</strong>, create a new one, and paste it below.
                  </Alert>

                  <TextField
                    label='Site Name (e.g., My Personal Blog)'
                    size='small'
                    value={customWPData.name || ''}
                    onChange={e => setCustomWPData({ ...customWPData, name: e.target.value })}
                  />
                  <TextField
                    label='WordPress Site URL'
                    placeholder='https://yourdomain.com'
                    size='small'
                    value={customWPData.url}
                    onChange={e => setCustomWPData({ ...customWPData, url: e.target.value })}
                  />
                  <TextField
                    label='WP Username'
                    size='small'
                    value={customWPData.username}
                    onChange={e => setCustomWPData({ ...customWPData, username: e.target.value })}
                  />
                  <TextField
                    label='Application Password'
                    type='password'
                    size='small'
                    value={customWPData.password}
                    onChange={e => setCustomWPData({ ...customWPData, password: e.target.value })}
                  />

                  <FormControlLabel
                    control={<Checkbox checked={saveSiteToDb} onChange={e => setSaveSiteToDb(e.target.checked)} />}
                    label='Save this site to my profile for future use'
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
        {!publishSuccessData && (
          <DialogActions className='p-4' sx={{ flexWrap: 'wrap', gap: 0 }}>
            <Button color='error' onClick={() => setPublishDialogOpen(false)} disabled={isPublishing}>
              Cancel
            </Button>
            <Button variant='contained' onClick={handleSaveDraftToDB} disabled={isPublishing || !publishTitle.trim()}>
              Save in App
            </Button>
            <Button
              variant='outlined'
              color='warning'
              onClick={() => handlePublishToWP('draft', settings.metaTitle, settings.metaDescription)}
              disabled={isPublishing || !publishTitle.trim()}
            >
              {isPublishing ? <CircularProgress size={24} /> : 'Send to WP Draft'}
            </Button>
            <Button
              variant='contained'
              color='success'
              onClick={() => handlePublishToWP('publish', settings.metaTitle, settings.metaDescription)}
              disabled={isPublishing || !publishTitle.trim()}
            >
              {isPublishing ? <CircularProgress size={24} /> : 'Publish Live'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </div>
  )
}

export default ArticleEditor

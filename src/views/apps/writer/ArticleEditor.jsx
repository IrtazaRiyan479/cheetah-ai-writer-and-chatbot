'use client'

import { useState, useEffect, useRef } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'

// Tiptap imports
import { Color } from '@tiptap/extension-color'
import { ListItem } from '@tiptap/extension-list-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'

// --- TIPTAP TOOLBAR COMPONENT ---
const EditorToolbar = ({ editor }) => {
  if (!editor) {
    return null
  }

  // Track active states and trigger re-renders
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

  return (
    <div className='flex flex-wrap gap-x-4 gap-y-2 p-5'>
      <Chip onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editorState.canBold} {...(editorState.isBold && { variant: 'tonal', color: 'primary' })} label='bold' />
      <Chip onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editorState.canItalic} {...(editorState.isItalic && { variant: 'tonal', color: 'primary' })} label='italic' />
      <Chip onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editorState.canStrike} {...(editorState.isStrike && { variant: 'tonal', color: 'primary' })} label='strike' />
      <Chip onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editorState.canCode} {...(editorState.isCode && { variant: 'tonal', color: 'primary' })} label='code' />
      <Chip onClick={() => editor.chain().focus().unsetAllMarks().run()} label='clear marks' />
      <Chip onClick={() => editor.chain().focus().clearNodes().run()} label='clear nodes' />
      <Chip onClick={() => editor.chain().focus().setParagraph().run()} {...(editorState.isParagraph && { variant: 'tonal', color: 'primary' })} label='paragraph' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} {...(editorState.isHeading1 && { variant: 'tonal', color: 'primary' })} label='h1' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} {...(editorState.isHeading2 && { variant: 'tonal', color: 'primary' })} label='h2' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} {...(editorState.isHeading3 && { variant: 'tonal', color: 'primary' })} label='h3' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} {...(editorState.isHeading4 && { variant: 'tonal', color: 'primary' })} label='h4' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} {...(editorState.isHeading5 && { variant: 'tonal', color: 'primary' })} label='h5' />
      <Chip onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} {...(editorState.isHeading6 && { variant: 'tonal', color: 'primary' })} label='h6' />
      <Chip onClick={() => editor.chain().focus().toggleBulletList().run()} {...(editorState.isBulletList && { variant: 'tonal', color: 'primary' })} label='bulletlist' />
      <Chip onClick={() => editor.chain().focus().toggleOrderedList().run()} {...(editorState.isOrderedList && { variant: 'tonal', color: 'primary' })} label='orderedlist' />
      <Chip onClick={() => editor.chain().focus().toggleCodeBlock().run()} {...(editorState.isCodeBlock && { variant: 'tonal', color: 'primary' })} label='codeblock' />
      <Chip onClick={() => editor.chain().focus().toggleBlockquote().run()} {...(editorState.isBlockquote && { variant: 'tonal', color: 'primary' })} label='blockquote' />
      <Chip onClick={() => editor.chain().focus().setHorizontalRule().run()} label='horizontal rule' />
      <Chip onClick={() => editor.chain().focus().setHardBreak().run()} label='hard break' />
      <Chip onClick={() => editor.chain().focus().undo().run()} disabled={!editorState.canUndo} label='undo' />
      <Chip onClick={() => editor.chain().focus().redo().run()} disabled={!editorState.canRedo} label='redo' />
      <Chip onClick={() => editor.chain().focus().setColor('var(--mui-palette-primary-main)').run()} label='primary' />
    </div>
  )
}

const extensions = [
  Color.configure({ types: [TextStyle.name, ListItem.name] }),
  TextStyle,
  StarterKit.configure({
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false }
  }),
  Placeholder.configure({ placeholder: 'AI is preparing to write...' })
]

// --- MAIN ARTICLE EDITOR COMPONENT ---
const ArticleEditor = ({ settings, setStep, outline }) => {
  const [isGenerating, setIsGenerating] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0) // Track which heading is currently being generated

  // Refs for tracking generation and aborting requests
  const abortControllerRef = useRef(null)
  const hasStartedRef = useRef(false)

  // Initialize the single editor instance
  const editor = useEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // Removed min-h-[500px] from here so the spinner sits directly under the active text
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-6 pb-2',
      },
    },
  })

  useEffect(() => {
    // Wait until the editor is fully initialized before generating
    if (!editor || hasStartedRef.current) return

    hasStartedRef.current = true
    let isCancelled = false

    // Initialize the AbortController for this run
    abortControllerRef.current = new AbortController()

    const generateArticleSequentially = async () => {
      setIsGenerating(true)

      // Loop through every item in the outline
      for (let i = 0; i < outline.length; i++) {
        if (isCancelled) break

        const section = outline[i]
        setCurrentIndex(i) // Update state to trigger UI spinner text

        // 1. Instantly append the outline heading to the editor as the active section starts
        const headingHtml = `<${section.type}>${section.text}</${section.type}>`
        editor.commands.insertContent(headingHtml)

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current.signal, // Attach the abort signal
            body: JSON.stringify({
              mode: 'section',
              targetKeyword: settings.targetKeyword,
              model: settings.model,
              outlineContext: outline,
              heading: section.text
            })
          })

          const data = await res.json()

          if (data.success) {
            // 2. Format the response and append it below the heading
            const formattedContent = `<p>${data.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
            editor.commands.insertContent(formattedContent)
          } else {
            editor.commands.insertContent(`<p><em>Error generating this section.</em></p>`)
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Generation stopped by user.')
            editor.commands.insertContent(`<p><em>[Generation Stopped]</em></p>`)
            break // Exit the loop entirely if stopped
          } else {
            console.error("Failed to generate section:", error)
            editor.commands.insertContent(`<p><em>Failed to fetch content.</em></p>`)
          }
        }
      }

      if (!isCancelled) {
        setIsGenerating(false)
        setCurrentIndex(outline.length) // Clear the spinner index
      }
    }

    // Start the loop
    generateArticleSequentially()

    return () => {
      isCancelled = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort() // Cancel any pending fetch requests if unmounted
      }
    }
  }, [editor, outline, settings.targetKeyword, settings.model])

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <Typography variant='h4' className='font-bold'>Article Generation</Typography>
        <div className='flex gap-3'>
          <Button variant='outlined' color='secondary' onClick={() => setStep(1)} disabled={isGenerating}>
            Back to Outline
          </Button>

          {/* Dynamically swap Export for Stop based on state */}
          {isGenerating ? (
            <Button variant='contained' color='error' onClick={handleStopGeneration}>
              Stop Generation
            </Button>
          ) : (
            <Button variant='contained' color='primary'>
              Export Article
            </Button>
          )}
        </div>
      </div>

      <Card className='shadow-sm'>
        <CardContent className='p-8'>
          <Typography variant='h3' className='font-bold mbe-8 capitalize'>
            {settings.targetKeyword || 'Generated Article'}
          </Typography>

          {/* SINGLE EDITOR CONTAINER */}
          {/* Added flex layout and min-h-[500px] here to contain the spinner cleanly */}
          <div className='border rounded-md min-h-[500px] flex flex-col'>
             <EditorToolbar editor={editor} />
             <Divider />

             <div className='flex-1 flex flex-col'>
               <EditorContent editor={editor} />

               {/* DYNAMIC LOADING INDICATOR */}
               {isGenerating && currentIndex < outline.length && (
                 <div className='flex items-center gap-2 text-textSecondary px-6 pb-6 mt-2'>
                   <CircularProgress size={16} />
                   <Typography variant='caption' className='italic'>
                     AI is writing: {outline[currentIndex].text}...
                   </Typography>
                 </div>
               )}
             </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}

export default ArticleEditor

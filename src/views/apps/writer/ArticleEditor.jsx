'use client'

import { useState, useEffect, useRef } from 'react'
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

// Tiptap imports
import { Color } from '@tiptap/extension-color'
import { ListItem } from '@tiptap/extension-list-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import { Node, mergeAttributes } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'


// --- TIPTAP TOOLBAR COMPONENT ---
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

  const insertAfterSelection = (content) => {
    const { to } = editor.state.selection
    editor.chain().focus().insertContentAt(to, content).run()
  }

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
      <Chip onClick={() => insertAfterSelection('<hr>')} label='horizontal rule' />
      <Chip onClick={() => insertAfterSelection('<br>')} label='hard break' />
      <Chip onClick={() => editor.chain().focus().undo().run()} disabled={!editorState.canUndo} label='undo' />
      <Chip onClick={() => editor.chain().focus().redo().run()} disabled={!editorState.canRedo} label='redo' />
      <Chip onClick={() => editor.chain().focus().setColor('var(--mui-palette-primary-main, #8C57FF)').run()} label='primary' />
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
      controls: { default: true },
    }
  },
  parseHTML() {
    return [{ tag: 'video' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { class: 'w-full aspect-video rounded-xl shadow-md my-6 max-w-3xl mx-auto block' })]
  },
})

const extensions = [
  TextStyle,
  Color.configure({ types: ['textStyle'] }),
  StarterKit.configure({
    heading: false,
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
      HTMLAttributes: { class: 'list-disc ml-8 my-4 space-y-2' }
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
      HTMLAttributes: { class: 'list-decimal ml-8 my-4 space-y-2' }
    },
    blockquote: {
      HTMLAttributes: { class: 'border-l-4 border-primary pl-4 py-2 my-4 italic text-textSecondary bg-actionHover/50 rounded-r-lg' }
    }
  }),
Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }).extend({
    renderHTML({ node, HTMLAttributes }) {
      const hasLevel = this.options.levels.includes(node.attrs.level)
      const level = hasLevel ? node.attrs.level : this.options.levels[0]
      const classes = {
        1: 'text-3xl font-extrabold mt-12 mb-6 text-textPrimary',
        2: 'text-2xl font-bold mt-10 mb-4 text-textPrimary',
        3: 'text-xl font-semibold mt-8 mb-3 text-textPrimary',
        4: 'text-lg font-bold mt-6 mb-2 text-textPrimary',
        5: 'text-base font-bold mt-4 mb-2 text-textPrimary',
        6: 'text-sm font-bold mt-4 mb-2 text-textSecondary uppercase tracking-wider',
      }
      return ['h' + level, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: classes[level] }), 0]
    }
  }),
  Placeholder.configure({ placeholder: 'Document ready.' }),
  Image.configure({
    inline: true,
    HTMLAttributes: {
      class: 'rounded-xl max-w-full sm:max-w-2xl mx-auto block shadow-md my-8 aspect-video object-cover'
    }
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-primary underline cursor-pointer',
    },
  }),
  Youtube.configure({
    controls: true,
    nocookie: true,
    HTMLAttributes: {
      class: 'w-full aspect-video rounded-xl shadow-md my-6'
    }
  }),
  Table.configure({ HTMLAttributes: { class: 'w-full border-collapse border border-divider my-8 text-left rounded-lg overflow-hidden shadow-sm' } }),
  TableRow.configure({ HTMLAttributes: { class: 'border-b border-divider hover:bg-actionHover/50 transition-colors' } }),
  TableHeader.configure({ HTMLAttributes: { class: 'bg-actionHover p-4 border border-divider font-bold text-textPrimary' } }),
  TableCell.configure({ HTMLAttributes: { class: 'p-4 border border-divider text-textSecondary' } }),
  VideoExtension
]

// --- HELPER: HTML to MARKDOWN CONVERTER ---
const convertHtmlToMarkdown = (html) => {
  if (!html) return ''
  let md = html
  // Headers
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5>(.*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6>(.*?)<\/h6>/gi, '###### $1\n\n')
  // Text formatting
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
  md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

  // Lists
  md = md.replace(/<ul>/gi, '\n')
  md = md.replace(/<\/ul>/gi, '\n')
  md = md.replace(/<ol>/gi, '\n')
  md = md.replace(/<\/ol>/gi, '\n')
  md = md.replace(/<li>(.*?)<\/li>/gi, '- $1\n')
  // Blocks
  md = md.replace(/<pre><code.*?>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
  md = md.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
  // Layout
  md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
  md = md.replace(/<br\s*\/?>/gi, '\n')
  md = md.replace(/<hr\s*\/?>/gi, '---\n\n')
  // Cleanup remaining HTML tags
  md = md.replace(/<[^>]*>?/gm, '')
  // Decode common HTML entities
  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  return md.trim()
}

// --- MAIN ARTICLE EDITOR COMPONENT ---
const ArticleEditor = ({ settings, setStep, outline }) => {
  const [isGenerating, setIsGenerating] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Export Menu State
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  const isExportMenuOpen = Boolean(exportAnchorEl)

  const abortControllerRef = useRef(null)
  const hasStartedRef = useRef(false)

  const editor = useEditor({
    extensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none p-6 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-textSecondary [&_hr]:border-t-2 [&_hr]:border-solid [&_hr]:border-gray-300 [&_hr]:my-8 [&_hr]:w-full',
      },
    },
  })

  useEffect(() => {
    if (!editor || hasStartedRef.current) return

    hasStartedRef.current = true
    let isCancelled = false
    abortControllerRef.current = new AbortController()

    const generateArticleSequentially = async () => {
      setIsGenerating(true)
      editor.setEditable(false)
      editor.commands.setContent('')

      const topTitle = settings.generatedTitle || settings.targetKeyword;
      editor.commands.setContent(`<h1>${topTitle}</h1><p></p>`);

      const groupedSections = []
      let currentH2Group = null

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

      for (let i = 0; i < groupedSections.length; i++) {
        if (isCancelled) break

        const group = groupedSections[i]
        setCurrentIndex(group.originalIndex)

        editor.chain().focus('end').insertContent('<' + group.h2.type + '>' + group.h2.text + '</' + group.h2.type + '>').run()
        const subheadings = group.h3s.map(h3 => h3.text)

        try {
          let allLinks = Array.isArray(settings.internalLinking) ? [...settings.internalLinking] : [];
          if (settings.customInternalLink) {
            const customLinks = settings.customInternalLink.split(',').map(l => l.trim()).filter(l => l);
            allLinks = [...allLinks, ...customLinks];
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
              internalLinks: allLinks,
              seoOptimization: settings.seoOptimization,
              manualKeywords: settings.manualKeywords,
              aiImagesAndVideos: settings.aiImagesAndVideos,
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
              deepSearch: settings.deepSearch,
              articleTitle: settings.generatedTitle,
              improveReadability: settings.improveReadability,
              uploadedMedia: settings.uploadedMedia
            })
          })

          const data = await res.json()

          if (data.success) {
            // 🟢 1. THE DEFINITIVE MARKDOWN PARSER
            let cleanMd = data.text.replace(/^##\s+.*$/gm, '') // Remove redundant main heading

            // A. CODE BLOCKS (Must happen first! Escape HTML so Tiptap doesn't execute it)
            cleanMd = cleanMd.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (match, code) => {
              const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
              return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-xl my-6 overflow-x-auto font-mono text-sm shadow-md border border-gray-700"><code>${escapedCode}</code></pre>`;
            });

            // B. TABLES
            cleanMd = cleanMd.replace(/(?:\|.*\|\n)+/g, (match) => {
              const rows = match.trim().split('\n');
              let html = '<table><tbody>';
              rows.forEach((row, index) => {
                if (row.match(/^\|?[\s:-]+\|?$/)) return; // Skip markdown separator row
                const isHeader = index === 0;
                const tag = isHeader ? 'th' : 'td';
                const cells = row.split('|').map(c => c.trim()).filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
                html += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
              });
              html += '</tbody></table>';
              return html;
            });

            // C. BLOCKQUOTES
            cleanMd = cleanMd.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>')
            cleanMd = cleanMd.replace(/<\/blockquote>\n<blockquote>/g, '<br/>')

            // D. LISTS
            // Convert unordered list items
            cleanMd = cleanMd.replace(/^[\s]*(?:-|\*)\s+(.*)$/gm, '<ul><li>$1</li></ul>')
            // Convert ordered list items
            cleanMd = cleanMd.replace(/^[\s]*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>')

            // 🟢 CRITICAL FIX 1: Merge adjacent identical lists using \s* to ignore weird line breaks
            cleanMd = cleanMd.replace(/<\/ul>\s*<ul>/g, '')
            cleanMd = cleanMd.replace(/<\/ol>\s*<ol>/g, '')

            // E. HEADINGS (H3 through H6)
            cleanMd = cleanMd.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
            cleanMd = cleanMd.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
            cleanMd = cleanMd.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
            cleanMd = cleanMd.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')

            // F. HORIZONTAL RULES
            cleanMd = cleanMd.replace(/^---$/gm, '<hr class="my-8 border-divider" />')

            // G. HALLUCINATED IMAGES (Catch ![alt](url) and force our UI styles)
            cleanMd = cleanMd.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-w-full sm:max-w-2xl mx-auto block shadow-md my-8 aspect-video object-cover" />')

            // H. LINKS
            cleanMd = cleanMd.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="text-primary underline font-medium">$1</a>')

            // I. INLINE FORMATTING (Bold, Italics, Code, Strike)
            cleanMd = cleanMd.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            cleanMd = cleanMd.replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '<em>$1</em>') // Safely catch italics
            cleanMd = cleanMd.replace(/(?<!\w)_(.*?)_(?!\w)/g, '<em>$1</em>') // Catch underscore italics
            cleanMd = cleanMd.replace(/`([^`]+)`/g, '<code class="bg-actionHover px-1.5 py-0.5 rounded text-primary font-mono text-sm border border-divider">$1</code>')
            cleanMd = cleanMd.replace(/~~(.*?)~~/g, '<s>$1</s>')

            // 🟢 CRITICAL FIX 2: Force double newlines around structural blocks before paragraph parsing.
            // If Tiptap sees <ul> inside <p>, it actively destroys the list structure!
            cleanMd = cleanMd.replace(/(<(ul|ol|table|blockquote|pre|hr|h[1-6]|img))/g, '\n\n$1')
            cleanMd = cleanMd.replace(/(<\/(ul|ol|table|blockquote|pre|h[1-6])>)/g, '$1\n\n')

            // J. SAFELY WRAP PARAGRAPHS
            let formattedContent = cleanMd
              .split(/\n\n+/)
              .map(block => {
                block = block.trim()
                if (!block) return ''
                // Do NOT wrap structural HTML block elements in <p> tags
                if (block.match(/^(<h|<ul|<ol|<blockquote|<pre|<table|<hr|<img)/)) return block
                return `<p>${block.replace(/\n/g, '<br/>')}</p>`
              })
              .join('')

            editor.chain().focus('end').insertContent(formattedContent).run()

            // 🟢 2. INJECT MEDIA AFTER THE TEXT
            if (data.mediaHtml) {
              editor.chain().focus('end').insertContent(data.mediaHtml).run()
            }
          } else {
            editor.chain().focus('end').insertContent("<p><em>❌ Error generating this section.</em></p>").run()
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            editor.chain().focus('end').insertContent("<p><em>🛑 Generation Stopped.</em></p>").run()
            break
          } else {
            editor.chain().focus('end').insertContent("<p><em>❌ Failed to fetch content.</em></p>").run()
          }
        }
      }

      if (!isCancelled) {
        setIsGenerating(false)
        setCurrentIndex(outline.length)
        editor.setEditable(true)
      }
    }

    generateArticleSequentially()

    return () => {
      isCancelled = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [editor, outline, settings.targetKeyword, settings.model, settings.generatedTitle])

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
    if (editor) editor.setEditable(true)
  }

  // --- EXPORT HANDLERS ---
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

  const handleCopyClipboard = (content) => {
    navigator.clipboard.writeText(content)
    alert("Copied to clipboard!")
    setExportAnchorEl(null)
  }

  const performExport = (action) => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    const fileNameBase = (settings.targetKeyword || 'article').replace(/[^a-z0-9]/gi, '_').toLowerCase()

    if (action === 'copy-html') {
      handleCopyClipboard(currentHtml)
    } else if (action === 'download-html') {
      handleDownloadFile(currentHtml, `${fileNameBase}.html`, 'text/html')
    } else if (action === 'copy-md') {
      handleCopyClipboard(convertHtmlToMarkdown(currentHtml))
    } else if (action === 'download-md') {
      handleDownloadFile(convertHtmlToMarkdown(currentHtml), "${fileNameBase}" + ".md", 'text/markdown')
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <Typography variant="h4" className="font-bold">Article Generation</Typography>
        <div className='flex gap-3'>
          <Button variant="outlined" color="secondary" onClick={() => setStep(1)} disabled={isGenerating}>
            Back to Outline
          </Button>

          {isGenerating ? (
            <Button variant="contained" color="error" onClick={handleStopGeneration}>
              Stop Generation
            </Button>
          ) : (
            <>
              <Button variant="contained" color="primary" onClick={(e) => setExportAnchorEl(e.currentTarget)}
                endIcon={<i className='ri-arrow-down-s-line' />}
              >
                Export Article
              </Button>
              <Menu anchorEl={exportAnchorEl} open={isExportMenuOpen} onClose={() => setExportAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={() => performExport('copy-html')}>
                  <ListItemIcon><i className='ri-file-copy-line text-lg' /></ListItemIcon>
                  <ListItemText>Copy HTML</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => performExport('download-html')}>
                  <ListItemIcon><i className='ri-download-line text-lg' /></ListItemIcon>
                  <ListItemText>Download HTML</ListItemText>
                </MenuItem>
                <Divider/>
                <MenuItem onClick={() => performExport('copy-md')}>
                  <ListItemIcon><i className='ri-file-text-line text-lg' /></ListItemIcon>
                  <ListItemText>Copy Markdown</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => performExport('download-md')}>
                  <ListItemIcon><i className='ri-markdown-line text-lg' /></ListItemIcon>
                  <ListItemText>Download Markdown</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-8">

          <div className='flex items-center justify-between mbe-8'>
          <Typography variant="h3" className="font-bold capitalize">
                {settings.generatedTitle || settings.targetKeyword}
              </Typography>

            {isGenerating && (
              <div className='flex items-center gap-2 text-primary'>
                <CircularProgress size={20} color="inherit"/>
                <Typography variant="body2" className="font-bold">AI is writing...</Typography>
              </div>
            )}
          </div>

          <div className='border rounded-md min-h-[500px] flex flex-col'>
             <EditorToolbar editor={editor}/>
             <Divider/>

             <div className='flex-1 flex flex-col'>
               <EditorContent editor={editor}/>

               {isGenerating && currentIndex < outline.length && (
                 <div className='flex items-center gap-2 text-textSecondary px-6 pb-6 mt-2'>
                   <CircularProgress size={16}/>
                   <Typography variant="caption" className="italic">
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

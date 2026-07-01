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
import { useRouter, useSearchParams } from 'next/navigation'


const ProgressCircularWithLabel = ({ value, color }) => {
  return (
    <div className='relative inline-flex'>
      <CircularProgress variant='determinate' value={value} color={color} size={40} />
      <div className='flex absolute top-0 left-0 right-0 bottom-0 items-center justify-center'>
        <Typography variant='caption' component='div' color='text.secondary' className="font-bold">
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
    borderRadius: 5,
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
  TaskList,
  TaskItem.configure({
    nested: true,
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
    allowBase64: true,
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

  md = md.replace(/<[^>]*>?/gm, '')

  md = md.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')

  md = md.replace(/\n{3,}/g, '\n\n')

  return md.trim()
}

// --- MAIN ARTICLE EDITOR COMPONENT ---
const ArticleEditor = ({ settings, setSettings, setStep, outline, setOutline }) => {
  const router = useRouter()
  const searchParams = useSearchParams()       // ADD THIS
  const draftId = searchParams.get('draftId')
  const [isGenerating, setIsGenerating] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Export Menu State
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  const isExportMenuOpen = Boolean(exportAnchorEl)

  const abortControllerRef = useRef(null)
  const hasStartedRef = useRef(false)

  const [pollingStatus, setPollingStatus] = useState('');
  const [deepSearchProgress, setDeepSearchProgress] = useState(0);

  const progressColors = ['secondary', 'success', 'error', 'warning', 'info', 'primary']
  const progressPercentage = outline && outline.length > 0 ? (currentIndex / outline.length) * 100 : 0
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
  const [publishSuccessData, setPublishSuccessData] = useState(null)

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

  const clearUploadedMedia = async (uploadedUrls) => {
  try {
    await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      // To delete specific files
      // body: JSON.stringify({ fileUrls: uploadedUrls })

      body: JSON.stringify({ clearAll: true })
    });
    console.log("Cleanup complete: Uploaded media removed.");
  } catch (error) {
    console.error("Failed to clear uploads:", error);
  }
};

  const handlePublishToWP = async (status = 'draft', metaTitle, metaDescription) => {
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

    let finalContent = editor?.getHTML() || '';
    let finalHeroImage = heroImageUrl;

   if (!finalHeroImage) {
      const imgMatch = finalContent.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch) {
        finalHeroImage = imgMatch[1];
      }
    }

    const stripTitleSites = ['handfultool', 'riderequips', 'cheekypetpark', 'specialfootgear', 'webmarketics'];
    const stripImageSites = ['specialfootgear', 'webmarketics'];

    if (!isCustom && !isDbSaved) {
      if (stripTitleSites.includes(activeSiteId)) {
        finalContent = finalContent.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
      }

      if (stripImageSites.includes(activeSiteId)) {
        const firstImageRegex = /<p>\s*<img[^>]+>\s*<\/p>|<img[^>]+>/i;
        finalContent = finalContent.replace(firstImageRegex, '');
      }
    }

    const payload = {
      title: publishTitle,
      content: finalContent,
      status: status,
      siteType: (isCustom || isDbSaved) ? 'custom' : 'predefined',
      siteId: (!isCustom && !isDbSaved) ? activeSiteId : null,
      customSite: (isCustom || isDbSaved) ? activeCustomData : null,
      featuredImageUrl: finalHeroImage,
      metaTitle: metaTitle,
      metaDescription: metaDescription
    }

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await res.json()
    if (result.success) {
      setPublishSuccessData({ link: result.link, id: result.wpPostId })
    } else {
      alert(`Error: ${result.error}`)
    }
  } catch (error) {
    console.error(error)
    alert("An error occurred while publishing.")
  } finally {
    setIsPublishing(false)
  }
}

const handleSaveDraftToDB = async () => {
  setIsPublishing(true);
  try {
    const sessionRes = await fetch('/api/auth/session');
    const session = await sessionRes.json();

    if (!session || !Object.keys(session).length) {
      setPublishSuccessData({ type: 'unauthenticated' });
      setIsPublishing(false);
      return;
    }

    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: publishTitle || settings?.generatedTitle || "Untitled Draft",
        content: editor?.getHTML() || '',
        outline: outline && outline.length > 0 ? JSON.stringify(outline) : null,
        status: 'draft',
        targetSite: siteSelectionType !== 'custom' ? siteSelectionType : null
      })
    });

    const data = await res.json();
    if (data.success) {
      setPublishSuccessData({ type: 'draft-success' });
    } else {
      alert("Error saving draft: " + data.error);
    }
  } catch (error) {
    console.error(error);
    alert("An unexpected error occurred while saving.");
  } finally {
    setIsPublishing(false);
  }
};

useEffect(() => {
  const fetchCustomSites = async () => {
    try {
      const res = await fetch('/api/custom-wp-sites')
      if (res.ok) {
        const data = await res.json()
        setUserSavedSites(data.sites || [])
      }
    } catch (error) {
      console.error("Failed to load custom sites", error)
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

      const topTitle = settings.generatedTitle || settings.targetKeyword;
      let initialContent = `<h1>${topTitle}</h1>`;

      if (settings.heroImage) {
        initialContent += `<p><img src="${settings.heroImage}" alt="${topTitle}" /></p>`;
      } else {
        initialContent += `<p></p>`;
      }

      editor.commands.setContent(initialContent);

      const groupedSections = []
      let currentH2Group = null

      let trackedImages = [];
      if (settings.heroImage) {
        trackedImages.push(settings.heroImage);
      }
      let trackedExternalLinks = [];

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


        if (i!=0) {
        editor.chain().focus('end').insertContent('<' + group.h2.type + '>' + group.h2.text + '</' + group.h2.type + '>').run()
        }
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
              usedExternalLinks: trackedExternalLinks,
              deepSearch: settings.deepSearch,
              articleTitle: settings.generatedTitle,
              improveReadability: settings.improveReadability,
              uploadedMedia: settings.uploadedMedia,
              usedImageUrls: trackedImages
            })
          })

          const data = await res.json()

          if (data.success) {
            let finalSectionText = data.text;

            if (data.mediaUrl) {
              trackedImages.push(data.mediaUrl);
            }

            // 🟢 NEW DEEP SEARCH POLLING LOGIC 🟢
           if (data.isDeepSearch && data.interactionId) {
              setPollingStatus(`Initializing Deep Research Agent...`);
              setDeepSearchProgress(5);

              let isCompleted = false;
              let pollCount = 0;

              while (!isCompleted) {
                if (isCancelled) break;

                await new Promise(resolve => setTimeout(resolve, 10000));
                pollCount++;

                if (pollCount === 1) setPollingStatus("Initializing Deep Search capabilities...");
                if (pollCount === 3) setPollingStatus("Running live web queries...");
                if (pollCount === 5) setPollingStatus("Scouring authoritative sources & extracting data...");
                if (pollCount === 8) setPollingStatus("Cross-referencing facts and checking statistics...");
                if (pollCount === 10) setPollingStatus("Analyzing semantic relevance and topic depth...");
                if (pollCount === 13) setPollingStatus("Synthesizing research into a comprehensive draft...");
                if (pollCount === 15) setPollingStatus("Expanding insights with secondary source validation...");
                if (pollCount === 18) setPollingStatus("Structuring content for optimal readability...");
                if (pollCount === 20) setPollingStatus("Applying strict SEO constraints and LSI keywords...");
                if (pollCount === 23) setPollingStatus("Polishing grammar and finalizing Markdown formatting...");
                if (pollCount === 25) setPollingStatus("Performing final quality checks...");

                const estimatedProgress = Math.min(95, 5 + Math.floor(pollCount * 2));
                setDeepSearchProgress(estimatedProgress);

                try {
                  const pollRes = await fetch(`/api/poll?id=${data.interactionId}`, {
                    signal: abortControllerRef.current.signal
                  });
                  const pollData = await pollRes.json();

                  if (pollData.status === 'completed') {
                    finalSectionText = pollData.text;
                    setDeepSearchProgress(100); // Snap to 100% when done
                    isCompleted = true;
                  } else if (pollData.status === 'failed') {
                    finalSectionText = `## ${group.h2.text}\n<p><em>❌ Deep Research failed for this section.</em></p>`;
                    isCompleted = true;
                  }
                } catch (pollError) {
                  if (pollError.name === 'AbortError') throw pollError;
                }
              }
              // Clear UI states after a short delay so the user sees 100%
              await new Promise(resolve => setTimeout(resolve, 1000));
              setPollingStatus('');
              setDeepSearchProgress(0);
            }

            if (settings.fetchedExternalLinks && settings.fetchedExternalLinks.length > 0) {
              const newlyUsedLinks = settings.fetchedExternalLinks.filter(link =>
                finalSectionText.includes(link) && !trackedExternalLinks.includes(link)
              );

              if (newlyUsedLinks.length > 0) {
                trackedExternalLinks.push(...newlyUsedLinks);
              }
            }

            // 🟢 1. THE DEFINITIVE MARKDOWN PARSER
            let cleanMd = finalSectionText.replace(/^##\s+.*$/gm, '') // Remove redundant main heading

            // A. CODE BLOCKS (Must happen first! Escape HTML so Tiptap doesn't execute it)
            cleanMd = cleanMd.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, (match, code) => {
              const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
              return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-xl my-6 overflow-x-auto font-mono text-sm shadow-md border border-gray-700"><code>${escapedCode}</code></pre>`;
            });

            // B. TABLES
            cleanMd = cleanMd.replace(/:\-\-+/g, '').replace(/\-\-+:/g, '');
            cleanMd = cleanMd.replace(/(?:\|.*\|\n)+/g, (match) => {
              const rows = match.trim().split('\n');
              let html = '<table><tbody>';
              rows.forEach((row, index) => {
                if (row.match(/^\|?[\s:|-]+\|?$/)) return;
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

            // F. IMAGES & LINKS
            cleanMd = cleanMd.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
            cleanMd = cleanMd.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

            // F. HORIZONTAL RULES
            cleanMd = cleanMd.replace(/^---$/gm, '<hr class="my-8 border-divider" />')

            // G. HALLUCINATED IMAGES (Catch ![alt](url) and force our UI styles)
            cleanMd = cleanMd.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl max-w-full sm:max-w-2xl mx-auto block shadow-md my-8 aspect-video object-cover" />')

            // H. LINKS
            cleanMd = cleanMd.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" class="text-primary underline font-medium">$1</a>')

          // H. RAW HTML BUTTON FIX
          //   cleanMd = cleanMd.replace(/<a([^>]+)>(.*?(?:Check Price|Amazon).*?)<\/a>/gi, (match, attributes, text) => {
          //   const hrefMatch = attributes.match(/href=["']([^"']+)["']/i);
          //   const href = hrefMatch ? hrefMatch[1] : '#';
          //   console.log("found")
          //   return `<a href="${href || '#'}" target="_blank" rel="sponsored noopener" class="no-underline bg-blue-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded inline-block">Check Price on Amazon</a>`;
          // });

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
            if (data.mediaHtml && (i !== 0 || !["blog", "listicle"].includes(settings.type))) {
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
            editor.chain().focus('end').insertContent(`<p><em>❌ Failed to fetch content. ${error}</em></p>`).run()
          }
        }
      }

      if (!isCancelled) {
        setIsGenerating(false)
        setCurrentIndex(outline.length)
        editor.setEditable(true)
        clearUploadedMedia(settings.uploadedMedia);
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

  useEffect(() => {
    if (!editor || !draftId) return;

    const fetchAndLoadDraft = async () => {
      try {
        const res = await fetch('/api/drafts');
        const data = await res.json();

        if (data.articles) {
          const draft = data.articles.find(a => a.id === draftId);
          if (draft) {
            editor.commands.setContent(draft.content);
            setPublishTitle(draft.title);

            const imgMatch = draft.content.match(/<img[^>]+src=["']([^"']+)["']/i);
            const draftImage = imgMatch ? imgMatch[1] : '';

            if (typeof setSettings === 'function') {
              setSettings(prev => ({
                ...prev,
                metaTitle: data.generatedMetaTitle,
                metaDescription: data.generatedMetaDescription,
                generatedTitle: draft.title,
                heroImage: draftImage || prev.heroImage
              }));
            }

            if (draft.outline && setOutline) {
              try {
                const parsedOutline = JSON.parse(draft.outline);
                setOutline(parsedOutline);
              } catch (e) {
                console.error("Failed to parse outline JSON:", e);
              }
            }

            if (draft.targetSite) {
              setSiteSelectionType(draft.targetSite);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load draft:", error);
        alert("Could not load your draft.");
      } finally {
        setIsGenerating(false);
      }
    };

    fetchAndLoadDraft();
  }, [editor, draftId]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
    if (editor) editor.setEditable(true)
    clearUploadedMedia(settings.uploadedMedia);
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
    const fileNameBase = (settings.generatedTitle || 'article').replace(/[^a-z0-9]/gi, ' ').toLowerCase()

    if (action === 'copy-html') {
      handleCopyClipboard(currentHtml)
    } else if (action === 'download-html') {
      handleDownloadFile(currentHtml, `${fileNameBase.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}.html`, 'text/html')
    } else if (action === 'copy-md') {
      handleCopyClipboard(convertHtmlToMarkdown(currentHtml))
    } else if (action === 'download-md') {
      handleDownloadFile(convertHtmlToMarkdown(currentHtml), `${fileNameBase.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}` + ".md", 'text/markdown')
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
              <Button
                variant="contained"
                color="success"
                onClick={() => setPublishDialogOpen(true)}
              >
                Publish to WP
              </Button>
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
              <div className='flex items-center gap-3'>
                <ProgressCircularWithLabel value={progressPercentage} color={currentProgressColor} />
                <Typography variant="body2" className="font-bold" color={currentProgressColor}>
                  AI is writing...
                </Typography>
              </div>
            )}
          </div>

          <div className='border rounded-md min-h-[500px] flex flex-col'>
             <EditorToolbar editor={editor}/>
             <Divider/>

             <div className='flex-1 flex flex-col'>
               <EditorContent editor={editor}/>

               {isGenerating && currentIndex < outline.length && (
                  settings.deepSearch ? (
                    <div className='flex flex-col gap-3 px-6 pb-6 mt-4 w-full'>
                      <div className="flex justify-between items-center w-full">
                        <Typography variant="caption" className="italic font-medium" color={deepSearchColor}>
                          {pollingStatus
                            ? pollingStatus
                            : `AI is currently writing: ${outline[currentIndex]?.text || '...'}`}
                        </Typography>

                        {deepSearchProgress > 0 && (
                          <Typography variant="caption" className="font-bold" color={deepSearchColor}>
                            ~{deepSearchProgress}%
                          </Typography>
                        )}
                      </div>

                      <div className="w-full">
                        <BorderLinearProgress
                          variant={deepSearchProgress > 0 ? "determinate" : "indeterminate"}
                          value={deepSearchProgress > 0 ? deepSearchProgress : undefined}
                          color={deepSearchColor}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2 px-6 pb-6 mt-2'>
                      <CircularProgress
                        variant="indeterminate"
                        size={24}
                        color={currentProgressColor}
                      />
                      <Typography variant="caption" className="italic font-medium" color={currentProgressColor}>
                        AI is currently writing: {outline[currentIndex]?.text || '...'}
                      </Typography>
                    </div>
                  )
                )}
             </div>
          </div>

        </CardContent>
      </Card>

      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {publishSuccessData?.type === 'unauthenticated' ? 'Authentication Required'
           : publishSuccessData?.type === 'draft-success' ? '🎉 Draft Saved!'
           : publishSuccessData ? '🎉 Successfully Published!'
           : 'Publish to WordPress'}
        </DialogTitle>
        <DialogContent className="flex flex-col gap-4 mt-2">

          {publishSuccessData?.type === 'unauthenticated' ? (
            <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="text-red-500 text-6xl">
                <i className="ri-error-warning-line" />
              </div>
              <Typography variant="h6">You must be logged in to save a draft.</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push('/login')}
              >
                Go to Login
              </Button>
            </div>
          ) : publishSuccessData?.type === 'draft-success' ? (
            <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="text-green-500 text-6xl">
                <i className="ri-check-line" />
              </div>
              <Typography variant="h6">Your article has been saved to drafts!</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => router.push('/drafts')}
              >
                View My Drafts
              </Button>
            </div>
          ) : publishSuccessData ? (
      <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="text-green-500 text-6xl">
          <i className="ri-check-line" />
        </div>
        <Typography variant="h6">Your article is live (or saved as draft)!</Typography>
        <Button
          variant="contained"
          color="primary"
          href={publishSuccessData.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Article on Website
        </Button>
      </div>
    ) : (

      /* NORMAL PUBLISHING FORM */
      <>
        <TextField
          label="Article Title"
          fullWidth
          value={publishTitle}
          onChange={(e) => setPublishTitle(e.target.value)}
          helperText="This is exactly how the title will appear on your WordPress site."
        />

        <TextField
          label="Hero / Featured Image URL (Optional)"
          fullWidth
          placeholder="https://example.com/my-image.jpg"
          value={heroImageUrl}
          onChange={(e) => setHeroImageUrl(e.target.value)}
          helperText="Provide a direct link to an image. We will upload it to your WP Media Library."
        />

        <Divider className="my-2" />

          <FormControl fullWidth size="small" className="mt-2">
            <InputLabel>Select Target Site</InputLabel>
           <Select
            value={siteSelectionType}
            label="Select Target Site"
            onChange={(e) => setSiteSelectionType(e.target.value)}
          >
            <MenuItem value="cheekypetpark">Cheeky Pet Park</MenuItem>
            <MenuItem value="webmarketics">Web Marketics</MenuItem>
            <MenuItem value="specialfootgear">Special Foot Gear</MenuItem>
            <MenuItem value="riderequips">Rider Equips</MenuItem>
            <MenuItem value="handfultool">Handful Tool</MenuItem>

            {/* Render sites fetched from the database */}
            {userSavedSites.length > 0 && <Divider />}
            {userSavedSites.map(site => (
              <MenuItem key={site.id} value={`db_${site.id}`}>
                {site.name} (Saved)
              </MenuItem>
            ))}

            <Divider />
            <MenuItem value="custom">➕ Add Custom WordPress Site</MenuItem>
          </Select>
          </FormControl>

          {siteSelectionType === 'custom' && (
            <div className="flex flex-col gap-3 p-4 border rounded-md bg-gray-50">
              <Typography variant="subtitle2" className="font-bold">Custom Site Credentials</Typography>

              <Alert severity="info" className="text-xs py-0">
                <strong>How to get an App Password:</strong> Go to your WordPress Admin Dashboard ➔ <strong>Users</strong> ➔ <strong>Profile</strong>. Scroll down to <strong>Application Passwords</strong>, create a new one, and paste it below.
              </Alert>

              {/* You need a Name field so you can identify it in the DB */}
              <TextField
                label="Site Name (e.g., My Personal Blog)"
                size="small"
                value={customWPData.name || ''}
                onChange={(e) => setCustomWPData({...customWPData, name: e.target.value})}
              />
              <TextField
                label="WordPress Site URL"
                placeholder="https://yourdomain.com"
                size="small"
                value={customWPData.url}
                onChange={(e) => setCustomWPData({...customWPData, url: e.target.value})}
              />
              <TextField
                label="WP Username"
                size="small"
                value={customWPData.username}
                onChange={(e) => setCustomWPData({...customWPData, username: e.target.value})}
              />
              <TextField
                label="Application Password"
                type="password"
                size="small"
                value={customWPData.password}
                onChange={(e) => setCustomWPData({...customWPData, password: e.target.value})}
              />

              <FormControlLabel
                control={<Checkbox checked={saveSiteToDb} onChange={(e) => setSaveSiteToDb(e.target.checked)} />}
                label="Save this site to my profile for future use"
              />
            </div>
          )}
          </>
    )}
        </DialogContent>
        {!publishSuccessData && (
        <DialogActions className="p-4">
          <Button onClick={() => setPublishDialogOpen(false)} disabled={isPublishing}>Cancel</Button>
          <Button
            variant="outlined"
            color='error'
            onClick={handleSaveDraftToDB}
            disabled={isPublishing || !publishTitle.trim()}
          >
            Save as Draft
          </Button>
          <Button
            variant="contained"
            color="success"
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

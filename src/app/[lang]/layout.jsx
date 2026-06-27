// Next Imports
import { headers } from 'next/headers'

// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Component Imports

// HOC Imports
import TranslationWrapper from '@/hocs/TranslationWrapper'

// Config Imports
import { i18n } from '@configs/i18n'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

// Vercel Speed Insights
import { SpeedInsights } from '@vercel/speed-insights/next'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: 'AffiGenie | Write & Create Faster',
  description: 'AffiGenie is your ultimate AI-powered writing assistant and chatbot. Whether you need help drafting emails, writing code, brainstorming ideas, or just want to have a chat, AffiGenie is here to assist you. Powered by the latest in AI technology, AffiGenie understands your needs and provides intelligent, context-aware responses to help you write and create faster than ever before.',
  keywords: ['AffiGenie', 'AI Writing Assistant', 'AI Chatbot', 'Content Creation', 'Email Drafting', 'Code Writing', 'Brainstorming', 'Artificial Intelligence'],
  authors: [{ name: 'Abrar Shovon' }],
}

const RootLayout = async props => {
  const params = await props.params
  const { children } = props

  // Type guard to ensure lang is a valid Locale
  const lang = i18n.locales.includes(params.lang) ? params.lang : i18n.defaultLocale

  // Vars
  const headersList = await headers()
  const systemMode = await getSystemMode()
  const direction = i18n.langDirection[lang]

  return (
    <TranslationWrapper headersList={headersList} lang={lang}>
      <html id='__next' lang={lang} dir={direction} suppressHydrationWarning>
        <body className='flex is-full min-bs-full flex-auto flex-col'>
          <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
          {children}
          <SpeedInsights />
        </body>
      </html>
    </TranslationWrapper>
  )
}

export default RootLayout

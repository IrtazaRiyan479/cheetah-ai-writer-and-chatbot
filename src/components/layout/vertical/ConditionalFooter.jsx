'use client'

import { usePathname } from 'next/navigation'

const EXCLUDED_PATHS = ['/images', '/chat', '/magnets', '/links']

const ConditionalFooter = ({ children }) => {
  const pathname = usePathname()

  const shouldHideFooter = EXCLUDED_PATHS.some(path => pathname.includes(path))

  if (shouldHideFooter) {
    return null
  }

  return <>{children}</>
}

export default ConditionalFooter

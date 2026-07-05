'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

const LogoutPage = () => {
  useEffect(() => {
    signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <div className='flex justify-center items-center min-bs-[100dvh]'>
      <p>Logging out...</p>
    </div>
  )
}

export default LogoutPage

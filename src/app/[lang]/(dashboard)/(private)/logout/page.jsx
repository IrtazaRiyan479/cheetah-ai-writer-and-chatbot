'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

const LogoutPage = () => {
  useEffect(() => {
    // Instantly log the user out and redirect to the login page
    signOut({ callbackUrl: '/login1' })
  }, [])

  return (
    <div className='flex justify-center items-center min-bs-[100dvh]'>
      <p>Logging out...</p>
    </div>
  )
}

export default LogoutPage

import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/libs/auth'
import { getDbUser } from '@/libs/entitlement'
import NotAuthorized from '@/views/NotAuthorized'
import AdminDashboard from '@/views/apps/admin/AdminDashboard'
import UnlockGate from '@/views/apps/admin/UnlockGate'
import { ADMIN_COOKIE, verifyAdminCookie } from '@/app/api/admin/_auth'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  const user = await getDbUser({ userId: session?.user?.id, email: session?.user?.email })

  if (!user || user.role !== 'admin') return <NotAuthorized />

  const cookieStore = await cookies()
  const unlocked = verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value)

  return unlocked ? <AdminDashboard /> : <UnlockGate />
}

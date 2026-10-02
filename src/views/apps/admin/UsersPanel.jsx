'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'

const blank = { id: '', name: '', email: '', password: '', role: 'free', wordsLimit: '' }

export default function UsersPanel() {
  const { data: session } = useSession()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState(blank)
  const [passwordDialog, setPasswordDialog] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [selected, setSelected] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load users.')
      setUsers(data.users)
    } catch (caught) { setError(caught.message || 'Could not load users.') }
  }

  useEffect(() => { load() }, [])

  const saveUser = async event => {
    event.preventDefault()
    setBusy(true)
    try {
      const editing = Boolean(form.id)
      const response = await fetch('/api/admin/users', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, wordsLimit: form.wordsLimit === '' ? undefined : Number(form.wordsLimit) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save user.')
      toast.success(editing ? 'User updated.' : 'User created.')
      setDialog(false)
      setForm(blank)
      await load()
    } catch (caught) { toast.error(caught.message || 'Could not save user.') } finally { setBusy(false) }
  }

  const remove = async user => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete user.')
      setDeleteTarget(null)
      toast.success('User deleted.')
      await load()
    } catch (caught) { toast.error(caught.message || 'Could not delete user.') } finally { setBusy(false) }
  }

  const savePassword = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, password: resetPassword }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not reset password.')
      toast.success('Password reset.')
      setPasswordDialog(false)
      setResetPassword('')
    } catch (caught) { toast.error(caught.message || 'Could not reset password.') } finally { setBusy(false) }
  }

  const manageBilling = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'Could not open billing portal.')
      window.location.assign(data.url)
    } catch (caught) { toast.error(caught.message || 'Could not open billing portal.'); setBusy(false) }
  }

  if (!users) return error ? <Typography color='error'>{error}</Typography> : <Skeleton variant='rounded' height={280} />

  return <>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Typography color='text.secondary'>{users.length.toLocaleString()} accounts</Typography><Button variant='contained' disabled={busy} onClick={() => { setForm(blank); setDialog(true) }}>Add user</Button></Box>
    <Paper variant='outlined' sx={{ borderRadius: 3, overflow: 'auto' }}><Table size='small' sx={{ minWidth: 980 }}><TableHead><TableRow><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Plan / status</TableCell><TableCell>Words used / limit</TableCell><TableCell>Stripe customer</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead><TableBody>
      {users.map(user => <TableRow key={user.id} hover><TableCell><Typography fontWeight={600}>{user.email}</Typography><Typography variant='caption' color='text.secondary'>{user.name || '—'}</Typography></TableCell><TableCell><Chip size='small' label={user.role} color={user.role === 'admin' ? 'primary' : 'default'} /></TableCell><TableCell>{user.plan || 'free'} / {user.subscriptionStatus || 'none'}</TableCell><TableCell>{Number(user.wordsUsed || 0).toLocaleString()} / {Number(user.wordsLimit || 0).toLocaleString()}</TableCell><TableCell><Tooltip title={user.stripeCustomerId || 'No Stripe customer'}><Typography variant='body2' sx={{ fontFamily: 'monospace' }}>{user.stripeCustomerId ? `${user.stripeCustomerId.slice(0, 8)}…${user.stripeCustomerId.slice(-5)}` : '—'}</Typography></Tooltip></TableCell><TableCell align='right' sx={{ whiteSpace: 'nowrap' }}><Button size='small' disabled={busy} onClick={() => { setForm({ id: user.id, name: user.name || '', email: user.email || '', password: '', role: user.role, wordsLimit: String(user.wordsLimit ?? '') }); setDialog(true) }}>Edit</Button><Button size='small' disabled={busy} onClick={() => { setSelected(user); setPasswordDialog(true) }}>Reset password</Button><Button size='small' color='error' disabled={busy || user.id === session?.user?.id} onClick={() => setDeleteTarget(user)}>Delete</Button>{user.id === session?.user?.id ? <Button size='small' disabled={busy} onClick={manageBilling}>Manage billing</Button> : null}</TableCell></TableRow>)}
      {!users.length ? <TableRow><TableCell colSpan={6} align='center'>No users found.</TableCell></TableRow> : null}
    </TableBody></Table></Paper>
    <Dialog open={dialog} onClose={() => !busy && setDialog(false)} fullWidth maxWidth='sm'><Box component='form' onSubmit={saveUser}><DialogTitle>{form.id ? 'Edit user' : 'Add user'}</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
      <TextField label='Name' value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <TextField required type='email' label='Email' value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
      {!form.id ? <TextField required type='password' label='Temporary password' value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /> : null}
      <TextField select label='Role' value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{['free', 'pro', 'admin'].map(role => <MenuItem key={role} value={role}>{role}</MenuItem>)}</TextField>
      <TextField type='number' label='Words limit' value={form.wordsLimit} onChange={event => setForm({ ...form, wordsLimit: event.target.value })} inputProps={{ min: 0, step: 1 }} />
    </DialogContent><DialogActions><Button disabled={busy} onClick={() => setDialog(false)}>Cancel</Button><Button type='submit' variant='contained' disabled={busy}>{busy ? <CircularProgress size={18} /> : 'Save'}</Button></DialogActions></Box></Dialog>
    <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)}>
      <DialogTitle>Delete user?</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>Delete {deleteTarget?.email}?</Typography>
        <Typography color='text.secondary'>Deleting a user does not delete WordPress posts.</Typography>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
        <Button color='error' variant='contained' disabled={busy || !deleteTarget} onClick={() => deleteTarget && remove(deleteTarget)}>{busy ? <CircularProgress size={18} color='inherit' /> : 'Delete user'}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={passwordDialog} onClose={() => !busy && setPasswordDialog(false)} fullWidth maxWidth='xs'><DialogTitle>Reset password</DialogTitle><DialogContent><TextField autoFocus fullWidth type='password' label='New password' value={resetPassword} onChange={event => setResetPassword(event.target.value)} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button disabled={busy || !resetPassword || resetPassword.length < 8} onClick={() => setPasswordDialog(false)}>Cancel</Button><Button variant='contained' disabled={busy || resetPassword.length < 8} onClick={savePassword}>{busy ? <CircularProgress size={18} /> : 'Reset password'}</Button></DialogActions></Dialog>
  </>
}

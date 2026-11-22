import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AdminPage } from './AdminPage'
import { RequiredFieldsHint, RequiredLabel } from './FormLabels'
import { useNavigate } from './navigation'
import { loadStaffCatalog } from './staffCatalog'
import type { StaffCatalogData } from './staffCatalog'
import { getSupabaseClient } from './supabase'

function StaffPanel({ children }: { children: ReactNode }) {
  return <main id="main-content" className="site-container page-frame">
    <section className="panel admin-intro">
      <p className="eyebrow">Coast Perfumery Manila</p>
      {children}
    </section>
  </main>
}

function StaffSignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await getSupabaseClient().auth.signInWithPassword({ email: email.trim(), password })
      if (result.error) throw result.error
      navigate('/admin')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <StaffPanel>
    <h1 className="page-title">Staff sign-in</h1>
    <form className="grid gap-4" onSubmit={signIn}>
      <RequiredFieldsHint />
      <label className="field"><RequiredLabel>Email</RequiredLabel><input type="email" autoComplete="username" required disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field"><RequiredLabel>Password</RequiredLabel><input type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </StaffPanel>
}

function StaffDashboard({ onCatalogChanged }: { onCatalogChanged: () => void }) {
  const navigate = useNavigate()
  const [data, setData] = useState<StaffCatalogData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [signOutError, setSignOutError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void loadStaffCatalog(controller.signal).then(
      (catalog) => { if (!controller.signal.aborted) setData(catalog) },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'The dashboard could not load.')
      },
    )
    return () => controller.abort()
  }, [attempt])

  function refresh() {
    setData(null)
    setLoadError('')
    setAttempt((current) => current + 1)
  }

  async function signOut() {
    setSignOutError('')
    try {
      const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      navigate('/admin/login')
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Sign-out failed. Please try again.')
    }
  }

  async function catalogChanged() {
    onCatalogChanged()
    try {
      setData(await loadStaffCatalog())
    } catch (error) {
      setData(null)
      setLoadError(error instanceof Error ? error.message : 'The dashboard could not reload.')
    }
  }

  if (data) return <AdminPage {...data} onChanged={catalogChanged} onRefresh={refresh} onSignOut={() => void signOut()} signOutError={signOutError} />
  return <StaffPanel>
    <h1 className="page-title">Staff workspace</h1>
    {loadError ? <>
      <p className="field-error" role="alert">{loadError}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="secondary-button" onClick={refresh}>Try again</button>
        <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
      </div>
      {signOutError && <p className="field-error" role="alert">{signOutError}</p>}
    </> : <p role="status">Loading staff dashboard…</p>}
  </StaffPanel>
}

export default function AdminWorkspace({ onCatalogChanged }: { onCatalogChanged: () => void }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => setSession(session))
      return () => data.subscription.unsubscribe()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Staff sign-in is unavailable.')
    }
  }, [])

  if (session) return <StaffDashboard key={session.user.id} onCatalogChanged={onCatalogChanged} />
  if (session === null) return <StaffSignIn />
  return <StaffPanel>
    <h1 className="page-title">Staff workspace</h1>
    {error ? <p className="field-error" role="alert">{error}</p> : <p role="status">Checking your session…</p>}
  </StaffPanel>
}

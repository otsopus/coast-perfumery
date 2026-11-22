import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Boxes, ClipboardList, FlaskConical, Plus, Search } from 'lucide-react'
import { catalogImageUrl, formatPrice, isOrderable, lowestPrice } from './catalog'
import { AdminEditor } from './AdminEditor'
import { Modal } from './Modal'
import { adjustStaffStock, deleteStaffListing, saveStaffListing, setStaffAvailability } from './staffCatalog'
import type { StaffCatalogData, StockSelection } from './staffCatalog'
import type { StaffListing } from './supabase'

function StockDialog({ selection, busy, saveError, onClose, onSave }: {
  selection: StockSelection; busy: boolean; saveError: string; onClose: () => void
  onSave: (value: number, adjustmentId: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const request = useRef<{ volume: number; id: string } | null>(null)
  const { perfume, variant, type } = selection
  const deduct = type === 'Deduct'

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const volume = Number(value)
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || volume > 999999.99 || (deduct && volume <= 0)) {
      setError(deduct ? 'Enter a positive volume to deduct.' : 'Enter a nonnegative volume.')
      return
    }
    setError('')
    if (request.current?.volume !== volume) request.current = { volume, id: crypto.randomUUID() }
    onSave(volume, request.current.id)
  }

  return <Modal labelId="stock-title" onClose={onClose}>
    <form className="dialog-pad" onSubmit={save}>
      <h2 id="stock-title">{deduct ? 'Deduct stock' : 'Correct stock count'}</h2>
      <p>{perfume.name} · {variant.concentration} · {variant.remainingMl} mL recorded</p>
      <label className="field">{deduct ? 'Volume to deduct (mL)' : 'New remaining volume (mL)'}
        <input value={value} required disabled={busy} type="number" inputMode="decimal" min={deduct ? '.01' : '0'} max="999999.99" step=".01" onChange={(event) => { setValue(event.target.value); setError('') }} />
      </label>
      {(error || saveError) && <p className="field-error" role="alert">{error || saveError}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save stock change'}</button><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button></div>
    </form>
  </Modal>
}

export function AdminPage({ catalog, history, onChanged, onRefresh, onSignOut, signOutError }: StaffCatalogData & {
  onChanged: () => Promise<void>; onRefresh: () => void; onSignOut: () => void; signOutError: string
}) {
  const [tab, setTab] = useState<'listings' | 'inventory' | 'history'>('listings')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<'new' | StaffListing | null>(null)
  const [deleting, setDeleting] = useState<StaffListing | null>(null)
  const [stock, setStock] = useState<StockSelection | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const matches = catalog.filter((perfume) => `${perfume.name} ${perfume.brand}`.toLowerCase().includes(query.trim().toLowerCase()))
  const orderable = catalog.filter((perfume) => perfume.published && perfume.variants.some((variant) => isOrderable(perfume, variant))).length

  function showEditor(value: 'new' | StaffListing | null) {
    setEditor(value)
    setFeedback('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function closeModal() {
    if (inFlight.current) return
    setDeleting(null)
    setStock(null)
    setError('')
  }

  async function performChange(change: () => Promise<string | void>, message: string, done?: () => void) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      const warning = await change()
      done?.()
      setFeedback(warning ? `${message} ${warning}` : message)
      await onChanged()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The change could not be saved.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  if (editor) return <main id="main-content" className="site-container page-frame">
    <button className="back-link" type="button" disabled={busy} onClick={() => showEditor(null)}>Back to dashboard</button>
    <h1 className="page-title">{editor === 'new' ? 'Add a perfume' : `Edit ${editor.name}`}</h1>
    <AdminEditor perfume={editor === 'new' ? undefined : editor} catalog={catalog} busy={busy} saveError={error} onCancel={() => showEditor(null)}
      onSave={(perfume, files) => void performChange(
        () => saveStaffListing(perfume, editor === 'new' ? null : editor.revision, new Map(files)),
        `${perfume.name} was saved.`, () => showEditor(null),
      )} />
  </main>

  const tabs = [
    { id: 'listings', label: 'Listings', icon: FlaskConical },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'history', label: 'Stock history', icon: ClipboardList },
  ] as const

  return <main id="main-content" className="site-container page-frame">
    <div className="admin-heading">
      <div><p className="eyebrow">Staff workspace</p><h1 className="page-title">Catalog dashboard</h1></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="primary-button" disabled={busy} onClick={() => showEditor('new')}><Plus size={18} /> Add perfume</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={onRefresh}>Refresh</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
    <dl className="admin-stats">
      <div><dt>Listings</dt><dd>{catalog.length}</dd></div>
      <div><dt>Orderable</dt><dd>{orderable}</dd></div>
      <div><dt>Unavailable</dt><dd>{catalog.length - orderable}</dd></div>
    </dl>
    <nav className="admin-tabs" aria-label="Dashboard sections">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setFeedback('') }}><Icon size={18} /> {label}</button>)}
    </nav>
    {feedback && <p className="success-message admin-feedback" role="status">{feedback}</p>}
    {(signOutError || (error && !stock && !deleting)) && <p className="field-error" role="alert">{signOutError || error}</p>}
    {tab !== 'history' && <label className="search-box admin-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Search listings</span><input type="search" placeholder="Perfume or brand" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
    {tab !== 'history' && !matches.length && <div className="empty-state"><h2>{catalog.length ? 'No matching listings' : 'The catalog is empty'}</h2>{query && <button className="text-button" type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
    {tab === 'listings' && matches.length > 0 && <div className="panel admin-table">
      <div className="admin-row admin-table-header"><span>Perfume</span><span>From</span><span>Listing enabled</span><span>Actions</span></div>
      {matches.map((perfume) => <article className="admin-row" key={perfume.id}>
        <div className="admin-perfume"><img src={catalogImageUrl(perfume.image)} alt="" /><div><h2>{perfume.name}</h2><p>{perfume.brand} · {perfume.profile}{!perfume.published && ' · Hidden'}</p></div></div>
        <span className="admin-price">{perfume.variants.some(({ sizes }) => sizes.length)
          ? <><span className="mobile-label">From </span>{formatPrice(lowestPrice(perfume.variants))}</> : 'Unpriced'}</span>
        <label className="switch-label"><input type="checkbox" checked={perfume.available} disabled={busy} aria-label={`Enable ${perfume.name} listing`} onChange={(event) => {
          const enabled = event.target.checked
          void performChange(() => setStaffAvailability(perfume, enabled), `${perfume.name} availability updated.`)
        }} /><span>{perfume.available ? 'Enabled' : 'Paused'}</span></label>
        <div className="admin-row-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => showEditor(perfume)} aria-label={`Edit ${perfume.name}`}>Edit</button><button className="danger-text" type="button" disabled={busy} onClick={() => { setError(''); setDeleting(perfume) }} aria-label={`Delete ${perfume.name}`}>Delete</button></div>
      </article>)}
    </div>}
    {tab === 'inventory' && <div className="inventory-list">
      {matches.map((perfume) => <section className="panel" key={perfume.id}>
        <div className="admin-perfume"><img src={catalogImageUrl(perfume.image)} alt="" /><div><h2>{perfume.name}</h2><p>{perfume.brand}{!perfume.available && ' · Listing paused'}</p></div></div>
        {perfume.variants.map((variant) => <div className="inventory-row" key={variant.id}>
          <div><strong>{variant.concentration}</strong><p className="muted">{variant.remainingMl} mL remaining</p></div>
          <label className="switch-label"><input type="checkbox" checked={variant.available} disabled={busy} aria-label={`Enable ${perfume.name} ${variant.concentration}`} onChange={(event) => {
            const enabled = event.target.checked
            void performChange(() => setStaffAvailability(perfume, enabled, variant), `${variant.concentration} availability updated.`)
          }} /> {variant.available ? 'Enabled' : 'Paused'}</label>
          <div className="admin-row-actions">
            <button className="secondary-button" type="button" disabled={busy || !variant.remainingMl} aria-label={`Deduct ${perfume.name} ${variant.concentration} stock`} onClick={() => { setError(''); setStock({ perfume, variant, type: 'Deduct' }) }}>Deduct</button>
            <button className="secondary-button" type="button" disabled={busy} aria-label={`Correct ${perfume.name} ${variant.concentration} stock`} onClick={() => { setError(''); setStock({ perfume, variant, type: 'Correct' }) }}>Correct count</button>
          </div>
        </div>)}
      </section>)}
    </div>}
    {tab === 'history' && <section className="panel history-panel"><h2>Recent stock adjustments</h2>
      {history.length ? <ol>{history.map((entry) => <li key={entry.id}>
        <div><strong>{entry.perfume} · {entry.concentration}</strong><p className="muted"><time dateTime={entry.date}>{new Date(entry.date).toLocaleString('en-PH')}</time></p></div>
        <div><strong>{entry.type === 'Deduct' ? 'Deduction' : 'Correction'}</strong><p>{entry.before} mL to {entry.after} mL</p></div>
      </li>)}</ol> : <p className="muted">Stock changes will appear here after a deduction or correction.</p>}
    </section>}
    {deleting && <Modal labelId="delete-title" onClose={closeModal}>
      <div className="dialog-pad">
        <h2 id="delete-title">Delete {deleting.name}?</h2>
        <p>This permanently removes the listing and its decant sizes from the storefront.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" disabled={busy} onClick={closeModal}>Cancel</button>
          <button className="danger-button" type="button" disabled={busy} onClick={() => void performChange(
            () => deleteStaffListing(deleting), `${deleting.name} was deleted.`, () => setDeleting(null),
          )}>{busy ? 'Deleting…' : 'Delete listing'}</button>
        </div>
      </div>
    </Modal>}
    {stock && <StockDialog selection={stock} busy={busy} saveError={error} onClose={closeModal} onSave={(value, adjustmentId) => void performChange(
      () => adjustStaffStock(stock, value, adjustmentId), `Stock updated for ${stock.perfume.name} ${stock.variant.concentration}.`, () => setStock(null),
    )} />}
  </main>
}

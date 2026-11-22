import { useState } from 'react'
import type { FormEvent } from 'react'
import { Boxes, ClipboardList, FlaskConical, Plus, Search, Store } from 'lucide-react'
import { formatPrice, isOrderable, lowestPrice } from './catalog'
import type { Perfume, Variant } from './catalog'
import { AdminEditor } from './AdminEditor'
import { Modal } from './Modal'
import { RouteLink } from './navigation'

export type Adjustment = {
  id: string; perfume: string; concentration: string; type: 'Deduct' | 'Correct'; before: number; after: number; date: Date
}

type StockSelection = { perfume: Perfume; variant: Variant; type: Adjustment['type'] }

function StockDialog({ selection, onClose, onSave }: {
  selection: StockSelection; onClose: () => void; onSave: (value: number) => string | undefined
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const { perfume, variant, type } = selection
  const deduct = type === 'Deduct'

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(Math.round(Number(value) * 100)) || (deduct && Number(value) <= 0)) {
      setError(deduct ? 'Enter a positive volume to deduct.' : 'Enter a nonnegative volume.')
      return
    }
    setError(onSave(Number(value)) ?? '')
  }

  return <Modal labelId="stock-title" onClose={onClose}>
    <form className="dialog-pad" onSubmit={save}>
      <h2 id="stock-title">{deduct ? 'Deduct stock' : 'Correct stock count'}</h2>
      <p>{perfume.name} · {variant.concentration} · {variant.remainingMl} mL recorded</p>
      <label className="field">{deduct ? 'Volume to deduct (mL)' : 'New remaining volume (mL)'}
        <input value={value} required type="number" inputMode="decimal" min={deduct ? '.01' : '0'} step=".01" onChange={(event) => { setValue(event.target.value); setError('') }} />
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" className="primary-button">Save stock change</button><button type="button" className="secondary-button" onClick={onClose}>Cancel</button></div>
    </form>
  </Modal>
}

export function AdminLanding() {
  return <main id="main-content" className="site-container page-frame">
    <section className="panel admin-intro">
      <Store size={30} aria-hidden="true" />
      <p className="eyebrow">Coast Perfumery Manila</p>
      <h1 className="page-title">Staff workspace</h1>
      <p className="muted">Explore the catalog and inventory tools using sample data. Changes last until the page reloads.</p>
      <RouteLink className="primary-button" to="/admin">Enter demo dashboard</RouteLink>
    </section>
  </main>
}

export function AdminPage({ catalog, history, onSave, onDelete, onStock }: {
  catalog: Perfume[]; history: Adjustment[]; onSave: (perfume: Perfume) => void; onDelete: (id: string) => void
  onStock: (selection: StockSelection, value: number) => string | undefined
}) {
  const [tab, setTab] = useState<'listings' | 'inventory' | 'history'>('listings')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<'new' | Perfume | null>(null)
  const [deleting, setDeleting] = useState<Perfume | null>(null)
  const [stock, setStock] = useState<StockSelection | null>(null)
  const [feedback, setFeedback] = useState('')
  const matches = catalog.filter((perfume) => `${perfume.name} ${perfume.brand}`.toLowerCase().includes(query.trim().toLowerCase()))
  const orderable = catalog.filter((perfume) => perfume.variants.some((variant) => isOrderable(perfume, variant))).length

  function showEditor(value: 'new' | Perfume | null) {
    setEditor(value)
    setFeedback('')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (editor) return <main id="main-content" className="site-container page-frame">
    <button className="back-link" type="button" onClick={() => showEditor(null)}>Back to dashboard</button>
    <h1 className="page-title">{editor === 'new' ? 'Add a perfume' : `Edit ${editor.name}`}</h1>
    <AdminEditor perfume={editor === 'new' ? undefined : editor} catalog={catalog} onCancel={() => showEditor(null)}
      onSave={(perfume) => { onSave(perfume); showEditor(null); setFeedback(`${perfume.name} was saved to the sample catalog.`) }} />
  </main>

  const tabs = [
    { id: 'listings', label: 'Listings', icon: FlaskConical },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'history', label: 'Stock history', icon: ClipboardList },
  ] as const

  return <main id="main-content" className="site-container page-frame">
    <div className="admin-heading">
      <div><p className="eyebrow">Staff demo</p><h1 className="page-title">Catalog dashboard</h1><p className="muted">Sample changes appear in the storefront until you reload.</p></div>
      <button type="button" className="primary-button" onClick={() => showEditor('new')}><Plus size={18} /> Add perfume</button>
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
    {tab !== 'history' && <label className="search-box admin-search"><Search size={19} aria-hidden="true" /><span className="sr-only">Search listings</span><input type="search" placeholder="Perfume or brand" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
    {tab !== 'history' && !matches.length && <div className="empty-state"><h2>{catalog.length ? 'No matching listings' : 'The sample catalog is empty'}</h2>{query && <button className="text-button" type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
    {tab === 'listings' && matches.length > 0 && <div className="panel admin-table">
      <div className="admin-row admin-table-header"><span>Perfume</span><span>From</span><span>Listing enabled</span><span>Actions</span></div>
      {matches.map((perfume) => <article className="admin-row" key={perfume.id}>
        <div className="admin-perfume"><img src={perfume.image} alt="" /><div><h2>{perfume.name}</h2><p>{perfume.brand} · {perfume.profile}</p></div></div>
        <span className="admin-price"><span className="mobile-label">From </span>{formatPrice(lowestPrice(perfume.variants))}</span>
        <label className="switch-label"><input type="checkbox" checked={perfume.available} aria-label={`Enable ${perfume.name} listing`} onChange={(event) => onSave({ ...perfume, available: event.target.checked })} /><span>{perfume.available ? 'Enabled' : 'Paused'}</span></label>
        <div className="admin-row-actions"><button className="secondary-button" type="button" onClick={() => showEditor(perfume)} aria-label={`Edit ${perfume.name}`}>Edit</button><button className="danger-text" type="button" onClick={() => setDeleting(perfume)} aria-label={`Delete ${perfume.name}`}>Delete</button></div>
      </article>)}
    </div>}
    {tab === 'inventory' && <div className="inventory-list">
      {matches.map((perfume) => <section className="panel" key={perfume.id}>
        <div className="admin-perfume"><img src={perfume.image} alt="" /><div><h2>{perfume.name}</h2><p>{perfume.brand}{!perfume.available && ' · Listing paused'}</p></div></div>
        {perfume.variants.map((variant) => <div className="inventory-row" key={variant.id}>
          <div><strong>{variant.concentration}</strong><p className="muted">{variant.remainingMl} mL remaining</p></div>
          <label className="switch-label"><input type="checkbox" checked={variant.available} aria-label={`Enable ${perfume.name} ${variant.concentration}`} onChange={(event) =>
            onSave({ ...perfume, variants: perfume.variants.map((entry) => entry.id === variant.id ? { ...entry, available: event.target.checked } : entry) })
          } /> {variant.available ? 'Enabled' : 'Paused'}</label>
          <div className="admin-row-actions">
            <button className="secondary-button" type="button" disabled={!variant.remainingMl} aria-label={`Deduct ${perfume.name} ${variant.concentration} stock`} onClick={() => setStock({ perfume, variant, type: 'Deduct' })}>Deduct</button>
            <button className="secondary-button" type="button" aria-label={`Correct ${perfume.name} ${variant.concentration} stock`} onClick={() => setStock({ perfume, variant, type: 'Correct' })}>Correct count</button>
          </div>
        </div>)}
      </section>)}
    </div>}
    {tab === 'history' && <section className="panel history-panel"><h2>Stock adjustments</h2>
      {history.length ? <ol>{history.map((entry) => <li key={entry.id}>
        <div><strong>{entry.perfume} · {entry.concentration}</strong><p className="muted">Demo staff · <time dateTime={entry.date.toISOString()}>{entry.date.toLocaleString('en-PH')}</time></p></div>
        <div><strong>{entry.type === 'Deduct' ? 'Deduction' : 'Correction'}</strong><p>{entry.before} mL to {entry.after} mL</p></div>
      </li>)}</ol> : <p className="muted">Stock changes will appear here after a deduction or correction.</p>}
    </section>}
    {deleting && <Modal labelId="delete-title" onClose={() => setDeleting(null)}>
      <div className="dialog-pad">
        <h2 id="delete-title">Delete {deleting.name}?</h2>
        <p>This removes the listing and its decant sizes from the sample storefront.</p>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" type="button" onClick={() => setDeleting(null)}>Cancel</button>
          <button className="danger-button" type="button" onClick={() => { onDelete(deleting.id); setFeedback(`${deleting.name} was deleted from the sample catalog.`); setDeleting(null) }}>Delete listing</button>
        </div>
      </div>
    </Modal>}
    {stock && <StockDialog selection={stock} onClose={() => setStock(null)} onSave={(value) => {
      const error = onStock(stock, value)
      if (error) return error
      setFeedback(`Stock updated for ${stock.perfume.name} ${stock.variant.concentration}.`)
      setStock(null)
    }} />}
  </main>
}

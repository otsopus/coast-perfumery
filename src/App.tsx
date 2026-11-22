import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Droplets, Flower2, Leaf, Search, SlidersHorizontal, Sun, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { catalog, formatPrice, lowestPrice, noteOptions, profiles } from './catalog'
import type { Perfume } from './catalog'
import heroImage from './assets/hero.jpg'
import logo from './assets/shop-logo.jpg'

const profileIcons = { Fresh: Droplets, Citrus: Sun, Floral: Flower2, Woody: Leaf }
const filterGroups = [
  { key: 'note', label: 'Fragrance notes', options: noteOptions },
  { key: 'concentration', label: 'Concentration', options: ['EDT', 'EDP', 'Extrait'] },
  { key: 'gender', label: 'Gender', options: ['Unisex', 'Feminine', 'Masculine'] },
  { key: 'occasion', label: 'Occasion', options: ['Everyday', 'Office', 'Date night', 'Special occasion'] },
]

function matchesChoice(params: URLSearchParams, key: string, candidates: string[]) {
  const choices = params.getAll(key)
  return choices.length === 0 || choices.some((choice) => candidates.includes(choice))
}

function matchingVariants(perfume: Perfume, params: URLSearchParams) {
  const maxPrice = Number(params.get('maxPrice'))
  const hasPriceLimit = Number.isFinite(maxPrice) && maxPrice > 0
  return perfume.variants.filter((variant) => (
    matchesChoice(params, 'concentration', [variant.concentration])
    && matchesChoice(params, 'note', variant.notes.flat())
    && (!hasPriceLimit || variant.sizes.some(({ centavos }) => centavos <= Math.round(maxPrice * 100)))
  ))
}

function Modal({ labelId, onClose, children, className = '' }: {
  labelId: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={labelId}
      className={`modal ${className}`}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="modal-content">
        <button type="button" className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={21} /></button>
        {children}
      </div>
    </dialog>
  )
}

function PerfumeDetails({ perfume, params, onClose }: { perfume: Perfume; params: URLSearchParams; onClose: () => void }) {
  const [variant, setVariant] = useState(() => matchingVariants(perfume, params)[0] ?? perfume.variants[0])

  return (
    <Modal labelId="perfume-title" onClose={onClose} className="perfume-modal">
      <img className="detail-image" src={perfume.image} alt="" />
      <div className="detail-body">
        <p className="eyebrow">{perfume.brand}</p>
        <h2 id="perfume-title">{perfume.name}</h2>
        <p>{perfume.description}</p>
        <fieldset className="detail-variants">
          <legend>Concentration</legend>
          <div className="flex flex-wrap gap-2">
            {perfume.variants.map((choice) => (
              <button key={choice.concentration} type="button" className="chip" aria-pressed={choice === variant} onClick={() => setVariant(choice)}>
                {choice.concentration}
              </button>
            ))}
          </div>
        </fieldset>
        <dl className="detail-notes">
          {['Top', 'Middle', 'Base'].map((label, index) => (
            <div key={label}><dt>{label} notes</dt><dd>{variant.notes[index].join(', ')}</dd></div>
          ))}
        </dl>
        <h3>{perfume.available ? 'Sample decant prices' : 'Currently unavailable'}</h3>
        {perfume.available && (
          <ul className="detail-prices flex flex-wrap gap-2">
            {variant.sizes.map(({ ml, centavos }) => <li key={ml}>{ml} mL <strong>{formatPrice(centavos)}</strong></li>)}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function PerfumeCard({ perfume, variants, onOpen }: {
  perfume: Perfume
  variants: Perfume['variants']
  onOpen: () => void
}) {
  return (
    <article className="perfume-card">
      <div className="card-photo">
        <img src={perfume.image} alt="" width="570" height="570" loading="lazy" />
        <span className="profile-label">{perfume.profile}</span>
      </div>
      <div className="card-copy">
        <p className="eyebrow">{perfume.brand}</p>
        <h3>{perfume.name}</h3>
        <p className="card-concentration">{variants.map(({ concentration }) => concentration).join(' · ')}</p>
        <div className="card-bottom">
          <span>{perfume.available ? <>From <strong>{formatPrice(lowestPrice(variants))}</strong></> : 'Unavailable'}</span>
          <button type="button" className="view-label" onClick={onOpen} aria-label={`View details for ${perfume.name}`}>View details</button>
        </div>
      </div>
    </article>
  )
}

export function App() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedPerfume, setSelectedPerfume] = useState<Perfume | null>(null)
  const query = params.get('q') ?? ''
  const sort = params.get('sort') ?? ''
  const filterCount = filterGroups.reduce((count, { key }) => count + params.getAll(key).length, 0) + Number(params.has('maxPrice'))
  const hasFilters = !!query || params.has('profile') || filterCount > 0

  useEffect(() => {
    const syncParams = () => setParams(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', syncParams)
    return () => window.removeEventListener('popstate', syncParams)
  }, [])

  function updateParams(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params)
    change(next)
    const url = new URL(window.location.href)
    url.search = next.toString()
    window.history.replaceState(window.history.state, '', url)
    setParams(next)
  }

  function setParam(key: string, value: string) {
    updateParams((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
  }

  function toggleParam(key: string, value: string) {
    updateParams((next) => {
      if (next.getAll(key).includes(value)) next.delete(key, value)
      else next.append(key, value)
    })
  }

  function clearFilters() {
    updateParams((next) => {
      for (const key of ['q', 'profile', 'maxPrice', ...filterGroups.map(({ key }) => key)]) next.delete(key)
    })
  }

  const search = query.trim().toLocaleLowerCase()
  const results = catalog
    .filter((perfume) => (
      `${perfume.name} ${perfume.brand}`.toLocaleLowerCase().includes(search)
      && matchesChoice(params, 'profile', [perfume.profile])
      && matchesChoice(params, 'gender', [perfume.gender])
      && matchesChoice(params, 'occasion', perfume.occasions)
    ))
    .map((perfume) => ({ perfume, variants: matchingVariants(perfume, params) }))
    .filter(({ variants }) => variants.length > 0)

  if (sort === 'price-asc') results.sort((a, b) => lowestPrice(a.variants) - lowestPrice(b.variants))
  if (sort === 'price-desc') results.sort((a, b) => lowestPrice(b.variants) - lowestPrice(a.variants))
  if (sort === 'name') results.sort((a, b) => a.perfume.name.localeCompare(b.perfume.name))

  return (
    <>
      <a className="skip-link" href="#fragrances">Skip to catalog</a>
      <header className="site-header">
        <div className="site-container header-inner">
          <a href="/" className="brand" aria-label="Coast Perfumery Manila home">
            <img src={logo} alt="" width="235" height="290" />
            <span className="brand-text"><strong>Coast</strong><span>Perfumery Manila</span></span>
          </a>
          <a href="#fragrances" className="header-link">Shop fragrances</a>
        </div>
      </header>

      <main className="site-container">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Perfume decants</p>
            <h1 id="hero-title">Find your next<br /><em>signature scent.</em></h1>
            <p className="hero-description">Explore fragrances in 2, 5, and 10 mL sizes. Try a few before choosing a full bottle.</p>
            <a href="#fragrances" className="primary-button">Explore the catalog</a>
          </div>
          <div className="hero-photo">
            <img src={heroImage} alt="Glass perfume atomizers and a bottle of amber fragrance on sunlit blue glass" fetchPriority="high" />
          </div>
        </section>

        <section id="fragrances" className="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div><h2 id="catalog-title">Shop fragrances</h2><p>Sample catalog · Illustrative products and prices</p></div>
            <div className="catalog-controls">
              <label className="search-box">
                <Search size={19} aria-hidden="true" />
                <span className="sr-only">Search by perfume or brand</span>
                <input type="search" value={query} placeholder="Perfume or brand" onChange={(event) => setParam('q', event.target.value)} />
              </label>
              <button type="button" className="filter-button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
                <SlidersHorizontal size={18} /> Filters{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
              </button>
            </div>
          </div>

          <div className="profile-list flex flex-wrap gap-2" aria-label="Scent profiles" role="group">
            <button type="button" className="chip" aria-pressed={!params.has('profile')} onClick={() => setParam('profile', '')}>All scents</button>
            {profiles.map((profile) => {
              const Icon = profileIcons[profile]
              return (
                <button type="button" className="chip" aria-pressed={params.getAll('profile').includes(profile)} onClick={() => toggleParam('profile', profile)} key={profile}>
                  <Icon size={16} aria-hidden="true" /> {profile}
                </button>
              )
            })}
          </div>

          <div className="catalog-toolbar">
            <div className="result-info flex flex-wrap items-center gap-x-4 gap-y-1">
              <p role="status">{results.length} {results.length === 1 ? 'fragrance' : 'fragrances'}</p>
              {hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}
            </div>
            <label className="sort-control">
              <span className="sr-only">Sort fragrances</span>
              <select value={sort} onChange={(event) => setParam('sort', event.target.value)}>
                <option value="">Featured</option>
                <option value="price-asc">Price · Low to high</option>
                <option value="price-desc">Price · High to low</option>
                <option value="name">Name · A to Z</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          </div>

          {results.length > 0 ? (
            <div className="product-grid grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {results.map(({ perfume, variants }) => (
                <PerfumeCard key={perfume.id} perfume={perfume} variants={variants} onOpen={() => setSelectedPerfume(perfume)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{catalog.length ? 'No fragrances found' : 'The catalog is empty'}</h3>
              <p>{catalog.length ? 'Try a different search or adjust your filters.' : 'Check back for new fragrances.'}</p>
              {hasFilters && <button type="button" className="primary-button" onClick={clearFilters}>Clear filters</button>}
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container footer-inner"><span>Coast Perfumery Manila</span><a href="#fragrances">Browse fragrances</a></div>
      </footer>

      {filtersOpen && (
        <Modal labelId="filter-title" onClose={() => setFiltersOpen(false)} className="filter-modal">
          <div className="filter-content">
            <h2 id="filter-title">Filters</h2>
            {filterGroups.map(({ key, label, options }) => (
              <fieldset className="filter-group" key={key}>
                <legend>{label}</legend>
                <div className="filter-options">
                  {options.map((option) => (
                    <label key={option}>
                      <input type="checkbox" checked={params.getAll(key).includes(option)} onChange={() => toggleParam(key, option)} />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <label className="price-filter">
              Maximum decant price (₱)
              <input type="number" inputMode="decimal" min="1" step="0.01" placeholder="Any price" value={params.get('maxPrice') ?? ''} onChange={(event) => setParam('maxPrice', event.target.value)} />
            </label>
            <div className="filter-actions flex flex-wrap items-center justify-between gap-4">
              <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>
              <button type="button" className="primary-button" onClick={() => setFiltersOpen(false)}>Show {results.length} {results.length === 1 ? 'fragrance' : 'fragrances'}</button>
            </div>
          </div>
        </Modal>
      )}
      {selectedPerfume && <PerfumeDetails perfume={selectedPerfume} params={params} onClose={() => setSelectedPerfume(null)} />}
    </>
  )
}

import { useEffect, useState } from 'react'
import { ChevronDown, Droplets, Flower2, Leaf, Search, SlidersHorizontal, Sun } from 'lucide-react'
import { concentrations, effectiveNotes, formatPrice, genders, isOrderable, profiles, startingPrice } from './catalog'
import type { Perfume } from './catalog'
import heroImage from './assets/hero.jpg'
import { Modal } from './Modal'
import { RouteLink } from './navigation'

const profileIcons = { Fresh: Droplets, Citrus: Sun, Floral: Flower2, Woody: Leaf }

function matchesChoice(params: URLSearchParams, key: string, candidates: string[]) {
  const choices = params.getAll(key)
  return choices.length === 0 || choices.some((choice) => candidates.includes(choice))
}

function matchingVariants(perfume: Perfume, params: URLSearchParams) {
  const maxPrice = Number(params.get('maxPrice'))
  const hasPriceLimit = Number.isFinite(maxPrice) && maxPrice > 0
  return perfume.variants.filter((variant) => (
    matchesChoice(params, 'concentration', [variant.concentration])
    && matchesChoice(params, 'note', effectiveNotes(perfume, variant).flat())
    && (!hasPriceLimit || variant.sizes.some(({ centavos }) => centavos <= Math.round(maxPrice * 100)))
  ))
}

function PerfumeCard({ perfume, variants }: {
  perfume: Perfume
  variants: Perfume['variants']
}) {
  const orderable = variants.filter((variant) => isOrderable(perfume, variant))
  return (
    <article className="perfume-card">
      <div className="card-photo">
        <img src={perfume.image} alt={`${perfume.name} bottle illustration`} width="570" height="570" loading="lazy" />
        <span className="profile-label">{perfume.profile}</span>
      </div>
      <div className="card-copy">
        <p className="eyebrow">{perfume.brand}</p>
        <h3>{perfume.name}</h3>
        <p className="card-concentration">{variants.map(({ concentration }) => concentration).join(' · ')}</p>
        <div className="card-bottom">
          <span>{orderable.length ? <>From <strong>{formatPrice(startingPrice(orderable))}</strong></> : 'Unavailable'}</span>
          <RouteLink to={`/perfumes/${perfume.id}?concentration=${encodeURIComponent((orderable[0] ?? variants[0]).concentration)}`} className="view-label" aria-label={`View details for ${perfume.name}`}>View details</RouteLink>
        </div>
      </div>
    </article>
  )
}

export function CatalogHome({ catalog }: { catalog: Perfume[] }) {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterGroups = [
    { key: 'note', label: 'Fragrance notes', options: [...new Set(catalog.flatMap((perfume) => perfume.variants.flatMap((variant) => effectiveNotes(perfume, variant).flat())))].sort() },
    { key: 'concentration', label: 'Concentration', options: concentrations },
    { key: 'gender', label: 'Gender', options: genders },
    { key: 'occasion', label: 'Occasion', options: [...new Set(catalog.flatMap(({ occasions }) => occasions))].sort() },
  ]
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
    .map((perfume) => {
      const variants = matchingVariants(perfume, params)
      return { perfume, variants, price: startingPrice(variants.filter((variant) => isOrderable(perfume, variant))) }
    })
    .filter(({ variants }) => variants.length > 0)

  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') results.sort((a, b) => (b.price === Infinity ? -1 : b.price) - (a.price === Infinity ? -1 : a.price))
  if (sort === 'name') results.sort((a, b) => a.perfume.name.localeCompare(b.perfume.name))

  return (
    <>
      <main className="site-container" id="main-content">
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
                <PerfumeCard key={perfume.id} perfume={perfume} variants={variants} />
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
    </>
  )
}

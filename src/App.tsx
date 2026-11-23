import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CartPage } from './CartPage'
import { CheckoutPage } from './CheckoutPage'
import { LandingPage } from './LandingPage'
import { ProductPage } from './ProductPage'
import { ShopPage } from './ShopPage'
import { StorefrontLinks } from './StorefrontLinks'
import { Navigation, RouteLink } from './navigation'
import type { StorefrontPerfume } from './catalog'
import { additionalQuantity, cartStorageKey, findItem, itemId, readCart, reviewCart } from './cart'
import type { CartLine, CartStatus, ItemKey } from './cart'
import { emptyCheckout } from './order'
import type { CartSnapshot } from './storefrontCatalog'
import logo from './assets/shop-logo.jpg'
import coralStillLife from './assets/coral-still-life.png'

const AdminWorkspace = lazy(() => import('./AdminWorkspace'))
const catalogQueryKeys = ['q', 'sort', 'profile', 'availability', 'note', 'concentration', 'gender', 'occasion', 'maxPrice']

function resolveUrl(to: string) {
  const url = new URL(to, location.href)
  const legacyCatalogLink = url.hash === '#fragrances' || url.hash === '#scent-profiles'
    || (!url.hash && catalogQueryKeys.some((key) => url.searchParams.has(key)))
  if (url.pathname === '/' && legacyCatalogLink) {
    url.pathname = '/shop'
    if (url.hash === '#fragrances') url.hash = ''
  }
  return url
}

function routePath(url: URL) {
  return url.pathname.replace(/\/$/, '') || '/'
}

type CatalogState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; listings: StorefrontPerfume[] }

type CartRequest = { lines: CartLine[]; path: string; version: number }
type CartResult = { request: CartRequest; snapshot: CartSnapshot | null }

export function App() {
  const [path, setPath] = useState(() => routePath(resolveUrl(location.href)))
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: 'loading' })
  const [catalogVersion, setCatalogVersion] = useState(0)
  const [lines, setLines] = useState(readCart)
  const [cartResult, setCartResult] = useState<CartResult | null>(null)
  const [cartVersion, setCartVersion] = useState(0)
  const [fields, setFields] = useState(emptyCheckout)
  const catalog = catalogState.status === 'ready' ? catalogState.listings : []
  const needsCatalog = path === '/shop' || path === '/cart' || path === '/checkout' || path.startsWith('/perfumes/')
  const count = lines.reduce((total, { quantity }) => total + quantity, 0)
  const productId = path.startsWith('/perfumes/') ? path.slice('/perfumes/'.length) : null
  const needsCartCheck = Boolean(productId || (lines.length && (path === '/cart' || path === '/checkout')))
  const cartRequest = useMemo(() => ({ lines, path, version: cartVersion }), [lines, path, cartVersion])
  const currentResult = cartResult?.request === cartRequest ? cartResult : null
  const snapshot = currentResult?.snapshot
  const cartStatus: CartStatus = snapshot ? 'ready' : currentResult ? 'error' : 'loading'
  const rows = reviewCart(snapshot?.catalog ?? catalog, lines, snapshot?.limits)
  const perfume = (snapshot?.catalog ?? catalog).find(({ id }) => id === productId)

  useEffect(() => {
    function syncPath() {
      const url = resolveUrl(location.href)
      if (url.href !== location.href) window.history.replaceState(window.history.state, '', url)
      setPath(routePath(url))
    }
    syncPath()
    const frame = requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView())
    window.addEventListener('popstate', syncPath)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('popstate', syncPath)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(lines))
    } catch {
      // The cart remains usable in memory if browser storage is unavailable.
    }
  }, [lines])

  useEffect(() => {
    if (!needsCatalog || catalogState.status !== 'loading') return
    const controller = new AbortController()
    import('./storefrontCatalog').then(({ loadStorefrontCatalog }) => loadStorefrontCatalog(controller.signal)).then(
      (listings) => {
        if (!controller.signal.aborted) setCatalogState({ status: 'ready', listings })
      },
      () => {
        if (!controller.signal.aborted) setCatalogState({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [needsCatalog, catalogState.status, catalogVersion])

  useEffect(() => {
    if (!needsCartCheck) return
    const controller = new AbortController()
    const record = (snapshot: CartSnapshot | null) => {
      if (!controller.signal.aborted) setCartResult({ request: cartRequest, snapshot })
    }
    import('./storefrontCatalog').then(({ loadCartSnapshot }) => loadCartSnapshot(cartRequest.lines, productId, controller.signal))
      .then(record, () => record(null))
    return () => controller.abort()
  }, [needsCartCheck, cartRequest, productId])

  function retryCatalog() {
    setCatalogState({ status: 'loading' })
    setCatalogVersion((current) => current + 1)
  }

  async function validateCheckout(signal: AbortSignal) {
    const { loadCartSnapshot } = await import('./storefrontCatalog')
    const snapshot = await loadCartSnapshot(lines, null, signal)
    if (!signal.aborted) setCartResult({ request: cartRequest, snapshot })
    return reviewCart(snapshot.catalog, lines, snapshot.limits)
  }

  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Fragrance Decants', '/shop': 'Shop Fragrances', '/cart': 'Your Cart', '/checkout': 'Checkout', '/admin': 'Catalog Dashboard', '/admin/login': 'Staff Workspace' }
    document.title = `${perfume?.name ?? titles[path] ?? 'Page Unavailable'} | Coast Perfumery Manila`
  }, [path, perfume?.name])

  function navigate(to: string) {
    const destination = resolveUrl(to)
    const nextPath = routePath(destination)
    if (path === '/shop' && nextPath === '/shop' && !destination.search) destination.search = location.search
    if (destination.href !== location.href) window.history.pushState(null, '', destination)
    setPath(nextPath)
    requestAnimationFrame(() => {
      const section = destination.hash && document.getElementById(destination.hash.slice(1))
      if (section) {
        section.scrollIntoView()
        section.focus({ preventScroll: true })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
        if (path !== nextPath) {
          const main = document.getElementById('main-content')
          main?.setAttribute('tabindex', '-1')
          main?.focus({ preventScroll: true })
        }
      }
    })
  }

  function addItem(key: ItemKey, quantity: number) {
    const item = snapshot && findItem(snapshot.catalog, key)
    if (!item || !Number.isSafeInteger(quantity) || quantity < 1
      || quantity > additionalQuantity(snapshot?.limits, lines, key)) return false
    const existing = lines.find((line) => itemId(line) === itemId(key))
    setLines(existing
      ? lines.map((line) => line === existing ? { ...line, quantity: line.quantity + quantity } : line)
      : [...lines, { ...key, quantity, quotedCentavos: item.size.centavos }])
    return true
  }

  function changeQuantity(line: CartLine, quantity: number) {
    const key = itemId(line)
    if (quantity > line.quantity) {
      addItem(line, quantity - line.quantity)
    } else {
      setLines((current) => quantity > 0 ? current.map((entry) => itemId(entry) === key ? { ...entry, quantity } : entry)
        : current.filter((entry) => itemId(entry) !== key))
    }
  }

  const cartProps = {
    rows, status: cartStatus, onQuantity: changeQuantity,
    onRetry: () => setCartVersion((current) => current + 1),
    onAcceptPrices: () => {
      if (!snapshot) return
      setLines((current) => current.map((line) => {
        const price = findItem(snapshot.catalog, line)?.size.centavos
        return price === undefined ? line : { ...line, quotedCentavos: price }
      }))
    },
  }

  let page
  if (path === '/') page = <LandingPage />
  else if (path === '/shop') page = <ShopPage catalog={catalog} status={catalogState.status} onRetry={retryCatalog} />
  else if (needsCatalog && catalogState.status !== 'ready') page = <main id="main-content" className="site-container page-frame">
    <div className="empty-state">
      {catalogState.status === 'loading' ? <p role="status">Loading fragrances…</p> : <>
        <p role="alert">The fragrance catalog couldn't load.</p>
        <button type="button" className="secondary-button" onClick={retryCatalog}>Try again</button>
      </>}
    </div>
  </main>
  else if (perfume) page = <ProductPage key={perfume.id} perfume={perfume} lines={lines} limits={snapshot?.limits}
    status={cartStatus} onRetry={cartProps.onRetry} onAdd={addItem} />
  else if (path === '/cart') page = <CartPage {...cartProps} />
  else if (path === '/checkout') page = <CheckoutPage {...cartProps} fields={fields} onFields={setFields} onValidate={validateCheckout} />
  else if (path === '/admin/login' || path === '/admin') page = <Suspense fallback={
    <main id="main-content" className="site-container page-frame"><p role="status">Loading staff workspace…</p></main>
  }>
    <AdminWorkspace onCatalogChanged={retryCatalog} />
  </Suspense>
  else page = <main id="main-content" className="site-container page-frame">
    <div className="empty-state"><h1 className="page-title">This page is unavailable</h1><RouteLink className="primary-button" to="/shop">Browse fragrances</RouteLink></div>
  </main>

  return <Navigation.Provider value={navigate}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <div className="header-inner">
        <RouteLink to="/" className="brand" aria-label="Coast Perfumery Manila home">
          <img src={logo} alt="" width="235" height="290" />
          <span className="brand-text"><strong>Coast</strong><span>Perfumery Manila</span></span>
        </RouteLink>
        <nav className="header-links" aria-label="Storefront">
          <RouteLink to="/shop" className="header-link" aria-current={path === '/shop' ? 'page' : undefined}>Shop</RouteLink>
          <RouteLink to="/#how-to-order" className="header-link">How to order</RouteLink>
        </nav>
        <RouteLink to="/cart" className="header-cart" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`} aria-current={path === '/cart' ? 'page' : undefined}>
          Cart <span key={count} className="cart-count">({count})</span>
        </RouteLink>
      </div>
    </header>
    {page}
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <div className="footer-brand">
          <span>Coast Perfumery Manila</span>
          <StorefrontLinks group="social" />
        </div>
        <img className="footer-coral" src={coralStillLife} alt="" width="450" height="300" loading="lazy" />
        <div className="footer-links"><RouteLink to="/shop">Browse fragrances</RouteLink><RouteLink to="/admin/login">Staff sign-in</RouteLink></div>
      </div>
    </footer>
  </Navigation.Provider>
}

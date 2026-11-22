import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { AdminLanding, AdminPage } from './AdminPage'
import type { Adjustment } from './AdminPage'
import { CartPage } from './CartPage'
import { CatalogHome } from './CatalogHome'
import { CheckoutPage } from './CheckoutPage'
import { ProductPage } from './ProductPage'
import { Navigation, RouteLink } from './navigation'
import { catalog as sampleCatalog, volumeUnits } from './catalog'
import type { Perfume } from './catalog'
import { cartStorageKey, findItem, itemId, readCart, remainingFor, reviewCart } from './cart'
import type { CartLine, ItemKey } from './cart'
import { emptyCheckout } from './order'
import logo from './assets/shop-logo.jpg'

export function App() {
  const [path, setPath] = useState(() => location.pathname.replace(/\/$/, '') || '/')
  const [catalog, setCatalog] = useState(sampleCatalog)
  const [lines, setLines] = useState(() => readCart(sampleCatalog))
  const [fields, setFields] = useState(emptyCheckout)
  const [history, setHistory] = useState<Adjustment[]>([])
  const rows = reviewCart(catalog, lines)
  const count = lines.reduce((total, { quantity }) => total + quantity, 0)
  const perfume = path.startsWith('/perfumes/') ? catalog.find(({ id }) => path === `/perfumes/${id}`) : undefined

  useEffect(() => {
    function onBack() {
      setPath(location.pathname.replace(/\/$/, '') || '/')
    }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])

  useEffect(() => {
    try {
      const stored = lines.map(({ perfumeId, variantId, sizeId, quantity }) => ({ perfumeId, variantId, sizeId, quantity }))
      localStorage.setItem(cartStorageKey, JSON.stringify(stored))
    } catch {
      // The cart remains usable in memory if browser storage is unavailable.
    }
  }, [lines])

  useEffect(() => {
    const titles: Record<string, string> = { '/': 'Fragrance Decants', '/cart': 'Your Cart', '/checkout': 'Checkout', '/admin': 'Catalog Dashboard', '/admin/login': 'Staff Workspace' }
    document.title = `${perfume?.name ?? titles[path] ?? 'Page Unavailable'} | Coast Perfumery Manila`
  }, [path, perfume?.name])

  function navigate(to: string) {
    const destination = new URL(to, location.href)
    const previous = location.pathname
    if (previous === '/' && destination.pathname === '/' && !destination.search) destination.search = location.search
    if (destination.href !== location.href) window.history.pushState(null, '', destination)
    setPath(destination.pathname.replace(/\/$/, '') || '/')
    requestAnimationFrame(() => {
      if (destination.hash === '#fragrances') {
        document.getElementById('fragrances')?.scrollIntoView()
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
        if (previous !== destination.pathname) {
          const main = document.getElementById('main-content')
          main?.setAttribute('tabindex', '-1')
          main?.focus({ preventScroll: true })
        }
      }
    })
  }

  function addItem(key: ItemKey, quantity: number) {
    const item = findItem(catalog, key)
    if (!item || !Number.isSafeInteger(quantity) || quantity < 1
      || quantity * volumeUnits(item.size.ml) > volumeUnits(remainingFor(catalog, lines, item.perfume, item.variant))) return false
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

  function savePerfume(update: Perfume) {
    setCatalog((current) => current.some(({ id }) => id === update.id)
      ? current.map((entry) => entry.id === update.id ? update : entry) : [...current, update])
  }

  function changeStock(selection: { perfume: Perfume; variant: Perfume['variants'][number]; type: Adjustment['type'] }, value: number) {
    const currentPerfume = catalog.find(({ id }) => id === selection.perfume.id)
    const variant = currentPerfume?.variants.find(({ id }) => id === selection.variant.id)
    if (!currentPerfume || !variant) return 'That concentration is no longer available. Close the editor and refresh your selection.'
    const before = variant.remainingMl
    if (selection.type === 'Correct' && before !== selection.variant.remainingMl) return 'Stock changed since this form was opened. Reopen it to review the new count.'
    const after = selection.type === 'Deduct' ? (volumeUnits(before) - volumeUnits(value)) / 100 : value
    if (after < 0) return 'The deduction exceeds the recorded volume.'
    savePerfume({ ...currentPerfume, variants: currentPerfume.variants.map((entry) => entry.id === variant.id ? { ...entry, remainingMl: after } : entry) })
    setHistory((current) => [{ id: crypto.randomUUID(), perfume: currentPerfume.name, concentration: variant.concentration, type: selection.type, before, after, date: new Date() }, ...current])
  }

  const cartProps = {
    catalog, lines, rows, onQuantity: changeQuantity,
    onAcceptPrices: () => setLines((current) => current.map((line) => ({ ...line, quotedCentavos: findItem(catalog, line)?.size.centavos }))),
  }

  let page
  if (path === '/') page = <CatalogHome catalog={catalog} />
  else if (perfume) page = <ProductPage key={perfume.id} perfume={perfume} catalog={catalog} lines={lines} onAdd={addItem} />
  else if (path === '/cart') page = <CartPage {...cartProps} />
  else if (path === '/checkout') page = <CheckoutPage {...cartProps} fields={fields} onFields={setFields} />
  else if (path === '/admin/login') page = <AdminLanding />
  else if (path === '/admin') page = <AdminPage catalog={catalog} history={history} onSave={savePerfume} onStock={changeStock}
    onDelete={(id) => setCatalog((current) => current.filter((entry) => entry.id !== id))} />
  else page = <main id="main-content" className="site-container page-frame">
    <div className="empty-state"><h1 className="page-title">This page is unavailable</h1><RouteLink className="primary-button" to="/#fragrances">Browse fragrances</RouteLink></div>
  </main>

  return <Navigation.Provider value={navigate}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <div className="site-container header-inner">
        <RouteLink to="/" className="brand" aria-label="Coast Perfumery Manila home">
          <img src={logo} alt="" width="235" height="290" />
          <span className="brand-text"><strong>Coast</strong><span>Perfumery Manila</span></span>
        </RouteLink>
        <nav className="header-actions" aria-label="Storefront">
          <RouteLink to="/#fragrances" className="header-link">Shop fragrances</RouteLink>
          <RouteLink to="/cart" className="header-cart" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`} aria-current={path === '/cart' ? 'page' : undefined}>
            <ShoppingBag aria-hidden="true" size={19} /><span className="header-cart-text">Cart</span><span key={count} className="cart-count">{count}</span>
          </RouteLink>
        </nav>
      </div>
    </header>
    {page}
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <span>Coast Perfumery Manila</span>
        <div className="footer-links"><RouteLink to="/#fragrances">Browse fragrances</RouteLink><RouteLink to="/admin/login">Staff demo</RouteLink></div>
      </div>
    </footer>
  </Navigation.Provider>
}

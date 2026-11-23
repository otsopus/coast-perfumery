import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatPrice } from './catalog'
import { itemId, subtotalFor } from './cart'
import type { CartLine, CartStatus, ReviewedLine } from './cart'
import { RouteLink } from './navigation'

export type CartActions = {
  onQuantity: (line: CartLine, quantity: number) => void
  onAcceptPrices: () => void
}

export type CartProps = CartActions & {
  rows: ReviewedLine[]
  status: CartStatus
  onRetry: () => void
}

export function CartAvailabilityNotice({ status, onRetry }: Pick<CartProps, 'status' | 'onRetry'>) {
  if (status === 'loading') return <p className="notice" role="status">Checking current prices and availability…</p>
  if (status === 'error') return <div className="notice">
    <p role="alert">Current prices and availability couldn't be checked.</p>
    <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>
  </div>
  return null
}

export function CartReview({ rows, onQuantity, onAcceptPrices, status, busy = false }: Omit<CartProps, 'onRetry'> & { busy?: boolean }) {
  return (
    <section className="panel cart-review" aria-labelledby="cart-items">
      <h2 id="cart-items">Your decants</h2>
      {rows.map(({ line, item, issue, priceChanged, maxQuantity }) => {
        const title = item ? `${item.perfume.name} ${item.variant.concentration} ${item.size.ml} mL` : 'Removed decant'
        return (
          <article key={itemId(line)} className="cart-row">
            {item && <img src={item.variant.images?.[0] ?? item.perfume.image} alt="" />}
            <div className="cart-item-copy">
              <h3>{item ? <RouteLink to={`/perfumes/${item.perfume.id}?concentration=${item.variant.concentration}`}>{item.perfume.name}</RouteLink> : title}</h3>
              {item && <p className="muted">{item.variant.concentration} · {item.size.ml} mL · {formatPrice(item.size.centavos)} each</p>}
              {issue && <p className="field-error">{issue}</p>}
              {priceChanged && item && <p className="field-error">Price changed from {formatPrice(line.quotedCentavos!)} to {formatPrice(item.size.centavos)} each.</p>}
            </div>
            <div className="cart-row-actions">
              {item && <strong>{formatPrice(item.size.centavos * line.quantity)}</strong>}
              <div className="flex items-center gap-2">
                {item && <div className="stepper">
                  <button type="button" aria-label={`Decrease ${title}`} disabled={busy || line.quantity <= 1} onClick={() => onQuantity(line, line.quantity - 1)}><Minus size={15} /></button>
                  <output aria-label={`Quantity for ${title}`}>{line.quantity}</output>
                  <button type="button" aria-label={`Increase ${title}`} disabled={busy || line.quantity >= maxQuantity} onClick={() => onQuantity(line, line.quantity + 1)}><Plus size={15} /></button>
                </div>}
                <button className="icon-button" type="button" aria-label={`Remove ${title}`} disabled={busy} onClick={() => onQuantity(line, 0)}><Trash2 size={16} /></button>
              </div>
            </div>
          </article>
        )
      })}
      {rows.some(({ priceChanged }) => priceChanged) && <button type="button" className="secondary-button" disabled={busy || status !== 'ready'} onClick={onAcceptPrices}>Accept updated prices</button>}
    </section>
  )
}

export function Totals({ subtotal }: { subtotal: number }) {
  return (
    <dl className="totals">
      <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
      <div><dt>Shipping</dt><dd>Pending confirmation</dd></div>
      <div className="total-line"><dt>Final total</dt><dd>Pending confirmation</dd></div>
    </dl>
  )
}

export function CartPage({ rows, status, onRetry, ...actions }: CartProps) {
  return (
    <main id="main-content" className="site-container page-frame">
      <RouteLink className="back-link" to="/shop">Continue shopping</RouteLink>
      <h1 className="page-title">Your cart</h1>
      {rows.length ? <div className="commerce-layout">
        <CartReview rows={rows} status={status} {...actions} />
        <aside className="panel sticky-panel">
          <h2>Order estimate</h2>
          <Totals subtotal={subtotalFor(rows)} />
          {status !== 'ready' ? <CartAvailabilityNotice status={status} onRetry={onRetry} />
            : rows.some(({ issue, priceChanged }) => issue || priceChanged)
            ? <p className="notice">Review the changes in your cart to continue.</p>
            : <RouteLink className="primary-button full-button" to="/checkout">Continue to checkout</RouteLink>}
        </aside>
      </div> : <div className="empty-state">
        <ShoppingBag size={26} aria-hidden="true" />
        <h2>Your cart is empty</h2>
        <RouteLink className="primary-button" to="/shop">Browse fragrances</RouteLink>
      </div>}
    </main>
  )
}

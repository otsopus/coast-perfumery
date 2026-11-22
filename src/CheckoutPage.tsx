import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Clipboard, Download, MessageCircle } from 'lucide-react'
import { CartReview, Totals } from './CartPage'
import { reviewCart, subtotalFor } from './cart'
import { downloadOrder, makeOrder, orderText } from './order'
import type { CheckoutFields, Order } from './order'
import { RouteLink } from './navigation'
import { Modal } from './Modal'

const couriers = ['Lalamove', 'GrabExpress', 'J&T']
const payments = ['GCash', 'Bank transfer', 'Undecided']
const fieldConfig = [
  { key: 'name', label: 'Full name', autoComplete: 'name' },
  { key: 'phone', label: 'Contact number', autoComplete: 'tel', type: 'tel', placeholder: '09XX XXX XXXX' },
  { key: 'street', label: 'Street or unit', autoComplete: 'address-line1' },
  { key: 'barangay', label: 'Barangay', autoComplete: 'address-level3' },
  { key: 'city', label: 'City or municipality', autoComplete: 'address-level2' },
  { key: 'province', label: 'Province or Metro Manila', autoComplete: 'address-level1' },
] as const
type Errors = Partial<Record<keyof CheckoutFields, string>>

function messengerAddress() {
  try {
    const url = new URL(import.meta.env.VITE_MESSENGER_URL)
    return url.protocol === 'https:' && ['m.me', 'www.messenger.com', 'messenger.com'].includes(url.hostname) ? url.href : ''
  } catch {
    return ''
  }
}

function OrderSummary({ order, onEdit }: { order: Order; onEdit: () => void }) {
  const [feedback, setFeedback] = useState('')
  const [showText, setShowText] = useState(false)
  const [showMessenger, setShowMessenger] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const messengerUrl = messengerAddress()
  const text = orderText(order)

  useEffect(() => { headingRef.current?.focus() }, [])
  useEffect(() => {
    if (showText) {
      textRef.current?.focus()
      textRef.current?.select()
    }
  }, [showText])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback('Order text copied. Paste it into Messenger.')
    } catch {
      setShowText(true)
      textRef.current?.focus()
      textRef.current?.select()
      setFeedback('Select and copy the order text below.')
    }
  }

  async function saveImage() {
    try {
      await downloadOrder(order)
      setFeedback('Your order image is ready to download.')
    } catch {
      setFeedback('Image download is unavailable. You can screenshot the order card.')
    }
  }

  return (
    <div className="commerce-layout summary-layout">
      <section className="receipt panel" aria-labelledby="order-title">
        <p className="eyebrow">Coast Perfumery Manila</p>
        <h1 tabIndex={-1} ref={headingRef} id="order-title">Sample order request</h1>
        <h2>Decants</h2>
        <ul className="receipt-items">{order.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <Totals subtotal={order.subtotal} />
        <dl className="receipt-details">{order.details.map(({ label, value }) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}</dl>
      </section>
      <aside className="panel sticky-panel summary-actions">
        <h2>Send your request</h2>
        <p>Copy your order and paste it into Messenger, or attach the downloaded order image. The shop confirms availability and shipping there.</p>
        <button className="primary-button full-button" type="button" onClick={copy}><Clipboard size={18} /> Copy order text</button>
        {messengerUrl
          ? <a className="secondary-button full-button" href={messengerUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Open Messenger</a>
          : <button className="secondary-button full-button" type="button" onClick={() => setShowMessenger(true)}><MessageCircle size={18} /> Preview Messenger handoff</button>}
        <button className="secondary-button full-button" type="button" onClick={saveImage}><Download size={18} /> Download order image</button>
        {feedback && <p className="notice" role="status">{feedback}</p>}
        {showText && <label className="field">Order text<textarea ref={textRef} readOnly rows={7} value={text} /></label>}
        <button type="button" className="text-button" onClick={onEdit}>Edit checkout details</button>
      </aside>
      {showMessenger && <Modal labelId="messenger-title" onClose={() => setShowMessenger(false)}>
        <div className="dialog-pad">
          <h2 id="messenger-title">Messenger handoff</h2>
          <p>In the live shop, this step opens the shop’s Messenger conversation. Paste the copied text or attach the order image there.</p>
          <button className="primary-button" type="button" onClick={() => setShowMessenger(false)}>Back to order</button>
        </div>
      </Modal>}
    </div>
  )
}

export function CheckoutPage({ fields, onFields, ...cart }: Parameters<typeof CartReview>[0] & {
  fields: CheckoutFields
  onFields: (fields: CheckoutFields) => void
}) {
  const [errors, setErrors] = useState<Errors>({})
  const [order, setOrder] = useState<Order | null>(null)
  const [reviewNeeded, setReviewNeeded] = useState(false)
  const needsReview = cart.rows.some(({ issue, priceChanged }) => issue || priceChanged)

  function updateField(key: keyof CheckoutFields, value: string) {
    onFields({ ...fields, [key]: value })
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: Errors = {}
    for (const { key, label } of fieldConfig) {
      if (!fields[key].trim()) next[key] = `Enter your ${label.toLowerCase()}.`
    }
    if (fields.phone && !/^(?:\+?63|0)?9\d{9}$/.test(fields.phone.replace(/[\s()-]/g, ''))) {
      next.phone = 'Enter a Philippine mobile number, such as 0917 123 4567.'
    }
    if (!couriers.includes(fields.courier)) next.courier = 'Choose a preferred courier.'
    if (!payments.includes(fields.payment)) next.payment = 'Choose a payment preference.'
    setErrors(next)

    const currentRows = reviewCart(cart.catalog, cart.lines)
    const invalidCart = currentRows.length === 0 || currentRows.some(({ issue, priceChanged }) => issue || priceChanged)
    setReviewNeeded(invalidCart)
    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    if (invalidCart) return
    setOrder(makeOrder(fields, currentRows))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function errorFor(key: keyof CheckoutFields) {
    return errors[key] && <small className="field-error" id={`${key}-error`}>{errors[key]}</small>
  }

  return (
    <main id="main-content" className="site-container page-frame">
      <RouteLink className="back-link" to="/cart">Back to cart</RouteLink>
      {order ? <OrderSummary order={order} onEdit={() => setOrder(null)} /> : <>
        <h1 className="page-title">Checkout</h1>
        {cart.rows.length ? <div className="commerce-layout">
          <form className="panel checkout-form" onSubmit={submit} noValidate>
            <h2>Delivery details</h2>
            <p className="muted">Use sample contact details for this demo.</p>
            <div className="form-grid">
              {fieldConfig.map(({ key, label, autoComplete, ...extra }) => (
                <label className="field" key={key}>{label}
                  <input name={key} autoComplete={autoComplete} maxLength={key === 'phone' ? 25 : 100} required
                    value={fields[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
                    onChange={(event) => updateField(key, event.target.value)} {...extra} />
                  {errorFor(key)}
                </label>
              ))}
              {([{ key: 'courier', label: 'Preferred courier', choices: couriers }, { key: 'payment', label: 'Preferred payment method', choices: payments }] as const).map(({ key, label, choices }) => (
                <label className="field" key={key}>{label}
                  <select name={key} required value={fields[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
                    onChange={(event) => updateField(key, event.target.value)}>
                    <option value="">Choose an option</option>
                    {choices.map((choice) => <option key={choice}>{choice}</option>)}
                  </select>
                  {errorFor(key)}
                </label>
              ))}
              <label className="field form-wide">Additional notes (optional)
                <textarea name="notes" rows={3} maxLength={500} value={fields.notes} onChange={(event) => updateField('notes', event.target.value)} />
              </label>
            </div>
            {reviewNeeded && needsReview && <p className="notice" role="alert">Review the updated cart before generating an order request.</p>}
            <button type="submit" className="primary-button">Generate order summary</button>
          </form>
          <div className="checkout-review">
            {needsReview ? <CartReview {...cart} /> : <section className="panel">
              <h2>Your decants</h2>
              <ul className="checkout-lines">
                {cart.rows.map(({ line, item }) => item && <li key={`${line.perfumeId}-${line.variantId}-${line.sizeId}`}>
                  <strong>{line.quantity} × {item.perfume.name}</strong><span>{item.variant.concentration} · {item.size.ml} mL</span>
                </li>)}
              </ul>
              <RouteLink className="text-button" to="/cart">Edit cart</RouteLink>
            </section>}
            <aside className="panel"><h2>Order estimate</h2><Totals subtotal={subtotalFor(cart.rows)} /></aside>
          </div>
        </div> : <div className="empty-state"><h2>Add a decant to get started</h2><RouteLink className="primary-button" to="/#fragrances">Browse fragrances</RouteLink></div>}
      </>}
    </main>
  )
}

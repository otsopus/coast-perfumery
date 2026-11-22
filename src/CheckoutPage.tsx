import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Clipboard, Download, MessageCircle } from 'lucide-react'
import { CartAvailabilityNotice, CartReview, Totals } from './CartPage'
import type { CartProps } from './CartPage'
import { itemId, subtotalFor } from './cart'
import type { ReviewedLine } from './cart'
import { RequiredFieldsHint, RequiredLabel } from './FormLabels'
import { downloadOrder, makeOrder, orderText } from './order'
import type { CheckoutFields, Order } from './order'
import { RouteLink } from './navigation'

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
  const shopUrl = 'https://m.me/coastperfumerymnl'
  try {
    const url = new URL(import.meta.env.VITE_MESSENGER_URL?.trim() || shopUrl)
    return url.protocol === 'https:' && ['m.me', 'www.messenger.com', 'messenger.com'].includes(url.hostname) ? url.href : shopUrl
  } catch {
    return shopUrl
  }
}

function OrderSummary({ order, onEdit }: { order: Order; onEdit: () => void }) {
  const [feedback, setFeedback] = useState('')
  const [showText, setShowText] = useState(false)
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
        <h1 tabIndex={-1} ref={headingRef} id="order-title">Order request</h1>
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
        <a className="secondary-button full-button" href={messengerUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Open Messenger</a>
        <button className="secondary-button full-button" type="button" onClick={saveImage}><Download size={18} /> Download order image</button>
        {feedback && <p className="notice" role="status">{feedback}</p>}
        {showText && <label className="field">Order text<textarea ref={textRef} readOnly rows={7} value={text} /></label>}
        <button type="button" className="text-button" onClick={onEdit}>Edit checkout details</button>
      </aside>
    </div>
  )
}

export function CheckoutPage({ fields, onFields, onValidate, ...cart }: CartProps & {
  fields: CheckoutFields
  onFields: (fields: CheckoutFields) => void
  onValidate: (signal: AbortSignal) => Promise<ReviewedLine[]>
}) {
  const [errors, setErrors] = useState<Errors>({})
  const [order, setOrder] = useState<Order | null>(null)
  const [reviewNeeded, setReviewNeeded] = useState(false)
  const [checking, setChecking] = useState(false)
  const [validationError, setValidationError] = useState(false)
  const validation = useRef<AbortController | null>(null)
  const needsReview = cart.rows.some(({ issue, priceChanged }) => issue || priceChanged)

  useEffect(() => () => validation.current?.abort(), [])

  function updateField(key: keyof CheckoutFields, value: string) {
    onFields({ ...fields, [key]: value })
    setErrors((previous) => ({ ...previous, [key]: undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validation.current || cart.status !== 'ready' || !cart.rows.length) return
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

    if (Object.keys(next).length) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus()
      return
    }
    const controller = new AbortController()
    validation.current = controller
    setChecking(true)
    setValidationError(false)
    try {
      const currentRows = await onValidate(controller.signal)
      if (controller.signal.aborted) return
      const invalidCart = currentRows.length === 0 || currentRows.some(({ issue, priceChanged }) => issue || priceChanged)
      setReviewNeeded(invalidCart)
      if (invalidCart) return
      setOrder(makeOrder(fields, currentRows))
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch {
      if (!controller.signal.aborted) setValidationError(true)
    } finally {
      validation.current = null
      if (!controller.signal.aborted) setChecking(false)
    }
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
          <form className="panel checkout-form" onSubmit={submit} noValidate aria-busy={checking}>
            <h2>Delivery details</h2>
            <RequiredFieldsHint />
            <div className="form-grid">
              {fieldConfig.map(({ key, label, autoComplete, ...extra }) => (
                <label className="field" key={key}><RequiredLabel>{label}</RequiredLabel>
                  <input name={key} autoComplete={autoComplete} maxLength={key === 'phone' ? 25 : 100} required disabled={checking}
                    value={fields[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
                    onChange={(event) => updateField(key, event.target.value)} {...extra} />
                  {errorFor(key)}
                </label>
              ))}
              {([{ key: 'courier', label: 'Preferred courier', choices: couriers }, { key: 'payment', label: 'Preferred payment method', choices: payments }] as const).map(({ key, label, choices }) => (
                <label className="field" key={key}><RequiredLabel>{label}</RequiredLabel>
                  <select name={key} required disabled={checking} value={fields[key]} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
                    onChange={(event) => updateField(key, event.target.value)}>
                    <option value="">Choose an option</option>
                    {choices.map((choice) => <option key={choice}>{choice}</option>)}
                  </select>
                  {errorFor(key)}
                </label>
              ))}
              <label className="field form-wide">Additional notes (optional)
                <textarea name="notes" rows={3} maxLength={500} disabled={checking} value={fields.notes} onChange={(event) => updateField('notes', event.target.value)} />
              </label>
            </div>
            {reviewNeeded && needsReview && <p className="notice" role="alert">Review the updated cart before generating an order request.</p>}
            <CartAvailabilityNotice status={cart.status} onRetry={cart.onRetry} />
            {validationError && <p className="notice" role="alert">We couldn't verify your cart. Your cart and delivery details are still here.</p>}
            <button type="submit" className="primary-button" disabled={checking || cart.status !== 'ready'}>
              {checking ? 'Checking cart…' : validationError ? 'Retry cart validation' : 'Generate order summary'}
            </button>
          </form>
          <div className="checkout-review">
            {needsReview ? <CartReview {...cart} busy={checking} /> : <section className="panel">
              <h2>Your decants</h2>
              <ul className="checkout-lines">
                {cart.rows.map(({ line, item }) => item && <li key={itemId(line)}>
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

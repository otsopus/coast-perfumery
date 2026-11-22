import { useState } from 'react'
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { effectiveNotes, formatPrice, isOrderable } from './catalog'
import type { StorefrontPerfume } from './catalog'
import { maximumQuantity, remainingFor } from './cart'
import type { CartLine, ItemKey } from './cart'
import { RouteLink } from './navigation'

export function ProductPage({ perfume, catalog, lines, onAdd }: {
  perfume: StorefrontPerfume
  catalog: StorefrontPerfume[]
  lines: CartLine[]
  onAdd: (key: ItemKey, quantity: number) => boolean
}) {
  const preferred = new URLSearchParams(location.search).get('concentration')
  const first = perfume.variants.find(({ concentration }) => concentration === preferred)
    ?? perfume.variants.find((variant) => isOrderable(perfume, variant)) ?? perfume.variants[0]
  const [variantId, setVariantId] = useState(first.id)
  const [sizeId, setSizeId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [feedback, setFeedback] = useState('')
  const variant = perfume.variants.find(({ id }) => id === variantId) ?? first
  const images = variant.images?.length ? variant.images : [perfume.image, ...(perfume.gallery ?? [])]
  const availableMl = remainingFor(catalog, lines, perfume, variant)
  const requestedSize = variant.sizes.find(({ id }) => id === sizeId)
  const size = requestedSize ?? variant.sizes.find(({ ml }) => ml <= availableMl) ?? variant.sizes[0]
  const maximum = size ? maximumQuantity(availableMl, size.ml) : 0
  const actualQuantity = Math.min(quantity, Math.max(1, maximum))

  function addToCart() {
    if (!size || maximum < 1) return
    const added = onAdd({ perfumeId: perfume.id, variantId: variant.id, sizeId: size.id }, actualQuantity)
    setFeedback(added ? `Added ${actualQuantity} × ${size.ml} mL to your cart.` : 'Availability changed. Please adjust your selection.')
    setQuantity(1)
  }

  return (
    <main id="main-content" className="site-container page-frame">
      <RouteLink className="back-link" to="/#fragrances">Shop fragrances</RouteLink>
      <div className="product-page">
        <div>
          <div className="product-visual">
            <img key={images[imageIndex]} src={images[imageIndex] ?? images[0]} alt={`${perfume.name} sample fragrance bottle`} />
            <span className="profile-label">{perfume.profile}</span>
          </div>
          {images.length > 1 && <div className="thumbnails">
            {images.map((image, index) => <button key={index} type="button" aria-label={`Show photo ${index + 1}`} aria-pressed={index === imageIndex} onClick={() => setImageIndex(index)}><img src={image} alt="" /></button>)}
          </div>}
        </div>
        <section className="product-info" aria-labelledby="product-title">
          <p className="eyebrow">{perfume.brand}</p>
          <h1 id="product-title">{perfume.name}</h1>
          <p className="description">{variant.description || perfume.description}</p>
          <fieldset className="option-group">
            <legend>Concentration</legend>
            <div className="flex flex-wrap gap-2">{perfume.variants.map((choice) => (
              <button type="button" key={choice.id} className="chip" aria-pressed={choice.id === variant.id} onClick={() => {
                setVariantId(choice.id); setSizeId(''); setQuantity(1); setImageIndex(0); setFeedback('')
              }}>{choice.concentration}{!isOrderable(perfume, choice) && ' · Unavailable'}</button>
            ))}</div>
          </fieldset>
          <fieldset className="option-group">
            <legend>Decant size</legend>
            <div className="size-options">{variant.sizes.map((choice) => (
              <button key={choice.id} type="button" className="size-option" aria-pressed={size?.id === choice.id}
                aria-label={`${choice.ml} mL, ${formatPrice(choice.centavos)}`} disabled={choice.ml > availableMl}
                onClick={() => { setSizeId(choice.id); setQuantity(1); setFeedback('') }}>
                <strong>{choice.ml} mL</strong><span>{formatPrice(choice.centavos)}</span>
              </button>
            ))}</div>
          </fieldset>
          <div className="product-actions">
            <div className="stepper" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" disabled={actualQuantity <= 1} onClick={() => setQuantity(actualQuantity - 1)}><Minus size={16} /></button>
              <output aria-label="Selected quantity">{actualQuantity}</output>
              <button type="button" aria-label="Increase quantity" disabled={actualQuantity >= maximum} onClick={() => setQuantity(actualQuantity + 1)}><Plus size={16} /></button>
            </div>
            <button type="button" className="primary-button" disabled={maximum < 1} onClick={addToCart}>
              <ShoppingBag size={18} /> {maximum && size ? `Add to cart · ${formatPrice(size.centavos * actualQuantity)}` : 'Unavailable for this cart'}
            </button>
          </div>
          {maximum < 1 && !feedback && <p className="muted">Try another size or concentration, or adjust items already in your cart.</p>}
          {feedback && <div className="success-message" role="status"><Check size={18} /> <span>{feedback}</span> <RouteLink to="/cart">View cart</RouteLink></div>}
          <dl className="notes-panel">{['Top', 'Middle', 'Base'].map((label, index) => (
            <div key={label}><dt>{label} notes</dt><dd>{effectiveNotes(perfume, variant)[index].join(', ') || '—'}</dd></div>
          ))}</dl>
        </section>
      </div>
    </main>
  )
}

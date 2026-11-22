import type { StorefrontPerfume } from './catalog'

export type ItemKey = { perfumeId: string; variantId: string; sizeId: string }
export type CartRequestLine = ItemKey & { quantity: number }
export type CartLine = CartRequestLine & { quotedCentavos?: number }
export type CartLimit = ItemKey & { maxQuantity: number }
export type CartLimits = ReadonlyMap<string, number>
export type CartStatus = 'loading' | 'ready' | 'error'
export const cartStorageKey = 'coast-cart-v1'

export const itemId = ({ perfumeId, variantId, sizeId }: ItemKey) => JSON.stringify([perfumeId, variantId, sizeId])

export function findItem(catalog: StorefrontPerfume[], key: ItemKey) {
  const perfume = catalog.find(({ id }) => id === key.perfumeId)
  const variant = perfume?.variants.find(({ id }) => id === key.variantId)
  const size = variant?.sizes.find(({ id }) => id === key.sizeId)
  return perfume && variant && size ? { perfume, variant, size } : undefined
}

export function readCart(): CartLine[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    const lines = new Map<string, CartLine>()
    for (const line of stored) {
      if (!line || typeof line.perfumeId !== 'string' || typeof line.variantId !== 'string'
        || typeof line.sizeId !== 'string' || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue
      const { perfumeId, variantId, sizeId, quantity, quotedCentavos } = line
      const key = { perfumeId, variantId, sizeId }
      lines.set(itemId(key), {
        ...key, quantity,
        quotedCentavos: Number.isSafeInteger(quotedCentavos) && quotedCentavos > 0 ? quotedCentavos : undefined,
      })
    }
    return [...lines.values()]
  } catch {
    return []
  }
}

export function additionalQuantity(limits: CartLimits | undefined, lines: CartLine[], key: ItemKey) {
  const id = itemId(key)
  const existing = lines.find((line) => itemId(line) === id)
  return Math.max(0, (limits?.get(id) ?? 0) - (existing?.quantity ?? 0))
}

export function reviewCart(catalog: StorefrontPerfume[], lines: CartLine[], limits?: CartLimits) {
  return lines.map((line) => {
    const item = findItem(catalog, line)
    const maxQuantity = limits?.get(itemId(line)) ?? 0
    let issue = ''
    if (!item) issue = 'This perfume or decant size is no longer listed.'
    else if (!item.perfume.available || !item.variant.available) issue = 'This concentration is currently unavailable.'
    else if (item.size.maxQuantity === 0) issue = 'This decant size is currently unavailable.'
    else if (limits && line.quantity > maxQuantity) issue = 'Reduce the combined quantities for this concentration.'
    const priceChanged = !!item && line.quotedCentavos !== undefined && item.size.centavos !== line.quotedCentavos
    return { line, item, issue, priceChanged, maxQuantity }
  })
}

export type ReviewedLine = ReturnType<typeof reviewCart>[number]

export const subtotalFor = (rows: ReviewedLine[]) => rows.reduce((total, { line, item }) => total + line.quantity * (item?.size.centavos ?? 0), 0)

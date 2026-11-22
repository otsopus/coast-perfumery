import { volumeUnits } from './catalog'
import type { Perfume, Variant } from './catalog'

export type ItemKey = { perfumeId: string; variantId: string; sizeId: string }
export type CartLine = ItemKey & { quantity: number; quotedCentavos?: number }
export const cartStorageKey = 'coast-cart-v1'

export const itemId = ({ perfumeId, variantId, sizeId }: ItemKey) => `${perfumeId}/${variantId}/${sizeId}`

export function findItem(catalog: Perfume[], key: ItemKey) {
  const perfume = catalog.find(({ id }) => id === key.perfumeId)
  const variant = perfume?.variants.find(({ id }) => id === key.variantId)
  const size = variant?.sizes.find(({ id }) => id === key.sizeId)
  return perfume && variant && size ? { perfume, variant, size } : undefined
}

export function readCart(catalog: Perfume[]): CartLine[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(cartStorageKey) ?? '[]')
    if (!Array.isArray(stored)) return []
    const lines = new Map<string, CartLine>()
    for (const line of stored) {
      if (!line || typeof line.perfumeId !== 'string' || typeof line.variantId !== 'string'
        || typeof line.sizeId !== 'string' || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue
      const { perfumeId, variantId, sizeId, quantity } = line
      const key = { perfumeId, variantId, sizeId }
      lines.set(itemId(key), { ...key, quantity, quotedCentavos: findItem(catalog, key)?.size.centavos })
    }
    return [...lines.values()]
  } catch {
    return []
  }
}

export function remainingFor(catalog: Perfume[], lines: CartLine[], perfume: Perfume, variant: Variant, except?: ItemKey) {
  if (!perfume.available || !variant.available) return 0
  const used = lines.reduce((total, line) => {
    if (line.perfumeId !== perfume.id || line.variantId !== variant.id || (except && itemId(line) === itemId(except))) return total
    return total + line.quantity * volumeUnits(findItem(catalog, line)?.size.ml ?? 0)
  }, 0)
  return Math.max(0, volumeUnits(variant.remainingMl) - used) / 100
}

export const maximumQuantity = (availableMl: number, sizeMl: number) => Math.floor(volumeUnits(availableMl) / volumeUnits(sizeMl))

export function reviewCart(catalog: Perfume[], lines: CartLine[]) {
  return lines.map((line) => {
    const item = findItem(catalog, line)
    let issue = ''
    if (!item) issue = 'This perfume or decant size is no longer listed.'
    else if (!item.perfume.available || !item.variant.available) issue = 'This concentration is currently unavailable.'
    else {
      const requested = lines.reduce((volume, other) => {
        if (other.perfumeId !== line.perfumeId || other.variantId !== line.variantId) return volume
        return volume + other.quantity * volumeUnits(findItem(catalog, other)?.size.ml ?? 0)
      }, 0)
      if (requested > volumeUnits(item.variant.remainingMl)) issue = 'Reduce the combined quantities for this concentration.'
    }
    const priceChanged = !!item && line.quotedCentavos !== undefined && item.size.centavos !== line.quotedCentavos
    return { line, item, issue, priceChanged }
  })
}

export type ReviewedLine = ReturnType<typeof reviewCart>[number]

export const subtotalFor = (rows: ReviewedLine[]) => rows.reduce((total, { line, item }) => total + line.quantity * (item?.size.centavos ?? 0), 0)

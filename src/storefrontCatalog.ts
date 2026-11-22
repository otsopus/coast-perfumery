import { catalogImageUrl } from './catalog'
import type { StorefrontPerfume } from './catalog'
import { itemId } from './cart'
import type { CartLimits, CartRequestLine } from './cart'
import { getSupabaseClient } from './supabase'
import type { CatalogListing } from './supabase'

function normalizeCatalog(listings: CatalogListing[]): StorefrontPerfume[] {
  return listings.map((listing) => ({
    ...listing,
    image: catalogImageUrl(listing.image),
    gallery: listing.gallery?.map(catalogImageUrl),
    variants: listing.variants.map((variant) => ({
      ...variant,
      description: variant.description ?? undefined,
      notes: variant.notes ?? undefined,
      images: variant.images?.map(catalogImageUrl),
    })),
  }))
}

export async function loadStorefrontCatalog(signal: AbortSignal): Promise<StorefrontPerfume[]> {
  const { data, error } = await getSupabaseClient().rpc('get_storefront_catalog').abortSignal(signal)
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('Unexpected catalog response.')
  return normalizeCatalog(data)
}

export type CartSnapshot = { catalog: StorefrontPerfume[]; limits: CartLimits }

export async function loadCartSnapshot(lines: CartRequestLine[], selectedPerfume: string | null, signal: AbortSignal): Promise<CartSnapshot> {
  const { data, error } = await getSupabaseClient().rpc('validate_storefront_cart', {
    cart_lines: lines.map(({ perfumeId, variantId, sizeId, quantity }) => ({ perfumeId, variantId, sizeId, quantity })),
    selected_perfume_id: selectedPerfume,
  }).abortSignal(signal)
  if (error) throw new Error(error.message)
  if (!Array.isArray(data?.catalog) || !Array.isArray(data.limits)) throw new Error('Unexpected cart response.')

  return {
    catalog: normalizeCatalog(data.catalog),
    limits: new Map(data.limits.map((limit) => [itemId(limit), limit.maxQuantity])),
  }
}

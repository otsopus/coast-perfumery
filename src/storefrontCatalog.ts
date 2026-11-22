import { catalogImageUrl } from './catalog'
import type { StorefrontPerfume } from './catalog'
import { getSupabaseClient } from './supabase'

export async function loadStorefrontCatalog(signal: AbortSignal): Promise<StorefrontPerfume[]> {
  const { data, error } = await getSupabaseClient().rpc('get_storefront_catalog').abortSignal(signal)
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('Unexpected catalog response.')

  return data.map((listing) => ({
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

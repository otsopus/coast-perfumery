import { catalogPhotoBucket } from './catalog'
import type { Variant } from './catalog'
import { getSupabaseClient } from './supabase'
import type { InventoryAdjustment, StaffListing, StaffListingDraft } from './supabase'

export type StaffCatalogData = { catalog: StaffListing[]; history: InventoryAdjustment[] }
export type StockSelection = { perfume: StaffListing; variant: Variant; type: InventoryAdjustment['type'] }

const extensions = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
])

export async function loadStaffCatalog(signal?: AbortSignal): Promise<StaffCatalogData> {
  const request = getSupabaseClient().rpc('staff_catalog')
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw new Error(error.message)
  if (!data) throw new Error('The staff catalog did not load.')
  return {
    history: data.history,
    catalog: data.catalog.map((listing) => ({
      ...listing,
      variants: listing.variants.map((variant) => ({
        ...variant,
        description: variant.description ?? undefined,
        notes: variant.notes ?? undefined,
      })),
    })),
  }
}

async function cleanUpPhotos(paths: string[]) {
  if (!paths.length) return true
  try {
    const { data, error } = await getSupabaseClient().storage.from(catalogPhotoBucket).remove(paths)
    return !error && data?.length === paths.length
  } catch {
    return false
  }
}

const cleanupWarning = 'Some unused uploads could not be removed. Check Supabase Storage before deleting them manually.'

export async function saveStaffListing(listing: StaffListingDraft, revision: number | null, files: ReadonlyMap<string, File>) {
  const client = getSupabaseClient()
  const uploadedPaths: string[] = []
  const pictures = new Map<string, string>()
  const references = [
    listing.image, ...(listing.gallery ?? []),
    ...listing.variants.flatMap((variant) => variant.images ?? []),
  ]
  let obsoletePaths: string[]
  try {
    for (const reference of new Set(references)) {
      const file = files.get(reference)
      if (!file) continue
      const extension = extensions.get(file.type)
      if (!extension) throw new Error('Choose a JPEG, PNG, or WebP photo.')
      const path = `${listing.id}/${crypto.randomUUID()}.${extension}`
      uploadedPaths.push(path)
      const { error } = await client.storage.from(catalogPhotoBucket).upload(path, file)
      if (error) throw new Error(error.message)
      pictures.set(reference, `storage:${path}`)
    }

    const photo = (reference: string) => pictures.get(reference) ?? reference
    const { data, error } = await client.rpc('staff_save_listing', {
      expected_revision: revision,
      listing: {
        ...listing,
        image: photo(listing.image),
        gallery: listing.gallery?.map(photo),
        variants: listing.variants.map((variant) => ({ ...variant, images: variant.images?.map(photo) })),
      },
    })
    if (error) throw new Error(error.message)
    obsoletePaths = data ?? []
  } catch (error) {
    const cleaned = await cleanUpPhotos(uploadedPaths)
    const message = error instanceof Error ? error.message : 'The listing could not be saved.'
    throw new Error(cleaned ? message : `${message} ${cleanupWarning}`)
  }
  if (!await cleanUpPhotos(obsoletePaths)) return cleanupWarning
}

export async function deleteStaffListing(listing: StaffListing) {
  const { data, error } = await getSupabaseClient().rpc('staff_delete_listing', {
    listing_id: listing.id, expected_revision: listing.revision,
  })
  if (error) throw new Error(error.message)
  if (!await cleanUpPhotos(data ?? [])) return cleanupWarning
}

export async function setStaffAvailability(listing: StaffListing, enabled: boolean, variant?: Variant) {
  const { error } = await getSupabaseClient().rpc('staff_set_availability', {
    listing_id: listing.id, concentration_id: variant?.id ?? null, expected_revision: listing.revision, enabled,
  })
  if (error) throw new Error(error.message)
}

export async function adjustStaffStock(selection: StockSelection, volume: number, adjustmentId: string) {
  const { error } = await getSupabaseClient().rpc('staff_change_stock', {
    listing_id: selection.perfume.id,
    concentration_id: selection.variant.id,
    adjustment_kind: selection.type,
    expected_volume: selection.variant.remainingMl,
    expected_revision: selection.perfume.revision,
    adjustment_id: adjustmentId,
    volume,
  })
  if (error) throw new Error(error.message)
}

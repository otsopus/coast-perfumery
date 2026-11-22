import { createClient } from '@supabase/supabase-js'
import type { Notes, Perfume, StorefrontPerfume, Variant } from './catalog'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export type CatalogListing = Omit<StorefrontPerfume, 'variants'> & {
  variants: (Omit<StorefrontPerfume['variants'][number], 'description' | 'notes'> & {
    description: string | null; notes: Notes | null
  })[]
}

export type StaffListingDraft = Perfume & { published: boolean }
export type StaffListing = StaffListingDraft & { revision: number }
export type InventoryAdjustment = {
  id: string; staffId: string; perfume: string; concentration: string
  type: 'Deduct' | 'Correct'; before: number; after: number; date: string
}

type StaffCatalog = {
  catalog: (Omit<StaffListing, 'variants'> & {
    variants: (Omit<Variant, 'description' | 'notes'> & { description: string | null; notes: Notes | null })[]
  })[]
  history: InventoryAdjustment[]
}

type Database = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: {
      get_storefront_catalog: { Args: Record<never, never>; Returns: CatalogListing[] }
      staff_catalog: { Args: Record<never, never>; Returns: StaffCatalog }
      staff_save_listing: { Args: { listing: StaffListingDraft; expected_revision: number | null }; Returns: string[] }
      staff_set_availability: {
        Args: { listing_id: string; concentration_id: string | null; enabled: boolean; expected_revision: number }
        Returns: undefined
      }
      staff_change_stock: {
        Args: {
          listing_id: string; concentration_id: string; adjustment_kind: InventoryAdjustment['type']
          volume: number; expected_volume: number; expected_revision: number; adjustment_id: string
        }
        Returns: undefined
      }
      staff_delete_listing: { Args: { listing_id: string; expected_revision: number }; Returns: string[] }
    }
  }
}

let client: ReturnType<typeof createClient<Database>> | undefined

export function getSupabaseClient() {
  if (!url || !publishableKey) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart Vite.')
  }

  client ??= createClient<Database>(url, publishableKey)
  return client
}

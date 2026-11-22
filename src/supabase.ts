import { createClient } from '@supabase/supabase-js'
import type { StorefrontPerfume } from './catalog'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export type CatalogListing = Omit<StorefrontPerfume, 'variants'> & {
  variants: (Omit<StorefrontPerfume['variants'][number], 'description'> & { description: string | null })[]
}

type Database = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: {
      get_storefront_catalog: { Args: Record<never, never>; Returns: CatalogListing[] }
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

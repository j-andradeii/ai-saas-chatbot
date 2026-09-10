import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Built on first use rather than at module scope. `next build` evaluates every
 * route module while collecting page data, so a client constructed at import
 * time throws "supabaseUrl is required" whenever the environment variables are
 * absent from the build environment -- and a service-role client has no
 * business existing at build time anyway.
 */
function getClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'supabaseAdmin requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
        'Set both on the Vercel project (Production scope).'
    )
  }

  client = createClient(url, serviceRoleKey)
  return client
}

/**
 * Keeps the `supabaseAdmin.from(...)` shape its 37 call sites already use, but
 * defers construction to the first property access.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getClient()
    const value = Reflect.get(instance, prop) as unknown
    return typeof value === 'function' ? value.bind(instance) : value
  },
})

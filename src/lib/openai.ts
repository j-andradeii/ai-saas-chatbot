import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Used exclusively for text-embedding-3-small (RAG)
// Chat completions use Vercel AI SDK via lib/ai/provider.ts

let _client: OpenAI | null = null

/**
 * Get an OpenAI client using the platform API key from the llm_providers table.
 * Falls back to the OPENAI_API_KEY env var if set.
 */
export async function getOpenAIClient(): Promise<OpenAI> {
  if (_client) return _client

  // Try the platform key from the database first
  const { data: provider } = await supabaseAdmin
    .from('llm_providers')
    .select('platform_api_key, is_enabled')
    .eq('name', 'openai')
    .single()

  const apiKey = provider?.platform_api_key || process.env.OPENAI_API_KEY

  if (!apiKey || apiKey === 'sk-placeholder') {
    throw new Error(
      'No OpenAI API key configured. Set one at /admin/providers.'
    )
  }

  _client = new OpenAI({ apiKey })
  return _client
}

/**
 * Clear the cached client (e.g. when the admin updates the API key).
 */
export function clearOpenAIClient(): void {
  _client = null
}

import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * document_chunks.embedding and match_chunks() are both extensions.vector(1536),
 * so every provider here must emit exactly this width. OpenAI's
 * text-embedding-3-small is natively 1536; Gemini defaults to 3072 and is asked
 * for 1536 via outputDimensionality.
 */
export const EMBEDDING_DIMENSIONS = 1536

/**
 * Providers that expose an embedding API, in fallback order. Anthropic has no
 * embedding endpoint at all, so an Anthropic chatbot borrows whichever of these
 * has a platform key configured.
 */
const EMBEDDING_MODELS = {
  openai: 'text-embedding-3-small',
  google: 'gemini-embedding-001',
} as const

type EmbeddingProvider = keyof typeof EMBEDDING_MODELS

function supportsEmbeddings(provider: string): provider is EmbeddingProvider {
  return provider in EMBEDDING_MODELS
}

/** Honours is_enabled, so disabling a provider in /admin/providers stops embeddings too. */
async function platformKeyFor(provider: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('llm_providers')
    .select('platform_api_key, is_enabled')
    .eq('name', provider)
    .single()

  if (!data || !data.is_enabled) return null
  const key = data.platform_api_key
  // The repo ships a placeholder; treat it as absent rather than 401-ing later.
  if (!key || key === 'sk-placeholder' || key.startsWith('sk-your-')) return null
  return key
}

async function resolveEmbeddingModel(preferred: string) {
  const order = [preferred, 'openai', 'google'].filter(
    (name, i, all) => supportsEmbeddings(name) && all.indexOf(name) === i
  ) as EmbeddingProvider[]

  for (const provider of order) {
    const apiKey = await platformKeyFor(provider)
    if (!apiKey) continue

    const modelId = EMBEDDING_MODELS[provider]
    const model =
      provider === 'google'
        ? createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(modelId)
        : createOpenAI({ apiKey }).textEmbeddingModel(modelId)

    return { provider, modelId, model }
  }

  throw new Error(
    'No embedding provider is configured. Add a platform API key for OpenAI or Google at /admin/providers.'
  )
}

/**
 * Embed one string with the chatbot's own provider where possible.
 *
 * `task` matters for Gemini: it embeds stored passages and search queries into
 * different spaces, and mismatching them measurably degrades recall. OpenAI
 * ignores it.
 *
 * Returns the model id alongside the vector because vectors from different
 * models are not comparable — the caller stores it so match_chunks() can
 * restrict a search to chunks embedded the same way.
 */
export async function embedText(
  text: string,
  preferredProvider = 'openai',
  task: 'document' | 'query' = 'query'
): Promise<{ embedding: number[]; model: string }> {
  const { provider, modelId, model } = await resolveEmbeddingModel(preferredProvider)

  const { embedding } = await embed({
    model,
    value: text,
    ...(provider === 'google'
      ? {
          providerOptions: {
            google: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
              taskType: task === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
            },
          },
        }
      : {}),
  })

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `${modelId} returned a ${embedding.length}-dimension vector; document_chunks.embedding is vector(${EMBEDDING_DIMENSIONS}).`
    )
  }

  return { embedding, model: modelId }
}

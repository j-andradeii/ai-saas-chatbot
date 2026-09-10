import { embedText } from '@/lib/embeddings'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Split text into overlapping chunks, preferring sentence boundaries.
 */
export function chunkText(
  text: string,
  maxChunkSize = 500,
  overlap = 50
): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (trimmed.length <= maxChunkSize) return [trimmed]

  const chunks: string[] = []
  let start = 0

  while (start < trimmed.length) {
    let end = Math.min(start + maxChunkSize, trimmed.length)

    // If we're not at the end, try to find a sentence boundary
    if (end < trimmed.length) {
      const slice = trimmed.slice(start, end)
      // Look for last sentence-ending punctuation followed by space or EOL
      // Find the last sentence-ending punctuation in the slice
      let sentenceEnd = -1
      for (let i = slice.length - 1; i >= 0; i--) {
        if ((slice[i] === '.' || slice[i] === '!' || slice[i] === '?') &&
            (i === slice.length - 1 || slice[i + 1] === ' ' || slice[i + 1] === '\n')) {
          sentenceEnd = i
          break
        }
      }
      if (sentenceEnd !== -1 && sentenceEnd > maxChunkSize * 0.3) {
        end = start + sentenceEnd + 1 // Include the punctuation
      } else {
        // Fall back to last space
        const lastSpace = slice.lastIndexOf(' ')
        if (lastSpace > maxChunkSize * 0.3) {
          end = start + lastSpace
        }
      }
    }

    chunks.push(trimmed.slice(start, end).trim())
    start = Math.max(start + 1, end - overlap)
  }

  return chunks
}

/**
 * Search for document chunks similar to the query text.
 */
export async function searchSimilarChunks(
  query: string,
  chatbotId: string,
  matchCount = 5,
  preferredProvider = 'openai'
): Promise<{ content: string; similarity: number }[]> {
  try {
    const { embedding, model } = await embedText(query, preferredProvider, 'query')

    // Vectors from different embedding models are not comparable, so the search
    // is restricted to chunks that were embedded with this same model. Chunks
    // stored under a previous provider stay put and are simply not matched
    // until the document is re-uploaded.
    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: embedding,
      chatbot_id_param: chatbotId,
      match_count: matchCount,
      match_threshold: 0.3,
      embedding_model_param: model,
    })

    if (error) {
      console.error('match_chunks RPC error:', error)
      return []
    }

    return data ?? []
  } catch (err) {
    console.error('searchSimilarChunks error:', err)
    return []
  }
}

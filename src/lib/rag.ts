import { getOpenAIClient } from '@/lib/openai'
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
 * Generate embedding vector for a text string using OpenAI.
 */
export async function embedText(text: string): Promise<number[]> {
  const openai = await getOpenAIClient()
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Search for document chunks similar to the query text.
 */
export async function searchSimilarChunks(
  query: string,
  chatbotId: string,
  matchCount = 5
): Promise<{ content: string; similarity: number }[]> {
  try {
    const queryEmbedding = await embedText(query)

    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      chatbot_id_param: chatbotId,
      match_count: matchCount,
      match_threshold: 0.3,
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

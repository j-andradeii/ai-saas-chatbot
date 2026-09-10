import { describe, it, expect, vi, beforeEach } from 'vitest'

// embedText resolves the provider itself; rag.ts just consumes the result.
const mockEmbedText = vi.fn()
vi.mock('@/lib/embeddings', () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}))

// Mock Supabase admin
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { chunkText, searchSimilarChunks } from './rag'

describe('chunkText', () => {
  it('returns single chunk for short text', () => {
    const result = chunkText('Hello world', 500)
    expect(result).toEqual(['Hello world'])
  })

  it('splits long text with overlap', () => {
    const text = 'A'.repeat(600)
    const chunks = chunkText(text, 500, 50)
    expect(chunks.length).toBeGreaterThan(1)
    // Verify overlap: end of first chunk should appear at start of second
    const firstEnd = chunks[0].slice(-50)
    expect(chunks[1].startsWith(firstEnd)).toBe(true)
  })

  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   ')).toEqual([])
  })

  it('preserves sentence boundaries', () => {
    const text =
      'First sentence here. Second sentence here. Third sentence here. ' +
      'Fourth sentence here. Fifth sentence here. Sixth sentence here. ' +
      'Seventh sentence here. Eighth sentence here. Ninth sentence here. ' +
      'Tenth sentence here. Eleventh sentence here.'
    const chunks = chunkText(text, 100, 20)
    // Each chunk should end at or near a sentence boundary (period)
    for (const chunk of chunks.slice(0, -1)) {
      // Non-final chunks should end with a period (sentence boundary)
      expect(chunk.endsWith('.')).toBe(true)
    }
  })
})

describe('searchSimilarChunks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedText.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      model: 'text-embedding-3-small',
    })
  })

  it('calls Supabase RPC with correct params', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await searchSimilarChunks('test query', 'chatbot-123', 5)

    expect(mockRpc).toHaveBeenCalledWith('match_chunks', {
      query_embedding: [0.1, 0.2, 0.3],
      chatbot_id_param: 'chatbot-123',
      match_count: 5,
      match_threshold: 0.3,
      embedding_model_param: 'text-embedding-3-small',
    })
  })

  it('embeds the query with the chatbot own provider', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await searchSimilarChunks('test query', 'chatbot-123', 5, 'google')

    expect(mockEmbedText).toHaveBeenCalledWith('test query', 'google', 'query')
  })

  it('scopes the search to chunks embedded by the same model', async () => {
    mockEmbedText.mockResolvedValue({
      embedding: [0.4, 0.5, 0.6],
      model: 'gemini-embedding-001',
    })
    mockRpc.mockResolvedValue({ data: [], error: null })

    await searchSimilarChunks('test query', 'chatbot-123', 5, 'google')

    expect(mockRpc).toHaveBeenCalledWith(
      'match_chunks',
      expect.objectContaining({ embedding_model_param: 'gemini-embedding-001' })
    )
  })

  it('returns results array on success', async () => {
    const mockResults = [
      { content: 'chunk 1', similarity: 0.9 },
      { content: 'chunk 2', similarity: 0.8 },
    ]
    mockRpc.mockResolvedValue({ data: mockResults, error: null })

    const result = await searchSimilarChunks('test', 'chatbot-1')
    expect(result).toEqual(mockResults)
  })

  it('returns empty array when no matches', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const result = await searchSimilarChunks('obscure query', 'chatbot-1')
    expect(result).toEqual([])
  })

  it('returns empty array on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' },
    })

    const result = await searchSimilarChunks('test', 'chatbot-1')
    expect(result).toEqual([])
  })
})

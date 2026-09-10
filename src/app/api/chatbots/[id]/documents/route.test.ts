import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockFrom, mockAdminFrom, mockStorageUpload, mockStorageDownload } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockAdminFrom = vi.fn()
  const mockStorageUpload = vi.fn().mockResolvedValue({ error: null })
  const mockStorageDownload = vi.fn().mockResolvedValue({ data: new Blob(['test']), error: null })
  return { mockGetUser, mockFrom, mockAdminFrom, mockStorageUpload, mockStorageDownload }
})

// Capture the after() promise so tests can await background processing
let afterPromise: Promise<void> | null = null
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    after: vi.fn((fn: () => Promise<void>) => {
      afterPromise = fn()
    }),
  }
})

// Mock RAG functions
const mockChunkText = vi.fn((..._args: unknown[]) => ['chunk1', 'chunk2'])
const mockEmbedText = vi.fn((..._args: unknown[]) => Promise.resolve([0.1, 0.2]))
vi.mock('@/lib/rag', () => ({
  chunkText: (...args: unknown[]) => mockChunkText(...args),
  embedText: (...args: unknown[]) => mockEmbedText(...args),
}))

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  PDFParse: class MockPDFParse {
    getText() { return Promise.resolve({ text: 'PDF extracted text' }) }
    destroy() { return Promise.resolve() }
  },
}))

// Mock mammoth
vi.mock('mammoth', () => ({
  extractRawText: vi.fn(() => Promise.resolve({ value: 'DOCX extracted text' })),
}))

// Mock supabase/server createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: unknown[]) => mockFrom(...args),
    })
  ),
}))

// Mock supabase/admin
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        download: mockStorageDownload,
      })),
    },
  },
}))

import { GET, POST } from './route'

function createParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('Documents API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    afterPromise = null
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockStorageUpload.mockResolvedValue({ error: null })
    mockStorageDownload.mockResolvedValue({ data: new Blob(['test content']), error: null })

    // Default admin mock
    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'default' } }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'default' } }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
  })

  function mockChatbotOwnership(userId: string) {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: userId },
            error: null,
          }),
        }),
      }),
    })
  }

  // ── GET tests ──────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 for unauthenticated user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } })

      const request = new Request('http://localhost/api/chatbots/bot-1/documents')
      const response = await GET(request, createParams('bot-1'))
      expect(response.status).toBe(401)
    })

    it('returns 403 when user does not own chatbot', async () => {
      mockChatbotOwnership('other-user')

      const request = new Request('http://localhost/api/chatbots/bot-1/documents')
      const response = await GET(request, createParams('bot-1'))
      expect(response.status).toBe(403)
    })

    it('returns 403 when chatbot not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      const request = new Request('http://localhost/api/chatbots/bot-1/documents')
      const response = await GET(request, createParams('bot-1'))
      expect(response.status).toBe(403)
    })

    it('returns 500 when document query fails', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
              }),
            }),
          }),
        }
      })

      const request = new Request('http://localhost/api/chatbots/bot-1/documents')
      const response = await GET(request, createParams('bot-1'))
      expect(response.status).toBe(500)
    })

    it('returns list of documents for chatbot', async () => {
      let callCount = 0
      mockFrom.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: 'doc-1', file_name: 'a.pdf', status: 'ready' },
                  { id: 'doc-2', file_name: 'b.txt', status: 'pending' },
                ],
                error: null,
              }),
            }),
          }),
        }
      })

      const request = new Request('http://localhost/api/chatbots/bot-1/documents')
      const response = await GET(request, createParams('bot-1'))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toHaveLength(2)
    })
  })

  // ── POST tests ─────────────────────────────────────────────

  describe('POST', () => {
    it('returns 401 for unauthenticated user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } })

      const formData = new FormData()
      formData.append('file', new File(['x'], 'test.txt', { type: 'text/plain' }))
      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(401)
    })

    it('returns 403 when user does not own chatbot', async () => {
      mockChatbotOwnership('other-user')

      const formData = new FormData()
      formData.append('file', new File(['x'], 'test.txt', { type: 'text/plain' }))
      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(403)
    })

    it('returns 400 when no file provided', async () => {
      mockChatbotOwnership('user-1')

      const formData = new FormData()
      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('No file provided')
    })

    it('returns 400 for invalid MIME type', async () => {
      mockChatbotOwnership('user-1')

      const formData = new FormData()
      formData.append('file', new File(['hello'], 'test.exe', { type: 'application/octet-stream' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Invalid file type')
    })

    it('returns 400 for file > 10MB', async () => {
      mockChatbotOwnership('user-1')

      const bigFile = { name: 'big.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 } as File
      const request = {
        formData: vi.fn().mockResolvedValue({
          get: vi.fn().mockReturnValue(bigFile),
        }),
      } as unknown as Request
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(400)
    })

    it('returns 500 when storage upload fails', async () => {
      mockChatbotOwnership('user-1')
      mockStorageUpload.mockResolvedValue({ error: { message: 'Storage full' } })

      const formData = new FormData()
      formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toContain('Upload failed')
    })

    it('returns 500 when document insert fails', async () => {
      mockChatbotOwnership('user-1')
      mockAdminFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      const formData = new FormData()
      formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })
      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(500)
    })

    it('returns 201 and triggers background processing for TXT file', async () => {
      mockChatbotOwnership('user-1')

      const updateCalls: Record<string, unknown>[] = []
      const chunkInsertMock = vi.fn().mockResolvedValue({ error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'knowledge_documents') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'doc-1', chatbot_id: 'bot-1', file_name: 'test.txt', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((arg: Record<string, unknown>) => {
              updateCalls.push(arg)
              return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'doc-1',
                    chatbot_id: 'bot-1',
                    file_url: 'user-1/bot-1/test.txt',
                    mime_type: 'text/plain',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'document_chunks') {
          return { insert: chunkInsertMock }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      })

      const formData = new FormData()
      formData.append('file', new File(['hello world content'], 'test.txt', { type: 'text/plain' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(201)

      // Wait for background processing
      await afterPromise

      expect(mockChunkText).toHaveBeenCalled()
      expect(mockEmbedText).toHaveBeenCalled()
      expect(chunkInsertMock).toHaveBeenCalledTimes(2) // 2 chunks from mock
      expect(updateCalls.some(c => c.status === 'processing')).toBe(true)
      expect(updateCalls.some(c => c.status === 'ready')).toBe(true)
    })

    it('sets status to error when processDocument fails', async () => {
      mockChatbotOwnership('user-1')

      const updateCalls: Record<string, unknown>[] = []

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'knowledge_documents') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'doc-1', chatbot_id: 'bot-1', file_name: 'test.txt', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((arg: Record<string, unknown>) => {
              updateCalls.push(arg)
              return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      })

      const formData = new FormData()
      formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(201)

      await afterPromise

      const errorUpdate = updateCalls.find(c => c.status === 'error')
      expect(errorUpdate).toBeTruthy()
      expect((errorUpdate as Record<string, unknown>).error_message).toBe('Document not found')
    })

    it('handles PDF extraction in processDocument', async () => {
      mockChatbotOwnership('user-1')

      const chunkInsertMock = vi.fn().mockResolvedValue({ error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'knowledge_documents') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'doc-1', chatbot_id: 'bot-1', file_name: 'test.pdf', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'doc-1',
                    chatbot_id: 'bot-1',
                    file_url: 'user-1/bot-1/test.pdf',
                    mime_type: 'application/pdf',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'document_chunks') {
          return { insert: chunkInsertMock }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      })

      const formData = new FormData()
      formData.append('file', new File(['pdf-bytes'], 'test.pdf', { type: 'application/pdf' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(201)
      await afterPromise
      expect(mockChunkText).toHaveBeenCalled()
      expect(chunkInsertMock).toHaveBeenCalled()
    })

    it('handles DOCX extraction in processDocument', async () => {
      mockChatbotOwnership('user-1')

      const chunkInsertMock = vi.fn().mockResolvedValue({ error: null })

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'knowledge_documents') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'doc-1', chatbot_id: 'bot-1', file_name: 'test.docx', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'doc-1',
                    chatbot_id: 'bot-1',
                    file_url: 'user-1/bot-1/test.docx',
                    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'document_chunks') {
          return { insert: chunkInsertMock }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      })

      const formData = new FormData()
      formData.append('file', new File(['docx-bytes'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(201)
      await afterPromise
      expect(mockChunkText).toHaveBeenCalled()
      expect(chunkInsertMock).toHaveBeenCalled()
    })

    it('sets error when storage download fails during processing', async () => {
      mockChatbotOwnership('user-1')
      mockStorageDownload.mockResolvedValue({ data: null, error: { message: 'Download failed' } })

      const updateCalls: Record<string, unknown>[] = []

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === 'knowledge_documents') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'doc-1', chatbot_id: 'bot-1', file_name: 'test.txt', status: 'pending' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((arg: Record<string, unknown>) => {
              updateCalls.push(arg)
              return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'doc-1',
                    chatbot_id: 'bot-1',
                    file_url: 'user-1/bot-1/test.txt',
                    mime_type: 'text/plain',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      })

      const formData = new FormData()
      formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }))

      const request = new Request('http://localhost/api/chatbots/bot-1/documents', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request, createParams('bot-1'))
      expect(response.status).toBe(201)
      await afterPromise

      const errorCall = updateCalls.find(c => c.status === 'error')
      expect(errorCall).toBeTruthy()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useDocuments, useUploadDocument, useDeleteDocument } from './useDocuments'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches document list for a chatbot', async () => {
    const docs = [
      { id: 'doc-1', file_name: 'a.pdf', status: 'ready' },
      { id: 'doc-2', file_name: 'b.txt', status: 'pending' },
    ]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(docs),
    })

    const { result } = renderHook(() => useDocuments('bot-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(docs)
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/bot-1/documents')
  })

  it('does not fetch when chatbotId is empty', () => {
    const { result } = renderHook(() => useDocuments(''), { wrapper: createWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useDocuments('bot-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to fetch documents')
  })
})

describe('useUploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends POST with FormData on upload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'doc-1', file_name: 'test.pdf', status: 'pending' }),
    })

    const { result } = renderHook(() => useUploadDocument('bot-1'), { wrapper: createWrapper() })

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    result.current.mutate(file)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/bot-1/documents', {
      method: 'POST',
      body: expect.any(FormData),
    })
  })

  it('throws error with server message on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid file type' }),
    })

    const { result } = renderHook(() => useUploadDocument('bot-1'), { wrapper: createWrapper() })

    result.current.mutate(new File(['x'], 'test.exe', { type: 'application/octet-stream' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Invalid file type')
  })
})

describe('useDeleteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends DELETE request for document', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })

    const { result } = renderHook(() => useDeleteDocument('bot-1'), { wrapper: createWrapper() })

    result.current.mutate('doc-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/bot-1/documents/doc-1', {
      method: 'DELETE',
    })
  })

  it('throws on delete failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useDeleteDocument('bot-1'), { wrapper: createWrapper() })

    result.current.mutate('doc-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to delete document')
  })
})

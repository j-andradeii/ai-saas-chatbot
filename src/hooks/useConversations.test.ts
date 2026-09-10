import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useConversations, useConversation } from './useConversations'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockConversation = {
  id: 'conv-1',
  chatbot_id: 'cb-1',
  visitor_id: 'v-1',
  started_at: '2024-01-01',
  last_message_at: '2024-01-01',
  message_count: 3,
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all conversations without chatbotId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockConversation]),
    })

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([mockConversation])
    expect(mockFetch).toHaveBeenCalledWith('/api/conversations')
  })

  it('fetches conversations filtered by chatbotId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockConversation]),
    })

    const { result } = renderHook(() => useConversations('cb-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/conversations?chatbotId=cb-1')
  })

  it('throws on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to fetch conversations')
  })
})

describe('useConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single conversation with messages', async () => {
    const conversationWithMessages = {
      ...mockConversation,
      messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(conversationWithMessages),
    })

    const { result } = renderHook(() => useConversation('conv-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.messages).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/conversations/conv-1')
  })

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useConversation(''), { wrapper: createWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

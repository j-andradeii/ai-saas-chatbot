import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useChatbots, useChatbot, useCreateChatbot, useUpdateChatbot, useDeleteChatbot } from './useChatbots'
import type { Chatbot } from '@/types'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockChatbot: Chatbot = {
  id: 'cb-1',
  user_id: 'user-1',
  name: 'Test Bot',
  domain: 'example.com',
  personality_prompt: '',
  welcome_message: '',
  skills: [],
  quick_actions: [],
  llm_provider: 'openai',
  llm_model: 'gpt-4o-mini',
  api_key: '',
  primary_color: '#6366f1',
  widget_position: 'bottom-right',
  active: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  Wrapper.displayName = 'QueryClientWrapper'
  return Wrapper
}

describe('useChatbots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches chatbot list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([mockChatbot]),
    })

    const { result } = renderHook(() => useChatbots(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([mockChatbot])
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots')
  })

  it('throws on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useChatbots(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to fetch chatbots')
  })
})

describe('useChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a single chatbot by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockChatbot),
    })

    const { result } = renderHook(() => useChatbot('cb-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockChatbot)
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/cb-1')
  })

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useChatbot(''), { wrapper: createWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('useCreateChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends POST request with chatbot data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockChatbot),
    })

    const { result } = renderHook(() => useCreateChatbot(), { wrapper: createWrapper() })

    result.current.mutate({ name: 'New Bot', domain: 'test.com' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Bot', domain: 'test.com' }),
    })
  })

  it('reports error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })

    const { result } = renderHook(() => useCreateChatbot(), { wrapper: createWrapper() })

    result.current.mutate({ name: 'New Bot', domain: 'test.com' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to create chatbot')
  })
})

describe('useUpdateChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends PATCH request with partial chatbot data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockChatbot, name: 'Updated Bot' }),
    })

    const { result } = renderHook(() => useUpdateChatbot('cb-1'), { wrapper: createWrapper() })

    result.current.mutate({ name: 'Updated Bot' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/cb-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Bot' }),
    })
  })
})

describe('useDeleteChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    const { result } = renderHook(() => useDeleteChatbot(), { wrapper: createWrapper() })

    result.current.mutate('cb-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFetch).toHaveBeenCalledWith('/api/chatbots/cb-1', { method: 'DELETE' })
  })

  it('reports error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useDeleteChatbot(), { wrapper: createWrapper() })

    result.current.mutate('cb-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to delete chatbot')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersonalityForm } from './PersonalityForm'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

const mockMutate = vi.fn()
vi.mock('@/hooks/useChatbots', () => ({
  useUpdateChatbot: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

function createChatbot(overrides: Partial<Chatbot> = {}): Chatbot {
  return {
    id: 'chatbot-1',
    user_id: 'user-1',
    name: 'Test Bot',
    domain: 'example.com',
    personality_prompt: 'You are a helpful assistant.',
    welcome_message: 'Hello!',
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
    ...overrides,
  }
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('PersonalityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with initial values pre-filled', () => {
    const chatbot = createChatbot()
    renderWithProviders(<PersonalityForm chatbot={chatbot} />)

    expect(screen.getByDisplayValue('Test Bot')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('You are a helpful assistant.')
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hello!')).toBeInTheDocument()
  })

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<PersonalityForm chatbot={chatbot} />)

    const nameInput = screen.getByDisplayValue('Test Bot')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('submits form with updated values', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<PersonalityForm chatbot={chatbot} />)

    const nameInput = screen.getByDisplayValue('Test Bot')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Bot')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Bot' }),
        expect.any(Object)
      )
    })
  })

  it('displays error toast when submission fails', async () => {
    const user = userEvent.setup()
    mockMutate.mockImplementation((_data: unknown, opts: { onError: () => void }) => {
      opts.onError()
    })

    const chatbot = createChatbot()
    renderWithProviders(<PersonalityForm chatbot={chatbot} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Failed to save personality settings'
      )
    })
  })
})

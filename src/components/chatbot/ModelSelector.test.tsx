import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ModelSelector } from './ModelSelector'
import { toast } from 'sonner'
import type { Chatbot, LLMProvider } from '@/types'

const mockMutate = vi.fn()
vi.mock('@/hooks/useChatbots', () => ({
  useUpdateChatbot: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

const mockProviders: LLMProvider[] = [
  {
    id: 'p1',
    name: 'openai',
    display_name: 'OpenAI',
    models: [
      { id: 'm1', name: 'gpt-4o', input_cost_per_1m: 5, output_cost_per_1m: 15 },
      { id: 'm2', name: 'gpt-4o-mini', input_cost_per_1m: 0.15, output_cost_per_1m: 0.6 },
    ],
    platform_api_key: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'p2',
    name: 'anthropic',
    display_name: 'Anthropic',
    models: [
      { id: 'm3', name: 'claude-sonnet-4-20250514', input_cost_per_1m: 3, output_cost_per_1m: 15 },
    ],
    platform_api_key: null,
    is_enabled: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const mockUseEnabledProviders = vi.fn()
vi.mock('@/hooks/useProviders', () => ({
  useEnabledProviders: () => mockUseEnabledProviders(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

function createChatbot(overrides: Partial<Chatbot> = {}): Chatbot {
  return {
    id: 'chatbot-1',
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

describe('ModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEnabledProviders.mockReturnValue({
      data: mockProviders,
      isLoading: false,
    })
  })

  it('shows loading state when providers are loading', () => {
    mockUseEnabledProviders.mockReturnValue({ data: undefined, isLoading: true })
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)
    expect(screen.getByText('Loading providers...')).toBeInTheDocument()
  })

  it('renders provider cards', () => {
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('2 models')).toBeInTheDocument()
    expect(screen.getByText('1 models')).toBeInTheDocument()
  })

  it('renders model badges for the selected provider', () => {
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument()
  })

  it('switches provider and auto-selects first model on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)

    await user.click(screen.getByText('Anthropic'))

    await waitFor(() => {
      expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument()
    })
  })

  it('calls mutate with selected provider and model on save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)

    await user.click(screen.getByRole('button', { name: /save model/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        { llm_provider: 'openai', llm_model: 'gpt-4o-mini' },
        expect.any(Object)
      )
    })
  })

  it('shows error toast when no provider/model selected', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot({ llm_provider: '', llm_model: '' })
    renderWithProviders(<ModelSelector chatbot={chatbot} />)

    // Button should be disabled when no provider/model
    const saveButton = screen.getByRole('button', { name: /save model/i })
    expect(saveButton).toBeDisabled()
  })

  it('displays current model info', () => {
    renderWithProviders(<ModelSelector chatbot={createChatbot()} />)
    expect(screen.getByText('Current: openai / gpt-4o-mini')).toBeInTheDocument()
  })
})

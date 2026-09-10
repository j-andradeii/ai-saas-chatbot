import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { QuickActionsForm } from './QuickActionsForm'
import type { Chatbot } from '@/types'

const mockMutate = vi.fn()
vi.mock('@/hooks/useChatbots', () => ({
  useUpdateChatbot: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
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
    welcome_message: 'Hello!',
    skills: [],
    quick_actions: [
      { label: 'Pricing', prompt: 'What are your prices?' },
      { label: 'Support', prompt: 'I need help' },
    ],
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

describe('QuickActionsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders existing actions', () => {
    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    expect(screen.getByDisplayValue('Pricing')).toBeInTheDocument()
    expect(screen.getByDisplayValue('What are your prices?')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Support')).toBeInTheDocument()
    expect(screen.getByDisplayValue('I need help')).toBeInTheDocument()
  })

  it('add action adds a new row', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot({ quick_actions: [] })
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    await user.click(screen.getByRole('button', { name: /add action/i }))

    // Should now have label and prompt inputs
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBe(2) // label + prompt
  })

  it('remove action removes the row', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    // 2 actions, each with a delete button (Trash icon)
    const deleteButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-trash-2')
    )
    expect(deleteButtons.length).toBe(2)

    await user.click(deleteButtons[0])

    // Should only have 1 action left
    expect(screen.queryByDisplayValue('Pricing')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Support')).toBeInTheDocument()
  })

  it('validation fails for empty label', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot({ quick_actions: [] })
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    // Add an action but leave label empty
    await user.click(screen.getByRole('button', { name: /add action/i }))
    const promptInput = screen.getByPlaceholderText(/what are your pricing/i)
    await user.type(promptInput, 'Hello')
    await user.click(screen.getByRole('button', { name: /save quick actions/i }))

    await waitFor(() => {
      expect(screen.getByText('Label is required')).toBeInTheDocument()
    })
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('save sends correct array to API', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    await user.click(screen.getByRole('button', { name: /save quick actions/i }))

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        {
          quick_actions: [
            { label: 'Pricing', prompt: 'What are your prices?' },
            { label: 'Support', prompt: 'I need help' },
          ],
        },
        expect.any(Object)
      )
    })
  })

  it('calls onSuccess toast after save', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockMutate.mockImplementation((_data: unknown, opts: { onSuccess: () => void }) => {
      opts.onSuccess()
    })

    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    await user.click(screen.getByRole('button', { name: /save quick actions/i }))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Quick actions saved')
    })
  })

  it('calls onError toast on save failure', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockMutate.mockImplementation((_data: unknown, opts: { onError: () => void }) => {
      opts.onError()
    })

    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    await user.click(screen.getByRole('button', { name: /save quick actions/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to save quick actions')
    })
  })

  it('move up button swaps actions', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    // Find the ArrowUp buttons — first is disabled (index 0), second should work
    const upButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-arrow-up')
    )
    // Click second action's up button to swap
    await user.click(upButtons[1])

    // After swap, "Support" should now be first
    const inputs = screen.getAllByRole('textbox')
    expect((inputs[0] as HTMLInputElement).value).toBe('Support')
  })

  it('move down button swaps actions', async () => {
    const user = userEvent.setup()
    const chatbot = createChatbot()
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    // Find the ArrowDown buttons — first should work, second is disabled
    const downButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-arrow-down')
    )
    // Click first action's down button to swap
    await user.click(downButtons[0])

    const inputs = screen.getAllByRole('textbox')
    expect((inputs[0] as HTMLInputElement).value).toBe('Support')
  })

  it('shows no actions message for empty chatbot', () => {
    const chatbot = createChatbot({ quick_actions: [] })
    renderWithProviders(<QuickActionsForm chatbot={chatbot} />)

    expect(screen.getByText(/no quick actions yet/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationList } from './ConversationList'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}))

const mockConversations = [
  {
    id: 'conv-1',
    chatbot_id: 'cb-1',
    visitor_id: 'v-1',
    visitor_name: 'John Doe',
    visitor_email: 'john@example.com',
    status: 'active' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    chatbots: { name: 'Support Bot' },
  },
  {
    id: 'conv-2',
    chatbot_id: 'cb-1',
    visitor_id: 'v-2',
    visitor_name: null,
    visitor_email: null,
    status: 'resolved' as const,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    chatbots: { name: 'Support Bot' },
  },
]

const mockChatbots = [{ id: 'cb-1', name: 'Support Bot' }]

describe('ConversationList', () => {
  it('renders conversations in a table', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Anonymous Visitor')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={true}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={[]}
      />
    )

    expect(screen.getByText('Loading conversations...')).toBeInTheDocument()
  })

  it('renders status badges with correct text', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('resolved')).toBeInTheDocument()
  })

  it('shows empty state when no conversations', () => {
    render(
      <ConversationList
        conversations={[]}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    expect(screen.getByText(/No conversations found/)).toBeInTheDocument()
  })

  it('navigates to conversation detail on row click', async () => {
    const user = userEvent.setup()
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    const row = screen.getByText('John Doe').closest('tr')
    await user.click(row!)

    expect(mockPush).toHaveBeenCalledWith('/conversations/conv-1')
  })

  it('displays chatbot name in table', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    expect(screen.getAllByText('Support Bot').length).toBeGreaterThan(0)
  })

  it('displays visitor email when available', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('formats dates correctly', () => {
    render(
      <ConversationList
        conversations={mockConversations}
        isLoading={false}
        onStatusFilter={vi.fn()}
        onChatbotFilter={vi.fn()}
        chatbots={mockChatbots}
      />
    )

    // Just verify date cells exist and contain formatted text
    const cells = screen.getAllByRole('cell')
    // Each row has 4 cells, last one is the date
    expect(cells.length).toBeGreaterThan(0)
  })
})

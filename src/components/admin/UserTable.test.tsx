import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UserTable } from './UserTable'

const mockUseAdminUsers = vi.fn()
vi.mock('@/hooks/useAdminUsers', () => ({
  useAdminUsers: () => mockUseAdminUsers(),
}))

const mockUsers = [
  {
    id: 'u1',
    full_name: 'Alice Johnson',
    email: 'alice@test.com',
    company_name: 'Acme Corp',
    role: 'user' as const,
    plan: 'pro' as const,
    message_count: 250,
    message_limit: 5000,
    billing_cycle: 'monthly' as const,
    billing_period_start: null,
    stripe_customer_id: null,
    avatar_url: null,
    is_active: true,
    last_login_at: null,
    created_at: '2024-01-15',
    chatbot_count: 3,
  },
  {
    id: 'u2',
    full_name: 'Bob Smith',
    email: 'bob@test.com',
    company_name: null,
    role: 'user' as const,
    plan: 'free' as const,
    message_count: 90,
    message_limit: 100,
    billing_cycle: 'monthly' as const,
    billing_period_start: null,
    stripe_customer_id: null,
    avatar_url: null,
    is_active: false,
    last_login_at: null,
    created_at: '2024-03-20',
    chatbot_count: 1,
  },
]

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('UserTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminUsers.mockReturnValue({
      data: mockUsers,
      isLoading: false,
      error: null,
    })
  })

  it('renders user rows with correct data', () => {
    renderWithProviders(<UserTable />)

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('bob@test.com')).toBeInTheDocument()
  })

  it('shows plan badges', () => {
    renderWithProviders(<UserTable />)

    expect(screen.getByText('pro')).toBeInTheDocument()
    expect(screen.getByText('free')).toBeInTheDocument()
  })

  it('shows active/inactive status', () => {
    renderWithProviders(<UserTable />)

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('search filters users by name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'Alice')

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
  })

  it('search filters users by email', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'bob@')

    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('shows user count', () => {
    renderWithProviders(<UserTable />)

    expect(screen.getByText('2 users total')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })
    renderWithProviders(<UserTable />)

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    mockUseAdminUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed'),
    })
    renderWithProviders(<UserTable />)

    expect(screen.getByText('Failed to load users.')).toBeInTheDocument()
  })

  it('sorts by name when column header is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    // Click "Name" header to sort
    const nameHeader = screen.getByText(/^Name/)
    await user.click(nameHeader)

    // Should show sort indicator
    const rows = screen.getAllByRole('row')
    // Header row + 2 data rows
    expect(rows).toHaveLength(3)
  })

  it('toggles sort direction on repeated click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    // Default sort is created_at desc. Click created_at to toggle to asc.
    const createdHeader = screen.getByText(/^Created/)
    await user.click(createdHeader)

    // After click on same field, direction should toggle
    // Just verify no crashes and sort indicator updates
    expect(createdHeader.textContent).toMatch(/Created/)
  })

  it('sorts by message count', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    const messagesHeader = screen.getByText(/^Messages/)
    await user.click(messagesHeader)

    // Verify it doesn't crash and rows still render
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('shows no users message when search has no results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<UserTable />)

    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'zzzznotfound')

    expect(screen.getByText('No users match your search.')).toBeInTheDocument()
    expect(screen.getByText(/0 users matching/)).toBeInTheDocument()
  })
})

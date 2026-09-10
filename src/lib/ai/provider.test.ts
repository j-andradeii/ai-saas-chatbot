import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockCreateOpenAI = vi.fn()
const mockCreateAnthropic = vi.fn()
const mockCreateGoogle = vi.fn()

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: (...args: unknown[]) => mockCreateAnthropic(...args),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: (...args: unknown[]) => mockCreateGoogle(...args),
}))

import { getModelForChatbot } from './provider'

function mockProviderQuery(data: Record<string, unknown> | null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: data ? null : { message: 'Not found' } }),
      }),
    }),
  })
}

describe('getModelForChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns OpenAI model when provider is openai', async () => {
    const mockModel = { modelId: 'gpt-4o' }
    const modelFn = vi.fn().mockReturnValue(mockModel)
    mockCreateOpenAI.mockReturnValue(modelFn)

    const result = await getModelForChatbot({
      llm_provider: 'openai',
      llm_model: 'gpt-4o',
      api_key: 'sk-test-key',
    })

    expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test-key' })
    expect(modelFn).toHaveBeenCalledWith('gpt-4o')
    expect(result).toBe(mockModel)
  })

  it('returns Anthropic model when provider is anthropic', async () => {
    const mockModel = { modelId: 'claude-3' }
    const modelFn = vi.fn().mockReturnValue(mockModel)
    mockCreateAnthropic.mockReturnValue(modelFn)

    const result = await getModelForChatbot({
      llm_provider: 'anthropic',
      llm_model: 'claude-3-sonnet',
      api_key: 'sk-ant-test',
    })

    expect(mockCreateAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' })
    expect(modelFn).toHaveBeenCalledWith('claude-3-sonnet')
    expect(result).toBe(mockModel)
  })

  it('returns Google model when provider is google', async () => {
    const mockModel = { modelId: 'gemini-pro' }
    const modelFn = vi.fn().mockReturnValue(mockModel)
    mockCreateGoogle.mockReturnValue(modelFn)

    const result = await getModelForChatbot({
      llm_provider: 'google',
      llm_model: 'gemini-pro',
      api_key: 'goog-test',
    })

    expect(mockCreateGoogle).toHaveBeenCalledWith({ apiKey: 'goog-test' })
    expect(modelFn).toHaveBeenCalledWith('gemini-pro')
    expect(result).toBe(mockModel)
  })

  it('throws when no API key found for provider', async () => {
    mockProviderQuery(null)

    await expect(
      getModelForChatbot({
        llm_provider: 'openai',
        llm_model: 'gpt-4o',
        api_key: '',
      })
    ).rejects.toThrow('No API key configured for provider "openai"')
  })

  it('throws when provider is disabled', async () => {
    mockProviderQuery({ platform_api_key: 'sk-platform', is_enabled: false })

    await expect(
      getModelForChatbot({
        llm_provider: 'openai',
        llm_model: 'gpt-4o',
        api_key: '',
      })
    ).rejects.toThrow('Provider "openai" is currently disabled')
  })
})

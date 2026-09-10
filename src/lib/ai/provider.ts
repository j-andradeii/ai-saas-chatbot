import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getModelForChatbot(chatbot: {
  llm_provider: string
  llm_model: string
  api_key: string
}) {
  // If the chatbot has its own API key, use it; otherwise fetch the platform key
  let apiKey = chatbot.api_key

  if (!apiKey) {
    const { data: provider } = await supabaseAdmin
      .from('llm_providers')
      .select('platform_api_key, is_enabled')
      .eq('name', chatbot.llm_provider)
      .single()

    if (!provider || !provider.platform_api_key) {
      throw new Error(`No API key configured for provider "${chatbot.llm_provider}"`)
    }

    if (!provider.is_enabled) {
      throw new Error(`Provider "${chatbot.llm_provider}" is currently disabled`)
    }

    apiKey = provider.platform_api_key
  }

  switch (chatbot.llm_provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(chatbot.llm_model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(chatbot.llm_model)
    case 'openai':
    default:
      return createOpenAI({ apiKey })(chatbot.llm_model)
  }
}

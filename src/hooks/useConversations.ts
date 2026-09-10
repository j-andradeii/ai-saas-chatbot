import { useQuery } from '@tanstack/react-query'
import type { Conversation, Message } from '@/types'

export function useConversations(chatbotId?: string) {
  return useQuery<Conversation[]>({
    queryKey: ['conversations', { chatbotId }],
    queryFn: async () => {
      const url = chatbotId
        ? `/api/conversations?chatbotId=${chatbotId}`
        : '/api/conversations'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch conversations')
      return res.json()
    },
  })
}

export function useConversation(id: string) {
  return useQuery<Conversation & { messages: Message[] }>({
    queryKey: ['conversations', id],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) throw new Error('Failed to fetch conversation')
      return res.json()
    },
    enabled: !!id,
  })
}

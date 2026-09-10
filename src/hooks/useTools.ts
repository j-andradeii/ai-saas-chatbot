import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatbotTool } from '@/types'

export function useChatbotTools(chatbotId: string) {
  return useQuery<ChatbotTool[]>({
    queryKey: ['chatbot-tools', chatbotId],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/tools`)
      if (!res.ok) throw new Error('Failed to fetch tools')
      return res.json()
    },
    enabled: !!chatbotId,
  })
}

export function useCreateTool(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      description: string
      parameters: Record<string, string>
      webhook_url?: string
    }) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create tool')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-tools', chatbotId] })
    },
  })
}

export function useDeleteTool(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (toolId: string) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/tools/${toolId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete tool')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-tools', chatbotId] })
    },
  })
}

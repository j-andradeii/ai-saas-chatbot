import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Chatbot } from '@/types'

export function useChatbots() {
  return useQuery<Chatbot[]>({
    queryKey: ['chatbots'],
    queryFn: async () => {
      const res = await fetch('/api/chatbots')
      if (!res.ok) throw new Error('Failed to fetch chatbots')
      return res.json()
    },
  })
}

export function useChatbot(id: string) {
  return useQuery<Chatbot>({
    queryKey: ['chatbots', id],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${id}`)
      if (!res.ok) throw new Error('Failed to fetch chatbot')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateChatbot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; domain: string }) => {
      const res = await fetch('/api/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create chatbot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbots'] })
    },
  })
}

export function useUpdateChatbot(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Chatbot>) => {
      const res = await fetch(`/api/chatbots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update chatbot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbots', id] })
      queryClient.invalidateQueries({ queryKey: ['chatbots'] })
    },
  })
}

export function useDeleteChatbot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/chatbots/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete chatbot')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbots'] })
    },
  })
}

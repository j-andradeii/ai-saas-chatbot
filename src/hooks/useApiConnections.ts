import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiConnection, ApiConnectionParameter } from '@/types'

export function useApiConnections(chatbotId: string) {
  return useQuery<ApiConnection[]>({
    queryKey: ['api-connections', chatbotId],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/api-connections`)
      if (!res.ok) throw new Error('Failed to fetch API connections')
      return res.json()
    },
    enabled: !!chatbotId,
  })
}

export function useCreateApiConnection(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      description: string
      method: string
      url: string
      headers?: Record<string, string>
      request_body_template?: Record<string, unknown> | null
      parameters?: ApiConnectionParameter[]
      response_path?: string | null
      timeout_ms?: number
    }) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/api-connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create API connection')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections', chatbotId] })
    },
  })
}

export function useUpdateApiConnection(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ connectionId, data }: {
      connectionId: string
      data: Partial<{
        name: string
        description: string
        method: string
        url: string
        headers: Record<string, string>
        request_body_template: Record<string, unknown> | null
        parameters: ApiConnectionParameter[]
        response_path: string | null
        timeout_ms: number
        is_enabled: boolean
      }>
    }) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/api-connections/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update API connection')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections', chatbotId] })
    },
  })
}

export function useDeleteApiConnection(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/api-connections/${connectionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete API connection')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections', chatbotId] })
    },
  })
}

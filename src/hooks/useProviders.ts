import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LLMProvider } from '@/types'

export function useProviders() {
  return useQuery<LLMProvider[]>({
    queryKey: ['admin', 'providers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/providers')
      if (!res.ok) throw new Error('Failed to fetch providers')
      return res.json()
    },
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { id: string; platform_api_key?: string; is_enabled?: boolean }) => {
      const res = await fetch('/api/admin/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update provider')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] })
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}

/** Public hook — fetches enabled providers + models (no API keys) */
export function useEnabledProviders() {
  return useQuery<LLMProvider[]>({
    queryKey: ['providers'],
    queryFn: async () => {
      const res = await fetch('/api/providers')
      if (!res.ok) throw new Error('Failed to fetch providers')
      return res.json()
    },
  })
}

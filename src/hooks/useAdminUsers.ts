import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Profile } from '@/types'

export interface AdminUser extends Profile {
  chatbot_count: number
}

export interface AdminUserDetail extends Profile {
  chatbots: {
    id: string
    name: string
    domain: string
    llm_model: string | null
    active: boolean
    created_at: string
    conversation_count: number
  }[]
}

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
  })
}

export function useAdminUser(id: string) {
  return useQuery<AdminUserDetail>({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${id}`)
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useUpdateAdminUser(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      plan?: 'free' | 'pro' | 'enterprise'
      message_limit?: number
      is_active?: boolean
      role?: 'admin' | 'user'
    }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update user')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] })
    },
  })
}

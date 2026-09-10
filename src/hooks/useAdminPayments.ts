'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Payment } from '@/types'

export interface AdminPayment extends Payment {
  profiles?: {
    full_name: string | null
    email: string | null
    company_name: string | null
    plan: string
  }
}

export function useAdminPayments(status?: string) {
  return useQuery<AdminPayment[]>({
    queryKey: ['admin', 'payments', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : ''
      const res = await fetch(`/api/admin/payments${params}`)
      if (!res.ok) throw new Error('Failed to fetch payments')
      return res.json()
    },
  })
}

export function useReviewPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: string
      status: 'approved' | 'rejected'
      admin_notes?: string
    }) => {
      const res = await fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to review payment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
  })
}

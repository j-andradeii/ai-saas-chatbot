'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Payment, Profile } from '@/types'

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile')
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json()
    },
  })
}

export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch('/api/payments')
      if (!res.ok) throw new Error('Failed to fetch payments')
      return res.json()
    },
  })
}

export function useSubmitPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch('/api/payments', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to submit payment')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

export function useBankDetails() {
  return useQuery<Record<string, string>>({
    queryKey: ['bank-details'],
    queryFn: async () => {
      const res = await fetch('/api/settings/bank-details')
      if (!res.ok) throw new Error('Failed to fetch bank details')
      return res.json()
    },
  })
}

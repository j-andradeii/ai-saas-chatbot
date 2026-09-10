import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EnquiryForm, EnquiryFormField } from '@/types'

export function useEnquiryForms(chatbotId: string) {
  return useQuery<EnquiryForm[]>({
    queryKey: ['enquiry-forms', chatbotId],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/enquiry-forms`)
      if (!res.ok) throw new Error('Failed to fetch enquiry forms')
      return res.json()
    },
    enabled: !!chatbotId,
  })
}

export function useCreateEnquiryForm(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      display_name: string
      description: string
      fields: EnquiryFormField[]
      webhook_url?: string
      success_message?: string
    }) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/enquiry-forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create enquiry form')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-forms', chatbotId] })
    },
  })
}

export function useDeleteEnquiryForm(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (formId: string) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/enquiry-forms/${formId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete enquiry form')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-forms', chatbotId] })
    },
  })
}

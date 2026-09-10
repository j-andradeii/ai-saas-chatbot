import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { KnowledgeDocument } from '@/types'

export function useDocuments(chatbotId: string) {
  const query = useQuery<KnowledgeDocument[]>({
    queryKey: ['documents', chatbotId],
    queryFn: async () => {
      const res = await fetch(`/api/chatbots/${chatbotId}/documents`)
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
    enabled: !!chatbotId,
    // Poll when any document is still processing
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.some((d) => d.status === 'pending' || d.status === 'processing')) {
        return 5000
      }
      return false
    },
  })
  return query
}

export function useUploadDocument(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/chatbots/${chatbotId}/documents`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', chatbotId] })
    },
  })
}

export function useReprocessDocument(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Reprocess failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', chatbotId] })
    },
  })
}

export function useDeleteDocument(chatbotId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/chatbots/${chatbotId}/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete document')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', chatbotId] })
    },
  })
}

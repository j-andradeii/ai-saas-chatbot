import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  Enquiry,
  EnquiryActivity,
  EnquiryPriority,
  EnquiryTask,
  PipelineStage,
} from '@/types'

export interface UpdateEnquiryInput {
  is_read?: boolean
  pipeline_stage?: PipelineStage
  priority?: EnquiryPriority
  deal_value?: number | null
  next_action_at?: string | null
  lost_reason?: string | null
  tags?: string[]
}

interface EnquiryFilters {
  chatbotId?: string
  formName?: string
  isRead?: boolean
}

export function useEnquiries(filters?: EnquiryFilters) {
  return useQuery<Enquiry[]>({
    queryKey: ['enquiries', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.chatbotId) params.set('chatbotId', filters.chatbotId)
      if (filters?.formName) params.set('formName', filters.formName)
      if (filters?.isRead !== undefined) params.set('isRead', String(filters.isRead))
      const res = await fetch(`/api/enquiries?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch enquiries')
      return res.json()
    },
  })
}

export function useEnquiry(id: string) {
  return useQuery<Enquiry>({
    queryKey: ['enquiries', id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}`)
      if (!res.ok) throw new Error('Failed to fetch enquiry')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useMarkEnquiryRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: isRead }),
      })
      if (!res.ok) throw new Error('Failed to update enquiry')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] })
    },
  })
}

/** Generic funnel update: stage, priority, deal value, next action, tags. */
export function useUpdateEnquiry(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateEnquiryInput) => {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update enquiry')
      }
      return res.json() as Promise<Enquiry>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      queryClient.invalidateQueries({ queryKey: ['enquiry-activities', id] })
    },
  })
}

export function useEnquiryActivities(id: string) {
  return useQuery<EnquiryActivity[]>({
    queryKey: ['enquiry-activities', id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}/activities`)
      if (!res.ok) throw new Error('Failed to fetch activities')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useAddEnquiryNote(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/enquiries/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to add note')
      }
      return res.json() as Promise<EnquiryActivity>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-activities', id] })
    },
  })
}

export function useEnquiryTasks(id: string) {
  return useQuery<EnquiryTask[]>({
    queryKey: ['enquiry-tasks', id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}/tasks`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useAddEnquiryTask(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { title: string; due_at?: string | null }) => {
      const res = await fetch(`/api/enquiries/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to add task')
      }
      return res.json() as Promise<EnquiryTask>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['enquiry-activities', id] })
    },
  })
}

export function useToggleEnquiryTask(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, isDone }: { taskId: string; isDone: boolean }) => {
      const res = await fetch(`/api/enquiries/${id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: isDone }),
      })
      if (!res.ok) throw new Error('Failed to update task')
      return res.json() as Promise<EnquiryTask>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['enquiry-activities', id] })
    },
  })
}

export function useDeleteEnquiryTask(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/enquiries/${id}/tasks/${taskId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete task')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiry-tasks', id] })
    },
  })
}

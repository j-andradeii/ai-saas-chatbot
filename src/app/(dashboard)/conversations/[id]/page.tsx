'use client'

import { useParams, useRouter } from 'next/navigation'
import { useConversation } from '@/hooks/useConversations'

interface ConversationWithDetails {
  id: string
  chatbot_id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: 'active' | 'resolved' | 'archived'
  created_at: string
  updated_at: string
  messages: Array<{
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    tool_name: string | null
    tool_data: Record<string, unknown> | null
    created_at: string
  }>
  chatbots?: { name: string }
}
import { ConversationThread } from '@/components/conversations/ConversationThread'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'
import { toast } from 'sonner'

const statusColorMap: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  resolved: 'secondary',
  archived: 'outline',
}

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: conversation, isLoading, refetch } = useConversation(id) as {
    data: ConversationWithDetails | undefined
    isLoading: boolean
    refetch: () => void
  }
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/conversations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update status')
      }

      toast.success(`Status updated to ${newStatus}`)
      refetch()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update status'
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Loading conversation...
          </p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">Conversation not found.</p>
        <Button variant="outline" onClick={() => router.push('/conversations')}>
          Back to Conversations
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/conversations')}
        >
          &larr; Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Conversation Detail
        </h1>
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {conversation.visitor_name || 'Anonymous Visitor'}
            </CardTitle>
            <Badge
              variant={statusVariantMap[conversation.status] || 'outline'}
              className={statusColorMap[conversation.status] || ''}
            >
              {conversation.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">
                {conversation.visitor_email || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Chatbot</p>
              <p className="font-medium">
                {conversation.chatbots?.name || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Update Status</p>
              <Select
                defaultValue={conversation.status}
                onValueChange={(value) => {
                  if (value) handleStatusChange(value as string)
                }}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-[160px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card className="flex flex-col" style={{ minHeight: '400px' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Messages</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ConversationThread
            messages={conversation.messages || []}
            isLoading={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}

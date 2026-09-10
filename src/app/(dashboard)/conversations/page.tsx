'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useChatbots } from '@/hooks/useChatbots'
import { ConversationList } from '@/components/conversations/ConversationList'

export default function ConversationsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [chatbotFilter, setChatbotFilter] = useState<string | null>(null)

  const { data: conversations = [], isLoading: convsLoading } = useConversations(
    chatbotFilter ?? undefined
  )
  const { data: chatbots = [], isLoading: botsLoading } = useChatbots()

  // Client-side status filtering (the hook may already filter by chatbot via API)
  const filtered = statusFilter
    ? conversations.filter(
        (c: { status: string }) => c.status === statusFilter
      )
    : conversations

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-1">
          View and manage conversations across all your chatbots.
        </p>
      </div>

      <ConversationList
        conversations={filtered}
        isLoading={convsLoading || botsLoading}
        onStatusFilter={setStatusFilter}
        onChatbotFilter={setChatbotFilter}
        chatbots={chatbots}
      />
    </div>
  )
}

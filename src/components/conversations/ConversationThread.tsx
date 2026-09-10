'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from '@/components/conversations/MessageBubble'

interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name: string | null
  tool_data: Record<string, unknown> | null
  created_at: string
}

interface ConversationThreadProps {
  messages: Message[]
  isLoading?: boolean
}

export function ConversationThread({ messages, isLoading }: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          No messages in this conversation yet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

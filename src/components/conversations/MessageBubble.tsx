'use client'

import { cn } from '@/lib/utils'

interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name: string | null
  tool_data: Record<string, unknown> | null
  created_at: string
}

interface MessageBubbleProps {
  message: Message
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-4 py-2',
          isUser && 'bg-primary text-primary-foreground',
          message.role === 'assistant' && 'bg-muted text-muted-foreground',
          isTool && 'bg-muted/60 border border-dashed border-muted-foreground/30 text-muted-foreground'
        )}
      >
        {isTool && message.tool_name && (
          <p className="text-xs font-medium mb-1 opacity-70">
            Tool: {message.tool_name}
          </p>
        )}
        <p
          className={cn(
            'whitespace-pre-wrap break-words',
            isTool && 'text-sm italic'
          )}
        >
          {message.content}
        </p>
        <p
          className={cn(
            'text-xs mt-1 opacity-60',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {formatTimestamp(message.created_at)}
        </p>
      </div>
    </div>
  )
}

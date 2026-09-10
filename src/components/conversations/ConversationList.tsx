'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Conversation {
  id: string
  chatbot_id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: 'active' | 'resolved' | 'archived'
  created_at: string
  updated_at: string
  chatbots?: { name: string }
}

interface Chatbot {
  id: string
  name: string
}

interface ConversationListProps {
  conversations: Conversation[]
  isLoading: boolean
  onStatusFilter: (status: string | null) => void
  onChatbotFilter: (chatbotId: string | null) => void
  chatbots: Chatbot[]
}

const statusVariantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  resolved: 'secondary',
  archived: 'outline',
}

const statusColorMap: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  resolved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ConversationList({
  conversations,
  isLoading,
  onStatusFilter,
  onChatbotFilter,
  chatbots,
}: ConversationListProps) {
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Select
          onValueChange={(value) =>
            onStatusFilter(value === 'all' ? null : value as string)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) =>
            onChatbotFilter(value === 'all' ? null : value as string)
          }
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by chatbot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chatbots</SelectItem>
            {chatbots.map((bot) => (
              <SelectItem key={bot.id} value={bot.id}>
                {bot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {conversations.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
          <p className="text-sm text-muted-foreground">
            No conversations found. Adjust your filters or wait for visitors to start chatting.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor</TableHead>
                <TableHead>Chatbot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((conv) => (
                <TableRow
                  key={conv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/conversations/${conv.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {conv.visitor_name || 'Anonymous Visitor'}
                      </p>
                      {conv.visitor_email && (
                        <p className="text-xs text-muted-foreground">
                          {conv.visitor_email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {conv.chatbots?.name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariantMap[conv.status] || 'outline'}
                      className={statusColorMap[conv.status] || ''}
                    >
                      {conv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatDate(conv.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

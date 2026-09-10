'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useEnquiries } from '@/hooks/useEnquiries'
import { useChatbots } from '@/hooks/useChatbots'
import { useMarkEnquiryRead } from '@/hooks/useEnquiries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { getStage } from '@/lib/funnel'
import { LeadScoreBar } from '@/components/enquiries/LeadScoreBar'

export default function EnquiriesPage() {
  const [chatbotFilter, setChatbotFilter] = useState('')
  const [readFilter, setReadFilter] = useState<string>('')

  const { data: chatbots } = useChatbots()
  const { data: enquiries, isLoading } = useEnquiries({
    chatbotId: chatbotFilter || undefined,
    isRead: readFilter === '' ? undefined : readFilter === 'true',
  })
  const markRead = useMarkEnquiryRead()

  const handleToggleRead = (id: string, currentRead: boolean) => {
    markRead.mutate(
      { id, isRead: !currentRead },
      {
        onSuccess: () => toast(!currentRead ? 'Marked as read' : 'Marked as unread'),
        onError: () => toast.error('Failed to update'),
      }
    )
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (chatbotFilter) params.set('chatbotId', chatbotFilter)
    window.open(`/api/enquiries/export?${params.toString()}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Enquiries</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={chatbotFilter}
          onChange={(e) => setChatbotFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All Chatbots</option>
          {chatbots?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading enquiries...</p>}

      {enquiries && enquiries.length === 0 && (
        <p className="text-muted-foreground">No enquiries found.</p>
      )}

      {enquiries && enquiries.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Form</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enquiries.map((enquiry) => {
              const data = enquiry.data as Record<string, unknown>
              const summaryParts = Object.entries(data).slice(0, 3).map(([k, v]) => `${k}: ${v}`)
              return (
                <TableRow key={enquiry.id} className={enquiry.is_read ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{enquiry.form_name}</TableCell>
                  <TableCell>
                    <Badge className={getStage(enquiry.pipeline_stage).badgeClass}>
                      {getStage(enquiry.pipeline_stage).short}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <LeadScoreBar
                      score={enquiry.lead_score}
                      compact
                      className={enquiry.lead_score_rationale ? 'cursor-help' : undefined}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    <Link href={`/enquiries/${enquiry.id}`} className="hover:underline">
                      {summaryParts.join(', ') || 'No data'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        enquiry.webhook_status === 'sent' ? 'default' :
                        enquiry.webhook_status === 'failed' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {enquiry.webhook_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(enquiry.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={enquiry.is_read ? 'secondary' : 'default'}>
                      {enquiry.is_read ? 'Read' : 'New'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleRead(enquiry.id, enquiry.is_read)}
                      disabled={markRead.isPending}
                    >
                      {enquiry.is_read ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

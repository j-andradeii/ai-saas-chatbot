'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useEnquiry, useMarkEnquiryRead } from '@/hooks/useEnquiries'
import { formatCurrency, formatDateTime, getPriority, getStage } from '@/lib/funnel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StageControl } from './_components/stage-control'
import { LeadDetails } from './_components/lead-details'
import { ActivityTimeline } from './_components/activity-timeline'
import { TaskList } from './_components/task-list'
import { ContactCard } from './_components/contact-card'

export default function EnquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: enquiry, isLoading, error } = useEnquiry(id)
  const markRead = useMarkEnquiryRead()

  const handleToggleRead = () => {
    if (!enquiry) return
    markRead.mutate(
      { id: enquiry.id, isRead: !enquiry.is_read },
      {
        onSuccess: () => toast(enquiry.is_read ? 'Marked as unread' : 'Marked as read'),
        onError: () => toast.error('Failed to update'),
      },
    )
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  if (error || !enquiry) {
    return <p className="text-destructive">Enquiry not found.</p>
  }

  const data = enquiry.data as Record<string, unknown>
  const stage = getStage(enquiry.pipeline_stage)
  const priority = getPriority(enquiry.priority)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/enquiries')}
          className="-ml-2 mb-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to enquiries
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{enquiry.form_name}</h1>
          <Badge className={stage.badgeClass}>{stage.label}</Badge>
          <Badge className={priority.badgeClass}>{priority.label} priority</Badge>
          {!enquiry.is_read && <Badge>New</Badge>}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleToggleRead} disabled={markRead.isPending}>
            {enquiry.is_read ? (
              <><EyeOff className="mr-1 h-4 w-4" /> Mark Unread</>
            ) : (
              <><Eye className="mr-1 h-4 w-4" /> Mark Read</>
            )}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Received {formatDateTime(enquiry.created_at)}
          {enquiry.deal_value != null && (
            <>
              {' · '}Deal value{' '}
              <span className="font-medium text-foreground">{formatCurrency(enquiry.deal_value)}</span>
            </>
          )}
          {enquiry.next_action_at && <>{' · '}Next follow-up {formatDateTime(enquiry.next_action_at)}</>}
        </p>
      </div>

      {/* Funnel pipeline */}
      <StageControl enquiry={enquiry} />

      {/* Workspace */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ContactCard data={data} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submission</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data).length === 0 ? (
                <p className="text-sm text-muted-foreground">No form data submitted.</p>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(data).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm font-medium text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="text-sm break-words">{String(value ?? '')}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <ActivityTimeline enquiryId={enquiry.id} />
        </div>

        <div className="space-y-6">
          <LeadDetails enquiry={enquiry} />
          <TaskList enquiryId={enquiry.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <MetaRow label="Webhook">
                  <Badge
                    variant={
                      enquiry.webhook_status === 'sent'
                        ? 'default'
                        : enquiry.webhook_status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {enquiry.webhook_status}
                    {enquiry.webhook_response_code ? ` (${enquiry.webhook_response_code})` : ''}
                  </Badge>
                </MetaRow>
                <MetaRow label="Stage entered">{formatDateTime(enquiry.stage_changed_at)}</MetaRow>
                <MetaRow label="Conversation">
                  <span className="font-mono text-xs">{enquiry.conversation_id || 'N/A'}</span>
                </MetaRow>
                <MetaRow label="Visitor ID">
                  <span className="font-mono text-xs">{enquiry.visitor_id || 'N/A'}</span>
                </MetaRow>
                <MetaRow label="Visitor IP">
                  <span className="font-mono text-xs">{enquiry.visitor_ip || 'N/A'}</span>
                </MetaRow>
                <MetaRow label="Chatbot ID">
                  <span className="font-mono text-xs break-all">{enquiry.chatbot_id}</span>
                </MetaRow>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

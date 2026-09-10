'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Eye,
  Flag,
  Info,
  ListPlus,
  MessageSquare,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { EnquiryActivityType } from '@/types'
import { ACTIVITY_LABELS, formatRelativeTime } from '@/lib/funnel'
import { useAddEnquiryNote, useEnquiryActivities } from '@/hooks/useEnquiries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ACTIVITY_STYLES: Record<EnquiryActivityType, { icon: LucideIcon; className: string }> = {
  note: { icon: MessageSquare, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  stage_change: { icon: Workflow, className: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
  priority_change: { icon: Flag, className: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  value_change: { icon: DollarSign, className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  next_action: { icon: CalendarClock, className: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  task_created: { icon: ListPlus, className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  task_completed: { icon: CheckCircle2, className: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  read_status: { icon: Eye, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  system: { icon: Info, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
}

export function ActivityTimeline({ enquiryId }: { enquiryId: string }) {
  const { data: activities, isLoading } = useEnquiryActivities(enquiryId)
  const addNote = useAddEnquiryNote(enquiryId)
  const [note, setNote] = useState('')

  const submit = () => {
    const content = note.trim()
    if (!content) return
    addNote.mutate(content, {
      onSuccess: () => {
        setNote('')
        toast('Note added')
      },
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity &amp; Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Note composer */}
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Log a call, add context, or leave a note for your team…"
            rows={2}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={addNote.isPending || !note.trim()}>
              {addNote.isPending ? 'Adding…' : 'Add note'}
            </Button>
          </div>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        ) : !activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet. Stage changes and notes will appear here.
          </p>
        ) : (
          <ol className="space-y-4">
            {activities.map((activity) => {
              const { icon: Icon, className } =
                ACTIVITY_STYLES[activity.type] ?? ACTIVITY_STYLES.system
              return (
                <li key={activity.id} className="flex gap-3">
                  <div
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      className,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm break-words whitespace-pre-wrap">
                      {activity.content || ACTIVITY_LABELS[activity.type]}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ACTIVITY_LABELS[activity.type]} · {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LeadScoreBar } from '@/components/enquiries/LeadScoreBar'
import { getLeadScoreBand, formatDateTime } from '@/lib/funnel'
import type { Enquiry } from '@/types'

/**
 * The conversion score with the reasoning behind it.
 *
 * The rationale and signals are the point: a bare number is not something an
 * operator can act on or argue with, and this one is a model's judgement rather
 * than a measurement.
 */
export function LeadScoreCard({ enquiry }: { enquiry: Enquiry }) {
  const queryClient = useQueryClient()
  const [scoring, setScoring] = useState(false)

  const rescore = async () => {
    setScoring(true)
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}/score`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Scoring failed')
      }
      // Prefix key: refreshes both this detail view (['enquiries', id]) and the
      // list (['enquiries', filters]) so the bar there updates too.
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      toast('Lead re-scored')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed')
    } finally {
      setScoring(false)
    }
  }

  const scored = enquiry.lead_score !== null && enquiry.lead_score !== undefined

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Booking Likelihood</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={rescore}
          disabled={scoring}
          aria-label={scored ? 'Re-score this lead' : 'Score this lead'}
        >
          <RefreshCw className={scoring ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {scored ? (
          <>
            <div className="flex items-center gap-3">
              <LeadScoreBar score={enquiry.lead_score} compact />
              <Badge className={getLeadScoreBand(enquiry.lead_score!).badgeClass}>
                {getLeadScoreBand(enquiry.lead_score!).label}
              </Badge>
            </div>

            {enquiry.lead_score_rationale && (
              <p className="text-sm text-muted-foreground">{enquiry.lead_score_rationale}</p>
            )}

            {enquiry.lead_score_signals?.length > 0 && (
              <ul className="space-y-1">
                {enquiry.lead_score_signals.map((signal, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className="text-muted-foreground">
                      &bull;
                    </span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted-foreground">
              Estimated by {enquiry.lead_score_model ?? 'the chatbot model'}
              {enquiry.lead_scored_at ? ` on ${formatDateTime(enquiry.lead_scored_at)}` : ''}.
              Treat it as a prompt to look closer, not a verdict.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not scored yet. Enquiries are scored automatically when submitted; use the
            refresh button to score this one now.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

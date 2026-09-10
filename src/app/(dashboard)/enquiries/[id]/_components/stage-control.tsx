'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Check, RotateCcw, Trophy, XCircle } from 'lucide-react'
import type { Enquiry, PipelineStage } from '@/types'
import {
  FUNNEL_PATH,
  formatElapsed,
  getFunnelIndex,
  getNextStage,
  getStage,
  getStageLabel,
  isTerminalStage,
} from '@/lib/funnel'
import { useUpdateEnquiry } from '@/hooks/useEnquiries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function StageControl({ enquiry }: { enquiry: Enquiry }) {
  const update = useUpdateEnquiry(enquiry.id)
  const [showLost, setShowLost] = useState(false)
  const [lostReason, setLostReason] = useState('')

  // Funnel columns may be absent until migration 007 is applied — default to
  // 'new' so the control renders instead of crashing.
  const stage = enquiry.pipeline_stage ?? 'new'
  const currentIndex = getFunnelIndex(stage)
  const nextStage = getNextStage(stage)
  const terminal = isTerminalStage(stage)
  const isWon = stage === 'won'
  const isLost = stage === 'lost'

  const moveTo = (target: PipelineStage, message: string) => {
    if (target === stage) return
    update.mutate(
      { pipeline_stage: target },
      {
        onSuccess: () => toast.success(message),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const handleLost = () => {
    update.mutate(
      { pipeline_stage: 'lost', lost_reason: lostReason.trim() || null },
      {
        onSuccess: () => {
          toast('Marked as lost')
          setShowLost(false)
          setLostReason('')
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        {/* Funnel progress bar */}
        <div className="flex items-start">
          {FUNNEL_PATH.map((pathStage, i) => {
            const conf = getStage(pathStage)
            const isComplete = currentIndex > -1 && i < currentIndex
            const isCurrent = pathStage === stage
            const leftFilled = currentIndex > -1 && i <= currentIndex
            const rightFilled = currentIndex > -1 && i < currentIndex
            const isLastNode = i === FUNNEL_PATH.length - 1
            return (
              <div key={pathStage} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div
                    className={cn(
                      'h-0.5 flex-1 transition-colors',
                      i === 0 ? 'bg-transparent' : leftFilled ? 'bg-foreground/30' : 'bg-border',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      moveTo(pathStage, pathStage === 'won' ? 'Deal won 🎉' : `Moved to ${conf.label}`)
                    }
                    disabled={update.isPending}
                    title={conf.description}
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all disabled:opacity-60',
                      isComplete && `${conf.dotClass} text-white`,
                      isCurrent &&
                        `${conf.dotClass} text-white ring-2 ring-foreground/20 ring-offset-2 ring-offset-background`,
                      !isComplete && !isCurrent && 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    {pathStage === 'won' ? (
                      <Trophy className="h-4 w-4" />
                    ) : isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </button>
                  <div
                    className={cn(
                      'h-0.5 flex-1 transition-colors',
                      isLastNode ? 'bg-transparent' : rightFilled ? 'bg-foreground/30' : 'bg-border',
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-center text-xs',
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {conf.short}
                </span>
              </div>
            )
          })}
        </div>

        {/* Closed-won banner */}
        {isWon && (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <Trophy className="h-4 w-4" />
              This lead was won. Nice work!
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveTo('contacted', 'Lead reopened')}
              disabled={update.isPending}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen
            </Button>
          </div>
        )}

        {/* Closed-lost banner */}
        {isLost && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/20">
            <div className="text-sm text-rose-700 dark:text-rose-400">
              <span className="font-medium">Marked as lost.</span>
              {enquiry.lost_reason ? ` ${enquiry.lost_reason}` : ''}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveTo('contacted', 'Lead reopened')}
              disabled={update.isPending}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reopen
            </Button>
          </div>
        )}

        {/* Active-stage actions */}
        {!terminal && !showLost && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              In <span className="font-medium text-foreground">{getStageLabel(stage)}</span>
              {' · '}
              {formatElapsed(enquiry.stage_changed_at ?? enquiry.created_at)} in stage
            </span>
            <div className="flex-1" />
            {nextStage && (
              <Button
                size="sm"
                onClick={() =>
                  moveTo(
                    nextStage,
                    nextStage === 'won' ? 'Deal won 🎉' : `Moved to ${getStageLabel(nextStage)}`,
                  )
                }
                disabled={update.isPending}
              >
                {nextStage === 'won' ? (
                  <><Trophy className="mr-1 h-4 w-4" /> Mark as Won</>
                ) : (
                  <>Advance to {getStageLabel(nextStage)} <ArrowRight className="ml-1 h-4 w-4" /></>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLost(true)}
              disabled={update.isPending}
            >
              <XCircle className="mr-1 h-4 w-4" /> Mark as Lost
            </Button>
          </div>
        )}

        {/* Lost-reason capture */}
        {!terminal && showLost && (
          <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-900/10">
            <p className="text-sm font-medium">Why was this lead lost?</p>
            <Textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. Went with a competitor, budget too low, no response…"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLost}
                disabled={update.isPending}
              >
                Confirm Lost
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowLost(false)
                  setLostReason('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

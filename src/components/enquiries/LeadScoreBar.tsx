import { getLeadScoreBand } from '@/lib/funnel'
import { cn } from '@/lib/utils'

interface LeadScoreBarProps {
  /** null when the enquiry has not been scored (or scoring failed). */
  score: number | null
  /** Hide the band name to fit a dense table row. */
  compact?: boolean
  className?: string
}

/**
 * Interest level as a filled bar plus the raw number.
 *
 * An unscored enquiry renders as a muted dash rather than an empty bar -- a 0%
 * bar and "no score yet" mean very different things to whoever is deciding
 * which lead to call first.
 */
export function LeadScoreBar({ score, compact = false, className }: LeadScoreBarProps) {
  if (score === null || score === undefined) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)} title="Not scored yet">
        —
      </span>
    )
  }

  const clamped = Math.max(0, Math.min(100, score))
  const band = getLeadScoreBand(clamped)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Interest level: ${band.label}, ${clamped} out of 100`}
      >
        <div
          className={cn('h-full rounded-full transition-all', band.barClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-sm tabular-nums">{clamped}</span>
      {!compact && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{band.label}</span>
      )}
    </div>
  )
}

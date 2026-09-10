import { formatMoney, CURRENCY_LOCALE } from '@/lib/billing'
import type {
  EnquiryActivityType,
  EnquiryPriority,
  PipelineStage,
} from '@/types'

/**
 * Funnel / pipeline configuration shared by the API route handlers and the
 * client components. Pure TypeScript — no React or server-only imports — so it
 * is safe to import from anywhere.
 */

export interface StageConfig {
  key: PipelineStage
  label: string
  /** Short verb used on the "advance" button, e.g. "Mark as Contacted". */
  short: string
  description: string
  /** Tailwind classes for a coloured badge. */
  badgeClass: string
  /** Tailwind background class for the funnel node / status dot. */
  dotClass: string
}

export const PIPELINE_STAGES: StageConfig[] = [
  {
    key: 'new',
    label: 'New Lead',
    short: 'New',
    description: 'Just arrived — not yet actioned.',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dotClass: 'bg-slate-400',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    short: 'Contacted',
    description: 'Reached out — awaiting a response.',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    short: 'Qualified',
    description: 'A genuine, well-fitting opportunity.',
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    dotClass: 'bg-violet-500',
  },
  {
    key: 'proposal',
    label: 'Proposal Sent',
    short: 'Proposal',
    description: 'A quote or proposal is on the table.',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'won',
    label: 'Won',
    short: 'Won',
    description: 'Closed — the deal was won. 🎉',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  {
    key: 'lost',
    label: 'Lost',
    short: 'Lost',
    description: 'Closed — the deal did not proceed.',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    dotClass: 'bg-rose-500',
  },
]

/** The ordered "happy path" rendered as the funnel progress bar. */
export const FUNNEL_PATH: PipelineStage[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'won',
]

/** Stages that close the lead — no further progression. */
export const TERMINAL_STAGES: PipelineStage[] = ['won', 'lost']

export interface PriorityConfig {
  key: EnquiryPriority
  label: string
  badgeClass: string
  dotClass: string
}

export const PRIORITIES: PriorityConfig[] = [
  {
    key: 'low',
    label: 'Low',
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    dotClass: 'bg-slate-400',
  },
  {
    key: 'medium',
    label: 'Medium',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    dotClass: 'bg-sky-500',
  },
  {
    key: 'high',
    label: 'High',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    dotClass: 'bg-orange-500',
  },
  {
    key: 'urgent',
    label: 'Urgent',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
]

export const ACTIVITY_LABELS: Record<EnquiryActivityType, string> = {
  note: 'Note',
  stage_change: 'Stage changed',
  priority_change: 'Priority changed',
  value_change: 'Deal value updated',
  next_action: 'Follow-up scheduled',
  task_created: 'Task added',
  task_completed: 'Task completed',
  read_status: 'Read status changed',
  system: 'System',
}

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

export function getStage(key: PipelineStage): StageConfig {
  return PIPELINE_STAGES.find((s) => s.key === key) ?? PIPELINE_STAGES[0]
}

export function getStageLabel(key: PipelineStage): string {
  return getStage(key).label
}

/** Index within the happy path, or -1 for `lost`. */
export function getFunnelIndex(key: PipelineStage): number {
  return FUNNEL_PATH.indexOf(key)
}

/** The next stage on the happy path, or null when there is none. */
export function getNextStage(key: PipelineStage): PipelineStage | null {
  const idx = FUNNEL_PATH.indexOf(key)
  if (idx === -1 || idx >= FUNNEL_PATH.length - 1) return null
  return FUNNEL_PATH[idx + 1]
}

export function isTerminalStage(key: PipelineStage): boolean {
  return TERMINAL_STAGES.includes(key)
}

export function getPriority(key: EnquiryPriority): PriorityConfig {
  return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[1]
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return formatMoney(value)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(CURRENCY_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** Human relative time, e.g. "5 minutes ago" or "in 2 days". */
export function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const diff = time - Date.now()
  const abs = Math.abs(diff)
  if (abs < MINUTE) return relativeFormatter.format(Math.round(diff / SECOND), 'second')
  if (abs < HOUR) return relativeFormatter.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return relativeFormatter.format(Math.round(diff / HOUR), 'hour')
  if (abs < 30 * DAY) return relativeFormatter.format(Math.round(diff / DAY), 'day')
  return formatDateTime(iso)
}

/** Compact elapsed duration since a timestamp, e.g. "3d", "5h", "12m". */
export function formatElapsed(iso: string): string {
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return 'just now'
  const diff = Date.now() - time
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  return `${Math.floor(diff / DAY)}d`
}

/** True when an unfinished due date is in the past. */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < Date.now()
}

/** ISO string -> value for an <input type="datetime-local"> (local time). */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * MINUTE
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

/** datetime-local input value -> ISO string (or null when empty). */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

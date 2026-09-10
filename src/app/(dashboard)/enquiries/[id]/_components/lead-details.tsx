'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DollarSign, X } from 'lucide-react'
import type { Enquiry } from '@/types'
import { PRIORITIES, fromLocalInputValue, toLocalInputValue } from '@/lib/funnel'
import { useUpdateEnquiry } from '@/hooks/useEnquiries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function LeadDetails({ enquiry }: { enquiry: Enquiry }) {
  const update = useUpdateEnquiry(enquiry.id)
  const [dealValue, setDealValue] = useState(enquiry.deal_value?.toString() ?? '')
  const [syncedValue, setSyncedValue] = useState(enquiry.deal_value)
  const [tagInput, setTagInput] = useState('')

  // Re-sync the editable field when the server value changes (after a save).
  // Adjusting state during render is preferred over an effect for this.
  if (enquiry.deal_value !== syncedValue) {
    setSyncedValue(enquiry.deal_value)
    setDealValue(enquiry.deal_value?.toString() ?? '')
  }

  // Funnel columns may be absent until migration 007 is applied — default
  // defensively so the page renders instead of crashing.
  const tags = enquiry.tags ?? []
  const priority = enquiry.priority ?? 'medium'

  const saveDealValue = () => {
    const trimmed = dealValue.trim()
    const parsed = trimmed === '' ? null : Number(trimmed)
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      toast.error('Enter a valid amount')
      setDealValue(enquiry.deal_value?.toString() ?? '')
      return
    }
    if (parsed === enquiry.deal_value) return
    update.mutate({ deal_value: parsed }, { onError: (e) => toast.error(e.message) })
  }

  const setPriority = (value: string) => {
    update.mutate(
      { priority: value as Enquiry['priority'] },
      { onError: (e) => toast.error(e.message) },
    )
  }

  const setNextAction = (value: string) => {
    update.mutate(
      { next_action_at: fromLocalInputValue(value) },
      { onError: (e) => toast.error(e.message) },
    )
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    if (tags.includes(tag)) {
      setTagInput('')
      return
    }
    update.mutate(
      { tags: [...tags, tag] },
      {
        onSuccess: () => setTagInput(''),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const removeTag = (tag: string) => {
    update.mutate(
      { tags: tags.filter((t) => t !== tag) },
      { onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lead Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Priority */}
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', p.dotClass)} />
                    {p.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deal value */}
        <div className="space-y-1.5">
          <Label>Deal Value (PHP)</Label>
          <div className="relative">
            <DollarSign className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="pl-8"
              placeholder="0.00"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              onBlur={saveDealValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          </div>
        </div>

        {/* Next follow-up */}
        <div className="space-y-1.5">
          <Label>Next Follow-up</Label>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={toLocalInputValue(enquiry.next_action_at)}
              onChange={(e) => setNextAction(e.target.value)}
            />
            {enquiry.next_action_at && (
              <Button variant="ghost" size="sm" onClick={() => setNextAction('')} title="Clear">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label>Tags</Label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            placeholder="Add a tag and press Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

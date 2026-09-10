'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, Send, Sparkles } from 'lucide-react'

type Step =
  | { kind: 'user'; text: string }
  | { kind: 'typing' }
  | { kind: 'bot'; text: string }
  | { kind: 'form' }
  | { kind: 'captured' }

/**
 * Scripted demo of a real conversation on the platform: the bot answers from the
 * knowledge base, raises an enquiry form mid-chat, and the lead lands in the funnel.
 */
const SCRIPT: Array<Step & { delay: number }> = [
  { kind: 'user', text: 'Do you do emergency hot water repairs in Maitland?', delay: 900 },
  { kind: 'typing', delay: 1100 },
  {
    kind: 'bot',
    text: 'Yes — we cover Maitland and the wider Hunter, 24/7. Emergency hot water callouts start at $180, which includes the first 30 minutes on site.',
    delay: 2400,
  },
  { kind: 'user', text: 'Can someone come out tonight?', delay: 1400 },
  { kind: 'typing', delay: 1000 },
  { kind: 'bot', text: 'I can get that organised. Just need a few details:', delay: 1200 },
  { kind: 'form', delay: 2600 },
  { kind: 'captured', delay: 1600 },
]

const FIELDS = [
  { label: 'Name', value: 'Sarah Whitfield' },
  { label: 'Phone', value: '0412 555 908' },
  { label: 'Suburb', value: 'Maitland NSW 2320' },
]

export function ChatDemo() {
  const [shown, setShown] = useState(1)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      // No looping animation — reveal the finished conversation once.
      const id = window.setTimeout(() => setShown(SCRIPT.length), 0)
      return () => window.clearTimeout(id)
    }

    const next = shown >= SCRIPT.length ? 4200 : SCRIPT[shown].delay
    const id = window.setTimeout(() => {
      setShown((n) => (n >= SCRIPT.length ? 1 : n + 1))
    }, next)
    return () => window.clearTimeout(id)
  }, [shown])

  const visible = SCRIPT.slice(0, shown)

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        A demo conversation: a visitor asks whether the business does emergency hot water repairs
        in Maitland. The assistant answers from the knowledge base, then presents an enquiry form
        in the chat, and the completed enquiry is captured as a new lead in the pipeline.
      </figcaption>

      <div
        aria-hidden="true"
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-brand/10 ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
      >
        {/* Widget header */}
        <div className="flex items-center gap-3 border-b bg-gradient-to-r from-brand to-brand-accent px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-foreground/10 backdrop-blur">
            <Bot className="size-5 text-brand-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-foreground">Hunter Plumbing Co.</p>
            <p className="flex items-center gap-1.5 text-xs text-brand-foreground/75">
              <span className="size-1.5 rounded-full bg-emerald-700 dark:bg-emerald-800" />
              Online — replies instantly
            </p>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex h-[430px] flex-col justify-end gap-3 overflow-hidden bg-muted/30 p-4">
          {visible.map((step, i) => {
            // A typing indicator only survives until the reply it precedes arrives.
            if (step.kind === 'typing' && i !== visible.length - 1) return null

            if (step.kind === 'user') {
              return (
                <div key={i} className="animate-rise flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm leading-relaxed text-brand-foreground shadow-sm">
                    {step.text}
                  </p>
                </div>
              )
            }

            if (step.kind === 'typing') {
              return (
                <div key={i} className="animate-rise flex justify-start">
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-sm">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                </div>
              )
            }

            if (step.kind === 'bot') {
              return (
                <div key={i} className="animate-rise flex justify-start">
                  <p className="max-w-[85%] rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                    {step.text}
                  </p>
                </div>
              )
            }

            if (step.kind === 'form') {
              return (
                <div
                  key={i}
                  className="animate-rise overflow-hidden rounded-xl border bg-card shadow-md"
                >
                  <div className="flex items-center gap-2 border-b bg-brand-subtle/60 px-3.5 py-2.5 dark:bg-brand/10">
                    <Sparkles className="size-3.5 text-brand-text" />
                    <span className="text-xs font-semibold">Emergency callout request</span>
                  </div>
                  <div className="space-y-2.5 p-3.5">
                    {FIELDS.map((f) => (
                      <div key={f.label}>
                        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          {f.label}
                        </span>
                        <span className="block rounded-lg border bg-muted/40 px-3 py-2 text-[13px]">
                          {f.value}
                        </span>
                      </div>
                    ))}
                    <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2.5 text-[13px] font-semibold text-brand-foreground">
                      Send request
                      <Send className="size-3.5" />
                    </span>
                  </div>
                </div>
              )
            }

            return (
              <div key={i} className="animate-rise flex justify-center pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="size-3.5" />
                  Lead captured — added to pipeline as <strong className="font-semibold">New</strong>
                </span>
              </div>
            )
          })}
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 border-t bg-card px-3 py-3">
          <span className="flex-1 rounded-full border bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground">
            Ask a question…
          </span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand">
            <Send className="size-4 text-brand-foreground" />
          </span>
        </div>
      </div>
    </figure>
  )
}

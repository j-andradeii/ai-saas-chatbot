import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Clock,
  Code2,
  Cpu,
  FileText,
  Globe,
  KanbanSquare,
  MessageSquare,
  MessagesSquare,
  Plug,
  Sparkles,
  Zap,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, PLAN_PRICING, CURRENCY_LOCALE, formatMoney } from '@/lib/billing'
import { Button } from '@/components/ui/button'
import { SiteHeader } from '@/components/landing/site-header'
import { ChatDemo } from '@/components/landing/chat-demo'

export const metadata: Metadata = {
  title: 'Chatbot SaaS — AI that answers your visitors and captures every lead',
  description:
    'Add an AI assistant to your website in one line of code. It answers from your own documents, asks the right questions, and turns every conversation into a tracked lead.',
  openGraph: {
    title: 'AI that answers your visitors and captures every lead',
    description:
      'Add an AI assistant to your website in one line of code. Trained on your documents, connected to your systems, and every enquiry lands in a pipeline.',
    type: 'website',
  },
}

const FEATURES = [
  {
    icon: FileText,
    title: 'Trained on your own content',
    body: 'Upload PDFs, Word docs or text files. Every answer is grounded in your pricing, policies and service areas — not a guess from the open internet.',
  },
  {
    icon: Sparkles,
    title: 'Forms that appear mid-conversation',
    body: 'The assistant decides when to ask for contact details, then renders a real form inside the chat with the fields it already knows pre-filled.',
  },
  {
    icon: KanbanSquare,
    title: 'Every enquiry becomes a tracked lead',
    body: 'Stages, priority, deal value, follow-up dates, tasks and a full activity timeline. Not an email in an inbox — a pipeline you can actually work.',
  },
  {
    icon: Plug,
    title: 'Connected to your live data',
    body: 'Point it at any HTTP endpoint and the assistant can look up bookings, stock or account details mid-chat, then render the results as clean cards.',
  },
  {
    icon: Cpu,
    title: 'Pick the model per bot',
    body: 'OpenAI, Anthropic or Google — chosen per chatbot. No API keys to manage; billing and rate limits are handled for you.',
  },
  {
    icon: Code2,
    title: 'One script tag, any website',
    body: 'WordPress, Shopify, Webflow or hand-rolled HTML. Set your brand colour and position, paste one line, and it is live.',
  },
] as const

const STEPS = [
  {
    title: 'Create your assistant',
    body: 'Name it, give it a personality, and upload the documents it should answer from. Processing and indexing happen in the background.',
  },
  {
    title: 'Decide what it can do',
    body: 'Choose its skills, add quick-action buttons, build the enquiry forms it can raise, and connect any live APIs it should be able to call.',
  },
  {
    title: 'Paste one line of code',
    body: 'Copy the embed snippet into your site. Conversations and leads start appearing in your dashboard immediately.',
  },
] as const

const STATS = [
  {
    icon: Clock,
    stat: 'Round the clock',
    body: 'Most enquiries arrive outside business hours. Every one of them gets an answer in seconds, not the next business day.',
  },
  {
    icon: Zap,
    stat: 'Answered in seconds',
    body: 'Being first to respond is the strongest predictor of whether an inbound enquiry converts. A form that waits until Monday rarely does.',
  },
  {
    icon: BarChart3,
    stat: 'Nothing falls through',
    body: 'Every conversation is logged and every enquiry lands in a pipeline with an owner, a value and a next action.',
  },
] as const

const CHANNELS = [
  { icon: Globe, label: 'Website widget', live: true },
  { icon: MessageSquare, label: 'Conversation history', live: true },
  { icon: Plug, label: 'Custom API actions', live: true },
  { icon: MessagesSquare, label: 'Instagram & Messenger', live: false },
] as const

const FAQ = [
  {
    q: 'Where do the answers come from?',
    a: 'From the documents you upload. Your files are split into passages and indexed, and the most relevant ones are retrieved for every question — so the assistant answers with your pricing and your policies. If something is not covered, it says so rather than inventing an answer.',
  },
  {
    q: 'Do I need my own OpenAI or Anthropic account?',
    a: 'No. Model access is included in your plan and billed as part of your subscription. You choose which model each chatbot uses; we handle the keys, the rate limits and the usage tracking.',
  },
  {
    q: 'What actually happens when someone submits an enquiry?',
    a: 'It arrives in your dashboard as a lead at the "New" stage, with the full conversation attached. From there you can set a priority and deal value, add follow-up tasks with due dates, move it through the pipeline, and export the lot to CSV.',
  },
  {
    q: 'Can I run more than one chatbot?',
    a: `Yes. Free includes ${PLAN_LIMITS.free.chatbots} chatbot, Pro includes ${PLAN_LIMITS.pro.chatbots}, and Enterprise includes ${PLAN_LIMITS.enterprise.chatbots} — each with its own knowledge base, personality, branding and domain.`,
  },
  {
    q: 'How do I pay?',
    a: 'By bank transfer. Choose a plan, upload your payment receipt, and your account is upgraded as soon as it is approved. No card needs to be stored on file.',
  },
] as const

const PLANS = [
  {
    name: 'Free',
    price: 0,
    tagline: 'Try it on a real site',
    limits: PLAN_LIMITS.free,
    features: ['Knowledge base uploads', 'Enquiry forms in chat', 'Lead pipeline', 'Conversation history'],
    cta: 'Start free',
    href: '/register',
    featured: false,
  },
  {
    name: 'Pro',
    price: PLAN_PRICING.pro.monthly,
    yearly: PLAN_PRICING.pro.yearly,
    tagline: 'For a growing business',
    limits: PLAN_LIMITS.pro,
    features: [
      'Everything in Free',
      'Choose any available model',
      'Live API connections',
      'Custom branding & position',
      'CSV export',
    ],
    cta: 'Choose Pro',
    href: '/register',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: PLAN_PRICING.enterprise.monthly,
    yearly: PLAN_PRICING.enterprise.yearly,
    tagline: 'For agencies and multi-site operators',
    limits: PLAN_LIMITS.enterprise,
    features: [
      'Everything in Pro',
      'High-volume message allowance',
      'Multi-site deployments',
      'Priority support',
    ],
    cta: 'Choose Enterprise',
    href: '/register',
    featured: false,
  },
] as const

const fmt = new Intl.NumberFormat(CURRENCY_LOCALE)

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const signedIn = Boolean(user)

  // The platform's own assistant, running on its own marketing site.
  const demoChatbotId =
    process.env.NEXT_PUBLIC_DEMO_CHATBOT_ID ?? '09d92dab-df6b-4d0e-854b-e17714d424b5'

  return (
    <>
      <SiteHeader signedIn={signedIn} />

      <main className="flex-1">
        {/* ---------------- Hero ---------------- */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_auto] lg:items-center lg:gap-16 lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <span className="flex size-1.5 rounded-full bg-brand" />
                Answers from your documents, not the open internet
              </span>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                Your website should{' '}
                <span className="text-gradient-brand">answer back</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                Add an AI assistant to your site in one line of code. It answers questions from your
                own documents, asks for the details you need, and turns every conversation into a
                lead you can actually follow up.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  nativeButton={false}
                  render={<Link href={signedIn ? '/dashboard' : '/register'} />}
                  className="h-12 gap-2 bg-gradient-to-r from-brand to-brand-accent px-7 text-base text-brand-foreground shadow-lg shadow-brand/25 hover:opacity-90"
                >
                  {signedIn ? 'Go to dashboard' : 'Build your assistant free'}
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="#how-it-works" />}
                  className="h-12 px-7 text-base"
                >
                  See how it works
                </Button>
              </div>

              <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-brand-text" /> No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-brand-text" /> Live in minutes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-brand-text" /> Works on any site
                </span>
              </p>
            </div>

            <div className="flex justify-center lg:justify-end">
              <ChatDemo />
            </div>
          </div>
        </section>

        {/* ---------------- Why ---------------- */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              You already paid for the visitor. Don&apos;t lose them at the contact form.
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground text-pretty">
              Someone lands on your site with one specific question. If they can&apos;t find the
              answer in the next thirty seconds, they go back to the search results and click your
              competitor instead.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {STATS.map(({ icon: Icon, stat, body }) => (
                <div key={stat} className="rounded-xl border bg-card p-6 shadow-sm">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-subtle text-brand-text dark:bg-brand/15">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{stat}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Features ---------------- */}
        <section id="features" className="scroll-mt-20 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-sm font-semibold text-brand-text">Features</span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Everything the assistant needs to be genuinely useful
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Not a scripted decision tree. A real assistant that knows your business, can act on
                your systems, and hands you a qualified lead at the end of it.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-accent text-brand-foreground shadow-sm">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section id="how-it-works" className="scroll-mt-20 border-b bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-sm font-semibold text-brand-text">How it works</span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Three steps, no developer required
              </h2>
            </div>

            <ol className="mt-14 grid gap-8 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent text-sm font-semibold text-brand-foreground shadow-md">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-14 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="size-2.5 rounded-full bg-red-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                </span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">index.html</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
                <code>
                  <span className="text-muted-foreground">
                    {'<!-- Paste before the closing </body> tag -->'}
                  </span>
                  {'\n'}
                  <span className="text-brand-text">{'<script'}</span>
                  {'\n  '}
                  <span className="text-brand-text-2">src</span>
                  {'='}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    &quot;https://your-domain.com/api/widget/YOUR_CHATBOT_ID&quot;
                  </span>
                  {'\n  '}
                  <span className="text-brand-text-2">defer</span>
                  {'\n'}
                  <span className="text-brand-text">{'></script>'}</span>
                </code>
              </pre>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {CHANNELS.map(({ icon: Icon, label, live }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                  {!live && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Pricing ---------------- */}
        <section id="pricing" className="scroll-mt-20 border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <span className="text-sm font-semibold text-brand-text">Pricing</span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Flat monthly pricing, in Philippine pesos
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Model usage is included. Pay by bank transfer — no card stored on file, and no
                per-resolution charges that spike when you have a busy week.
              </p>
            </div>

            <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={
                    plan.featured
                      ? 'relative rounded-2xl border-2 border-brand bg-card p-7 shadow-xl shadow-brand/10'
                      : 'relative rounded-2xl border bg-card p-7 shadow-sm'
                  }
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-brand to-brand-accent px-3 py-1 text-xs font-semibold text-brand-foreground shadow">
                      Most popular
                    </span>
                  )}

                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight">
                      {formatMoney(plan.price)}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </p>
                  <p className="mt-1 h-5 text-xs text-muted-foreground">
                    {'yearly' in plan && plan.yearly
                      ? `or ${formatMoney(plan.yearly)}/year`
                      : 'Free forever'}
                  </p>

                  <Button
                    nativeButton={false}
                    render={<Link href={signedIn ? '/billing' : plan.href} />}
                    variant={plan.featured ? 'default' : 'outline'}
                    className={
                      plan.featured
                        ? 'mt-6 h-11 w-full bg-gradient-to-r from-brand to-brand-accent text-brand-foreground hover:opacity-90'
                        : 'mt-6 h-11 w-full'
                    }
                  >
                    {plan.cta}
                  </Button>

                  <dl className="mt-7 grid grid-cols-2 gap-3 border-y py-4 text-center">
                    <div>
                      <dt className="text-xs text-muted-foreground">Messages</dt>
                      <dd className="mt-0.5 font-semibold">{fmt.format(plan.limits.messages)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Chatbots</dt>
                      <dd className="mt-0.5 font-semibold">{plan.limits.chatbots}</dd>
                    </div>
                  </dl>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-text" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section id="faq" className="scroll-mt-20 border-b bg-muted/30">
          <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Questions, answered
            </h2>
            <div className="mt-10 space-y-3">
              {FAQ.map(({ q, a }) => (
                <details
                  key={q}
                  name="faq"
                  className="group rounded-xl border bg-card px-5 shadow-sm open:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    {q}
                    <span
                      aria-hidden="true"
                      className="grid size-6 shrink-0 place-items-center rounded-full border text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand to-brand-accent"
          />
          <div className="relative mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-brand-foreground sm:text-4xl">
              Put an assistant on your site today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-foreground/80 text-pretty">
              Create a chatbot, upload what it should know, and paste one line of code. The free
              plan is enough to see it working on a real site.
            </p>
            <Button
              nativeButton={false}
              render={<Link href={signedIn ? '/dashboard' : '/register'} />}
              className="mt-9 h-12 gap-2 bg-background px-8 text-base text-brand-text shadow-lg hover:bg-background/90"
            >
              {signedIn ? 'Go to dashboard' : 'Get started free'}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      {/* ---------------- Footer ---------------- */}
      <footer className="bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-accent">
              <Bot className="size-4 text-brand-foreground" />
            </span>
            Chatbot&nbsp;SaaS
          </Link>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground">
              FAQ
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="text-muted-foreground hover:text-foreground">
              Create account
            </Link>
          </nav>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Chatbot SaaS
          </p>
        </div>
      </footer>

      {/* The platform's own assistant, live on its own marketing site. */}
      <Script src={`/api/widget/${demoChatbotId}`} strategy="lazyOnload" />
    </>
  )
}

import Link from 'next/link'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/landing/theme-toggle'

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

/**
 * Marketing header. `signedIn` swaps the sign-in / register pair for a single
 * link into the dashboard, so a returning user never sees a login prompt.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-accent">
            <Bot className="size-[18px] text-brand-foreground" />
          </span>
          <span>Chatbot&nbsp;SaaS</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          {signedIn ? (
            <Button
              nativeButton={false}
              render={<Link href="/dashboard" />}
              className="h-9 bg-gradient-to-r from-brand to-brand-accent px-4 text-brand-foreground hover:opacity-90"
            >
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/login" />}
                className="h-9 px-3"
              >
                Sign in
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/register" />}
                className="h-9 bg-gradient-to-r from-brand to-brand-accent px-4 text-brand-foreground hover:opacity-90"
              >
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

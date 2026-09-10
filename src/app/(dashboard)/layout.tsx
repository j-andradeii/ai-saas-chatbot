import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Bot, MessageSquare, LayoutDashboard, Inbox, CreditCard } from 'lucide-react'
import { SignOutButton } from '@/components/SignOutButton'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'
import { Badge } from '@/components/ui/badge'

const planBadgeColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chatbots', label: 'Chatbots', icon: Bot },
  { href: '/conversations', label: 'Conversations', icon: MessageSquare },
  { href: '/enquiries', label: 'Enquiries', icon: Inbox },
  { href: '/billing', label: 'Billing', icon: CreditCard },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="p-6">
          <Link href="/dashboard" className="text-lg font-bold">
            AI Chatbot
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">
            {profile?.full_name || user.email}
          </p>
          <Badge className={`mt-1 text-xs ${planBadgeColors[profile?.plan ?? 'free']}`}>
            {(profile?.plan ?? 'free').toUpperCase()}
          </Badge>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <ImpersonationBanner />
        {/* Mobile header */}
        <header className="flex items-center gap-4 border-b bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" className="text-lg font-bold">
            AI Chatbot
          </Link>
          <nav className="flex flex-1 items-center gap-2 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <SignOutButton />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Shield, Settings, LayoutDashboard, Users, BarChart3, Wrench, CreditCard } from 'lucide-react'
import { SignOutButton } from '@/components/SignOutButton'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/providers', label: 'LLM Providers', icon: Settings },
  { href: '/admin/settings', label: 'Settings', icon: Wrench },
]

export default async function AdminLayout({
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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex h-screen">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-5 w-5" />
            Admin Panel
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          {adminNavItems.map((item) => {
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
          <div className="pt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Back to Dashboard
            </Link>
          </div>
        </nav>
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">
            {profile.full_name || user.email}
          </p>
          <p className="text-xs text-muted-foreground">Admin</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b bg-card px-4 py-3 md:hidden">
          <Link href="/admin" className="flex items-center gap-2 text-lg font-bold">
            <Shield className="h-4 w-4" />
            Admin
          </Link>
          <nav className="flex flex-1 items-center gap-2 overflow-x-auto">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SignOutButton />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

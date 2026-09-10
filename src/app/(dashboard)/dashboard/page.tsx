import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, MessageSquare, MessagesSquare, Inbox } from 'lucide-react'
import { PLAN_LIMITS } from '@/lib/billing'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [chatbotsResult, conversationsResult, messagesResult, profileResult, enquiriesResult] =
    await Promise.all([
      supabase.from('chatbots').select('id', { count: 'exact', head: true }),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('plan, message_count, message_limit')
        .eq('id', user!.id)
        .single(),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }),
    ])

  const profile = profileResult.data
  const messageCount = profile?.message_count ?? 0
  const messageLimit = profile?.message_limit ?? PLAN_LIMITS.free.messages
  const usagePct = messageLimit > 0 ? Math.min((messageCount / messageLimit) * 100, 100) : 0

  const stats = [
    { label: 'Chatbots', value: chatbotsResult.count ?? 0, icon: Bot },
    { label: 'Conversations', value: conversationsResult.count ?? 0, icon: MessageSquare },
    { label: 'Total Messages', value: messagesResult.count ?? 0, icon: MessagesSquare },
    { label: 'Enquiries', value: enquiriesResult.count ?? 0, icon: Inbox },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Message Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Message Usage ({profile?.plan ?? 'free'} plan)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{messageCount.toLocaleString()} / {messageLimit.toLocaleString()} messages</span>
              <span className="text-muted-foreground">{usagePct.toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct >= 90
                    ? 'bg-destructive'
                    : usagePct >= 70
                      ? 'bg-yellow-500'
                      : 'bg-primary'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {usagePct >= 90 && (
              <p className="text-sm text-destructive">
                You&apos;re approaching your message limit. Consider upgrading your plan.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

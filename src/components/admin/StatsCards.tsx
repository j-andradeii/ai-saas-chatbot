'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Bot, MessageSquare, Mail, UserPlus, Activity } from 'lucide-react'

interface AdminStats {
  totalUsers: number
  totalChatbots: number
  totalConversations: number
  totalMessages: number
  usersThisMonth: number
  activeConversations: number
}

const statConfig = [
  { key: 'totalUsers' as const, label: 'Total Users', icon: Users },
  { key: 'totalChatbots' as const, label: 'Total Chatbots', icon: Bot },
  { key: 'totalConversations' as const, label: 'Total Conversations', icon: MessageSquare },
  { key: 'totalMessages' as const, label: 'Total Messages', icon: Mail },
  { key: 'usersThisMonth' as const, label: 'New Users This Month', icon: UserPlus },
  { key: 'activeConversations' as const, label: 'Active Conversations', icon: Activity },
]

export function StatsCards() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statConfig.map((s) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {statConfig.map((s) => {
        const Icon = s.icon
        return (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats?.[s.key] ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

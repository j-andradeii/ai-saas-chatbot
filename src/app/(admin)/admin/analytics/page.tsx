'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/billing'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface AnalyticsData {
  planBreakdown: Record<string, number>
  usersPerDay: { date: string; count: number }[]
  messagesPerDay: { date: string; count: number }[]
  topChatbots: { id: string; name: string; message_count: number }[]
  conversationStatus: Record<string, number>
  estimatedMRR: number
}

const PIE_COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6']
const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin', 'analytics', days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?days=${days}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      return res.json()
    },
  })

  if (isLoading) {
    return <p className="text-muted-foreground">Loading analytics...</p>
  }

  if (!data) {
    return <p className="text-destructive">Failed to load analytics.</p>
  }

  const planPieData = Object.entries(data.planBreakdown).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Platform metrics and trends</p>
        </div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={days === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* MRR Card */}
      <Card>
        <CardHeader>
          <CardTitle>Estimated MRR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatMoney(data.estimatedMRR)}</p>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Growth */}
        <Card>
          <CardHeader>
            <CardTitle>New Users</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.usersPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Messages per Day */}
        <Card>
          <CardHeader>
            <CardTitle>Messages per Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.messagesPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={planPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name ?? ''}: ${value}`}
                >
                  {planPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Chatbots */}
        <Card>
          <CardHeader>
            <CardTitle>Top Chatbots by Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topChatbots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chatbot data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.topChatbots} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="message_count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

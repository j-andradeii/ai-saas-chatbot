'use client'

import { StatsCards } from '@/components/admin/StatsCards'

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">System-wide metrics overview</p>
      </div>
      <StatsCards />
    </div>
  )
}

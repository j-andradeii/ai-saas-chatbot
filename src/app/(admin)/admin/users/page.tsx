'use client'

import { UserTable } from '@/components/admin/UserTable'

export default function AdminUsersPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage all registered users</p>
      </div>
      <UserTable />
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search } from 'lucide-react'

type SortField = 'created_at' | 'full_name' | 'message_count'
type SortDir = 'asc' | 'desc'

const planVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  free: 'secondary',
  pro: 'default',
  enterprise: 'outline',
}

export function UserTable() {
  const { data: users, isLoading, error } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    if (!users) return []
    const q = search.toLowerCase()
    const result = users.filter(
      (u) =>
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.company_name?.toLowerCase().includes(q) ?? false)
    )
    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'full_name') {
        return dir * (a.full_name ?? '').localeCompare(b.full_name ?? '')
      }
      if (sortField === 'message_count') {
        return dir * (a.message_count - b.message_count)
      }
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    })
    return result
  }, [users, search, sortField, sortDir])

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading users...</p>
  }

  if (error) {
    return <p className="text-destructive">Failed to load users.</p>
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('full_name')}
              >
                Name{sortIndicator('full_name')}
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('message_count')}
              >
                Messages{sortIndicator('message_count')}
              </TableHead>
              <TableHead>Chatbots</TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('created_at')}
              >
                Created{sortIndicator('created_at')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {search ? 'No users match your search.' : 'No users found.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u: AdminUser) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-medium hover:underline"
                    >
                      {u.full_name || 'Unnamed'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={planVariant[u.plan] ?? 'secondary'}>
                      {u.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.message_count.toLocaleString()} / {u.message_limit.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{u.chatbot_count}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? 'default' : 'secondary'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        {search ? ' matching' : ' total'}
      </p>
    </div>
  )
}

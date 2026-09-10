'use client'

import { useAdminUser, useUpdateAdminUser, type AdminUserDetail as AdminUserDetailType } from '@/hooks/useAdminUsers'
import { PLAN_LIMITS, type PlanName } from '@/lib/billing'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

interface UserDetailProps {
  userId: string
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const color = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function UserDetail({ userId }: UserDetailProps) {
  const { data: user, isLoading, error } = useAdminUser(userId)
  const updateUser = useUpdateAdminUser(userId)

  const handlePlanChange = (plan: string) => {
    const message_limit = (PLAN_LIMITS[plan as PlanName] ?? PLAN_LIMITS.free).messages
    updateUser.mutate(
      { plan: plan as 'free' | 'pro' | 'enterprise', message_limit },
      {
        onSuccess: () => toast(`Plan changed to ${plan}`),
        onError: () => toast.error('Failed to change plan'),
      }
    )
  }

  const handleToggleActive = () => {
    if (!user) return
    updateUser.mutate(
      { is_active: !user.is_active },
      {
        onSuccess: () => toast(user.is_active ? 'User deactivated' : 'User activated'),
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading user...</p>
  }

  if (error || !user) {
    return <p className="text-destructive">Failed to load user.</p>
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Name</dt>
              <dd className="text-sm">{user.full_name || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="text-sm">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Company</dt>
              <dd className="text-sm">{user.company_name || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Role</dt>
              <dd>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Plan</dt>
              <dd>
                <Badge variant={user.plan === 'enterprise' ? 'outline' : user.plan === 'pro' ? 'default' : 'secondary'}>
                  {user.plan}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Last Login</dt>
              <dd className="text-sm">
                {user.last_login_at
                  ? new Date(user.last_login_at).toLocaleString()
                  : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Message Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageBar used={user.message_count} limit={user.message_limit} />
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Change Plan</p>
              <Select
                defaultValue={user.plan}
                onValueChange={(value) => handlePlanChange(value as string)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (100 msgs)</SelectItem>
                  <SelectItem value="pro">Pro (5,000 msgs)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (50,000 msgs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={user.is_active ? 'destructive' : 'default'}
              onClick={handleToggleActive}
              disabled={updateUser.isPending}
            >
              {user.is_active ? 'Deactivate User' : 'Activate User'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chatbots Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Chatbots ({user.chatbots?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!user.chatbots || user.chatbots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chatbots created.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Conversations</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.chatbots.map((bot) => (
                    <TableRow key={bot.id}>
                      <TableCell className="font-medium">{bot.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {bot.domain}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bot.llm_model || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {bot.conversation_count}
                      </TableCell>
                      <TableCell>
                        <Badge variant={bot.active ? 'default' : 'secondary'}>
                          {bot.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserDetail } from '@/components/admin/UserDetail'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Eye } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const handleImpersonate = async () => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      toast.error('Failed to impersonate user')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/users" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
        <Button variant="outline" size="sm" onClick={handleImpersonate}>
          <Eye className="mr-2 h-4 w-4" />
          Impersonate User
        </Button>
      </div>
      <UserDetail userId={id} />
    </div>
  )
}

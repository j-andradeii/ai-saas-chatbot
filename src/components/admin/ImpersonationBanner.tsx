'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface ImpersonatedUser {
  full_name: string | null
  email: string | null
}

export function ImpersonationBanner() {
  const [user, setUser] = useState<ImpersonatedUser | null>(null)

  useEffect(() => {
    fetch('/api/admin/impersonate')
      .then((res) => res.json())
      .then((data) => {
        if (data.impersonating) setUser(data.user)
      })
      .catch(() => {})
  }, [])

  if (!user) return null

  const handleExit = async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    window.location.href = '/admin/users'
  }

  return (
    <div className="flex items-center justify-between bg-yellow-500 px-4 py-2 text-sm font-medium text-yellow-950">
      <span>
        Viewing as {user.full_name || user.email} — read-only mode
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        className="border-yellow-700 bg-transparent text-yellow-950 hover:bg-yellow-600"
      >
        <X className="mr-1 h-3 w-3" />
        Exit Impersonation
      </Button>
    </div>
  )
}

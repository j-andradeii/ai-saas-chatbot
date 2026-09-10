'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { PLAN_LIMITS, type PlanName } from '@/lib/billing'

interface PlanSettings {
  message_limit: number
  chatbot_limit: number
}

type Settings = Record<string, unknown>

/** Fall back to the shipped defaults for anything the API has not stored yet. */
function planSetting(value: unknown, plan: PlanName): PlanSettings {
  if (value && typeof value === 'object') return value as PlanSettings
  return {
    message_limit: PLAN_LIMITS[plan].messages,
    chatbot_limit: PLAN_LIMITS[plan].chatbots,
  }
}

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

function stringSetting(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Failed to fetch settings')
      return res.json()
    },
  })

  if (isLoading) {
    return <p className="text-muted-foreground">Loading settings...</p>
  }

  // The form mounts only once the settings have landed, so every field seeds
  // itself from the server data instead of being synced in an effect.
  return <SettingsForm settings={settings ?? {}} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient()

  const [rateLimit, setRateLimit] = useState(() => numberSetting(settings.rate_limit_per_minute, 20))
  const [maxFileSize, setMaxFileSize] = useState(() => numberSetting(settings.max_file_upload_mb, 10))
  const [planFree, setPlanFree] = useState(() => planSetting(settings.plan_free, 'free'))
  const [planPro, setPlanPro] = useState(() => planSetting(settings.plan_pro, 'pro'))
  const [planEnterprise, setPlanEnterprise] = useState(() =>
    planSetting(settings.plan_enterprise, 'enterprise')
  )
  const [bankName, setBankName] = useState(() => stringSetting(settings.bank_name))
  const [bankAccountName, setBankAccountName] = useState(() => stringSetting(settings.bank_account_name))
  const [bankBranch, setBankBranch] = useState(() => stringSetting(settings.bank_branch))
  const [bankAccountNumber, setBankAccountNumber] = useState(() =>
    stringSetting(settings.bank_account_number)
  )
  const [bankInstructions, setBankInstructions] = useState(() =>
    stringSetting(settings.bank_additional_instructions)
  )

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast('Settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const handleSave = () => {
    saveMutation.mutate({
      rate_limit_per_minute: rateLimit,
      max_file_upload_mb: maxFileSize,
      plan_free: planFree,
      plan_pro: planPro,
      plan_enterprise: planEnterprise,
      bank_name: bankName,
      bank_account_name: bankAccountName,
      bank_branch: bankBranch,
      bank_account_number: bankAccountNumber,
      bank_additional_instructions: bankInstructions,
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure platform-wide settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="rate_limit">Messages per minute (per IP per chatbot)</Label>
            <Input
              id="rate_limit"
              type="number"
              min={1}
              max={1000}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File Uploads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="max_file">Max file upload size (MB)</Label>
            <Input
              id="max_file"
              type="number"
              min={1}
              max={100}
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan Definitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            {([
              { label: 'Free', state: planFree, setter: setPlanFree },
              { label: 'Pro', state: planPro, setter: setPlanPro },
              { label: 'Enterprise', state: planEnterprise, setter: setPlanEnterprise },
            ] as const).map(({ label, state, setter }) => (
              <div key={label} className="space-y-3 rounded-md border p-4">
                <h4 className="font-medium">{label}</h4>
                <div className="space-y-2">
                  <Label>Message Limit</Label>
                  <Input
                    type="number"
                    min={0}
                    value={state.message_limit}
                    onChange={(e) =>
                      setter({ ...state, message_limit: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chatbot Limit</Label>
                  <Input
                    type="number"
                    min={0}
                    value={state.chatbot_limit}
                    onChange={(e) =>
                      setter({ ...state, chatbot_limit: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These details are shown to users on the billing page when they upgrade.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. BDO Unibank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account_name">Account Name</Label>
              <Input
                id="bank_account_name"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="e.g. AI Chatbot Services Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_branch">Branch</Label>
              <Input
                id="bank_branch"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="e.g. Makati Main"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input
                id="bank_account_number"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="e.g. 12345678"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_instructions">Additional Instructions</Label>
            <Textarea
              id="bank_instructions"
              value={bankInstructions}
              onChange={(e) => setBankInstructions(e.target.value)}
              placeholder="e.g. Please include your email address in the transfer reference"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}

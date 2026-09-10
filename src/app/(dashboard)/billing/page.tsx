'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProfile, usePayments, useSubmitPayment, useBankDetails } from '@/hooks/useBilling'
import {
  PLAN_LIMITS,
  PLAN_PRICING,
  CURRENCY,
  formatMoney,
  type PaidPlan,
  type BillingCycle,
} from '@/lib/billing'
import { CreditCard, Upload, Check, AlertCircle } from 'lucide-react'

const planColors = {
  free: 'bg-gray-100 text-gray-700',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function BillingPage() {
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: payments, isLoading: paymentsLoading } = usePayments()
  const { data: bankDetails } = useBankDetails()
  const submitPayment = useSubmitPayment()

  const [selectedPlan, setSelectedPlan] = useState<PaidPlan>('pro')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [showUpgradeForm, setShowUpgradeForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (profileLoading) {
    return <div className="space-y-8"><h1 className="text-3xl font-bold">Billing</h1><p className="text-muted-foreground">Loading...</p></div>
  }

  if (!profile) return null

  const plan = profile.plan
  const messageUsage = profile.message_limit > 0
    ? Math.min((profile.message_count / profile.message_limit) * 100, 100)
    : 0

  const amount = PLAN_PRICING[selectedPlan][billingCycle]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!proofFile) return

    const formData = new FormData()
    formData.append('plan_requested', selectedPlan)
    formData.append('billing_cycle', billingCycle)
    formData.append('reference_number', referenceNumber)
    formData.append('proof_file', proofFile)

    submitPayment.mutate(formData, {
      onSuccess: () => {
        setShowUpgradeForm(false)
        setReferenceNumber('')
        setProofFile(null)
      },
    })
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Billing</h1>

      {/* Current Plan Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Current Plan</CardTitle>
          <Badge className={planColors[plan]}>{plan.toUpperCase()}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Messages</p>
              <p className="text-lg font-semibold">
                {profile.message_count.toLocaleString()} / {profile.message_limit.toLocaleString()}
              </p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    messageUsage >= 90 ? 'bg-destructive' : messageUsage >= 70 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${messageUsage}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chatbots</p>
              <p className="text-lg font-semibold">{PLAN_LIMITS[plan].chatbots}</p>
            </div>
            {plan !== 'free' && profile.billing_period_start && (
              <div>
                <p className="text-sm text-muted-foreground">Billing Period</p>
                <p className="text-sm">
                  {new Date(profile.billing_period_start).toLocaleDateString()} &mdash;{' '}
                  {profile.billing_cycle === 'monthly' ? '30 days' : '365 days'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {(['free', 'pro', 'enterprise'] as const).map((p) => {
              const isCurrent = p === plan
              const limits = PLAN_LIMITS[p]
              return (
                <div
                  key={p}
                  className={`rounded-lg border p-4 ${isCurrent ? 'border-primary ring-2 ring-primary/20' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold capitalize">{p}</h3>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                  </div>
                  <div className="mt-2">
                    {p === 'free' ? (
                      <p className="text-2xl font-bold">$0</p>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold">
                          ${PLAN_PRICING[p].monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or ${PLAN_PRICING[p].yearly}/yr (Save ~17%)
                        </p>
                      </div>
                    )}
                  </div>
                  <Separator className="my-3" />
                  <ul className="space-y-1 text-sm">
                    <li>{limits.messages.toLocaleString()} messages/period</li>
                    <li>{limits.chatbots} chatbot{limits.chatbots > 1 ? 's' : ''}</li>
                    {p === 'enterprise' && <li>Priority support</li>}
                  </ul>
                  {!isCurrent && p !== 'free' && (
                    <Button
                      className="mt-4 w-full"
                      variant={p === 'enterprise' ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedPlan(p)
                        setShowUpgradeForm(true)
                      }}
                    >
                      Upgrade to {p}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Form */}
      {showUpgradeForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              Upgrade to {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitPayment.isSuccess ? (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-4 text-green-700">
                <Check className="h-5 w-5" />
                <p>Payment proof submitted! We&apos;ll review it within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Billing Cycle Toggle */}
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <div className="flex gap-2">
                    {(['monthly', 'yearly'] as const).map((cycle) => (
                      <Button
                        key={cycle}
                        type="button"
                        variant={billingCycle === cycle ? 'default' : 'outline'}
                        onClick={() => setBillingCycle(cycle)}
                      >
                        {cycle === 'monthly' ? 'Monthly' : 'Yearly (Save ~17%)'}
                      </Button>
                    ))}
                  </div>
                  <p className="text-lg font-semibold">
                    Amount:{' '}
                    <span className="text-primary">
                      {formatMoney(amount)} {CURRENCY}
                    </span>
                  </p>
                </div>

                <Separator />

                {/* Bank Transfer Instructions */}
                <div className="rounded-md bg-muted p-4 space-y-2">
                  <h4 className="font-medium">Bank Transfer Details</h4>
                  {bankDetails?.bank_name ? (
                    <div className="grid gap-1 text-sm">
                      <p><span className="text-muted-foreground">Bank:</span> {bankDetails.bank_name}</p>
                      <p><span className="text-muted-foreground">Account Name:</span> {bankDetails.bank_account_name}</p>
                      <p><span className="text-muted-foreground">Branch:</span> {bankDetails.bank_branch}</p>
                      <p><span className="text-muted-foreground">Account Number:</span> {bankDetails.bank_account_number}</p>
                      {bankDetails.bank_additional_instructions && (
                        <p className="mt-1 text-muted-foreground">{bankDetails.bank_additional_instructions}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Bank details not yet configured. Please contact support.</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Include your email in the transfer reference.
                  </p>
                </div>

                {/* Reference Number */}
                <div className="space-y-2">
                  <Label htmlFor="reference">Transfer Reference Number</Label>
                  <Input
                    id="reference"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. EFT-12345"
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Payment Proof</Label>
                  <div
                    className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors hover:border-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-sm">
                        {proofFile ? proofFile.name : 'Click to upload (PNG, JPG, WEBP, PDF — max 5MB)'}
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                </div>

                {submitPayment.isError && (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {submitPayment.error.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={!proofFile || submitPayment.isPending}>
                    {submitPayment.isPending ? 'Submitting...' : 'Submit Payment Proof'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowUpgradeForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !payments?.length ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={planColors[p.plan_requested]}>{p.plan_requested}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{p.billing_cycle}</TableCell>
                    <TableCell className="text-sm">{formatMoney(p.amount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status]}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {p.admin_notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

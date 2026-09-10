'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAdminPayments, useReviewPayment, type AdminPayment } from '@/hooks/useAdminPayments'
import { useBankDetails } from '@/hooks/useBilling'
import { formatMoney } from '@/lib/billing'
import { Check, X, Eye, AlertCircle } from 'lucide-react'

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: payments, isLoading } = useAdminPayments(
    statusFilter === 'all' ? undefined : statusFilter
  )
  const { data: bankDetails } = useBankDetails()
  const reviewPayment = useReviewPayment()

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const pendingPayments = payments?.filter((p) => p.status === 'pending') ?? []

  function handleApprove(id: string) {
    reviewPayment.mutate({ id, status: 'approved' })
  }

  function handleReject() {
    if (!rejectingId) return
    reviewPayment.mutate(
      { id: rejectingId, status: 'rejected', admin_notes: rejectNotes },
      {
        onSuccess: () => {
          setRejectingId(null)
          setRejectNotes('')
        },
      }
    )
  }

  function renderPaymentRow(payment: AdminPayment, showActions = false) {
    const userInfo = payment.profiles
    return (
      <TableRow key={payment.id}>
        <TableCell className="text-sm">
          <div>
            <p className="font-medium">{userInfo?.full_name || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">{userInfo?.email}</p>
          </div>
        </TableCell>
        <TableCell className="text-sm">{userInfo?.company_name || '—'}</TableCell>
        <TableCell>
          <span className="text-sm">{userInfo?.plan} → <span className="font-medium">{payment.plan_requested}</span></span>
        </TableCell>
        <TableCell className="text-sm capitalize">{payment.billing_cycle}</TableCell>
        <TableCell className="text-sm">{formatMoney(payment.amount)}</TableCell>
        <TableCell className="text-sm">{payment.reference_number || '—'}</TableCell>
        <TableCell className="text-sm">
          {new Date(payment.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell>
          <Badge className={statusColors[payment.status]}>{payment.status}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProofUrl(payment.proof_url)}
            >
              <Eye className="h-3 w-3" />
            </Button>
            {showActions && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleApprove(payment.id)}
                  disabled={reviewPayment.isPending}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectingId(payment.id)}
                  disabled={reviewPayment.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Payments</h1>

      {/* Bank Details Reference */}
      {bankDetails?.bank_name && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bank Transfer Details (shown to users)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {bankDetails.bank_name} | {bankDetails.bank_account_name} | Branch: {bankDetails.bank_branch} | Acc: {bankDetails.bank_account_number}
          </CardContent>
        </Card>
      )}

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Review ({pendingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan Change</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((p) => renderPaymentRow(p, true))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Payments with Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
            <TabsContent value={statusFilter} className="mt-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : !payments?.length ? (
                <p className="text-sm text-muted-foreground">No payments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Plan Change</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => renderPaymentRow(p, p.status === 'pending'))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for rejection</Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Explain why this payment is being rejected..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={reviewPayment.isPending}
              >
                {reviewPayment.isPending ? 'Rejecting...' : 'Reject Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proof Viewer Dialog */}
      <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {proofUrl && (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/payments/proof?path=${encodeURIComponent(proofUrl)}`}
                alt="Payment proof"
                className="max-h-[500px] rounded-md object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

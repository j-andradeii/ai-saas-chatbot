'use client'

import { useRef } from 'react'
import { useDocuments, useUploadDocument, useDeleteDocument, useReprocessDocument } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Trash2, FileText, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusConfig = {
  pending: { label: 'Pending', variant: 'outline' as const },
  processing: { label: 'Processing', variant: 'secondary' as const },
  ready: { label: 'Ready', variant: 'default' as const },
  error: { label: 'Error', variant: 'destructive' as const },
}

export function DocumentUpload({ chatbotId }: { chatbotId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: documents, isLoading } = useDocuments(chatbotId)
  const uploadDocument = useUploadDocument(chatbotId)
  const deleteDocument = useDeleteDocument(chatbotId)
  const reprocessDocument = useReprocessDocument(chatbotId)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    uploadDocument.mutate(file, {
      onSuccess: () => {
        toast('Document uploaded. Processing will begin shortly.')
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.docx"
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDocument.isPending}
        >
          {uploadDocument.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {uploadDocument.isPending ? 'Uploading...' : 'Upload Document'}
        </Button>
        <span className="text-sm text-muted-foreground">
          PDF, TXT, or DOCX (max 10MB)
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      ) : !documents?.length ? (
        <p className="text-sm text-muted-foreground">
          No documents uploaded yet. Upload documents to give your chatbot
          knowledge about your business.
        </p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">File</th>
                <th className="px-4 py-2 text-left font-medium">Size</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Uploaded</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const status = statusConfig[doc.status]
                return (
                  <tr key={doc.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">
                          {doc.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {doc.status === 'error' && doc.error_message && (
                        <span className="ml-2 text-xs text-destructive">
                          {doc.error_message}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {doc.status === 'error' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              reprocessDocument.mutate(doc.id, {
                                onSuccess: () => toast('Reprocessing started'),
                                onError: () =>
                                  toast.error('Failed to reprocess document'),
                              })
                            }
                            disabled={reprocessDocument.isPending}
                            title="Retry processing"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            deleteDocument.mutate(doc.id, {
                              onSuccess: () => toast('Document deleted'),
                              onError: () =>
                                toast.error('Failed to delete document'),
                            })
                          }
                          disabled={deleteDocument.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

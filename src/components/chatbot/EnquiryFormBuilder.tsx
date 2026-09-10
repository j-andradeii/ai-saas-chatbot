'use client'

import { useState } from 'react'
import { useEnquiryForms, useCreateEnquiryForm, useDeleteEnquiryForm } from '@/hooks/useEnquiryForms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { EnquiryFormField } from '@/types'

const FIELD_TYPES = ['string', 'email', 'phone', 'number', 'textarea', 'select', 'date'] as const

interface EnquiryFormBuilderProps {
  chatbotId: string
}

function emptyField(): EnquiryFormField {
  return { name: '', label: '', type: 'string', required: true }
}

export function EnquiryFormBuilder({ chatbotId }: EnquiryFormBuilderProps) {
  const { data: forms, isLoading } = useEnquiryForms(chatbotId)
  const createForm = useCreateEnquiryForm(chatbotId)
  const deleteForm = useDeleteEnquiryForm(chatbotId)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [fields, setFields] = useState<EnquiryFormField[]>([emptyField()])

  const handleAddField = () => {
    setFields([...fields, emptyField()])
  }

  const handleRemoveField = (index: number) => {
    if (fields.length <= 1) return
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index: number, key: keyof EnquiryFormField, value: unknown) => {
    const updated = [...fields]
    updated[index] = { ...updated[index], [key]: value }
    setFields(updated)
  }

  const resetForm = () => {
    setName('')
    setDisplayName('')
    setDescription('')
    setWebhookUrl('')
    setSuccessMessage('')
    setFields([emptyField()])
    setShowForm(false)
  }

  const handleSubmit = () => {
    const validFields = fields.filter((f) => f.name.trim() && f.label.trim())
    if (validFields.length === 0) {
      toast.error('At least one field is required')
      return
    }

    createForm.mutate(
      {
        name,
        display_name: displayName,
        description,
        fields: validFields,
        webhook_url: webhookUrl || undefined,
        success_message: successMessage || undefined,
      },
      {
        onSuccess: () => {
          toast('Enquiry form created')
          resetForm()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleDelete = (formId: string) => {
    deleteForm.mutate(formId, {
      onSuccess: () => toast('Enquiry form deleted'),
      onError: () => toast.error('Failed to delete form'),
    })
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading enquiry forms...</p>
  }

  return (
    <div className="space-y-4">
      {forms && forms.length > 0 && (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardContent className="flex items-start justify-between py-4">
                <div>
                  <p className="font-medium">{form.display_name}</p>
                  <p className="text-xs text-muted-foreground">Tool name: {form.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{form.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(form.fields as EnquiryFormField[]).map((f) => (
                      <Badge key={f.name} variant="outline" className="text-xs">
                        {f.label} ({f.type}){f.required ? ' *' : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(form.id)}
                  disabled={deleteForm.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Enquiry Form</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tool Name (snake_case)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. contact_form"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Contact Form"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell the AI when to use this form..."
              />
            </div>

            <div className="space-y-2">
              <Label>Fields</Label>
              {fields.map((field, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                  <Input
                    placeholder="field_name"
                    value={field.name}
                    onChange={(e) => handleFieldChange(i, 'name', e.target.value)}
                    className="w-28"
                  />
                  <Input
                    placeholder="Label"
                    value={field.label}
                    onChange={(e) => handleFieldChange(i, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => handleFieldChange(i, 'type', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={field.required ?? true}
                      onChange={(e) => handleFieldChange(i, 'required', e.target.checked)}
                    />
                    Req
                  </label>
                  {field.type === 'select' && (
                    <Input
                      placeholder="opt1,opt2,opt3"
                      value={(field.options || []).join(',')}
                      onChange={(e) =>
                        handleFieldChange(i, 'options', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))
                      }
                      className="w-36"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(i)}
                    disabled={fields.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddField}>
                <Plus className="mr-1 h-3 w-3" /> Add Field
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Webhook URL (optional)</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Success Message</Label>
                <Input
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Thank you! Your enquiry has been submitted."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={createForm.isPending || !name || !displayName || !description}
              >
                {createForm.isPending ? 'Creating...' : 'Create Form'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Enquiry Form
        </Button>
      )}
    </div>
  )
}

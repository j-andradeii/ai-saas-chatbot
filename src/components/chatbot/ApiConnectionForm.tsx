'use client'

import { useState } from 'react'
import {
  useApiConnections,
  useCreateApiConnection,
  useUpdateApiConnection,
  useDeleteApiConnection,
} from '@/hooks/useApiConnections'
import { useEnquiryForms } from '@/hooks/useEnquiryForms'
import type { ApiConnection, ApiConnectionParameter } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, X, ChevronDown, ChevronUp, Power, PowerOff, Pencil } from 'lucide-react'
import { toast } from 'sonner'

const CTA_TYPE_LABELS: Record<string, string> = {
  none: 'No button',
  form: 'Open a form',
  link: 'Open a link',
}

interface ApiConnectionFormProps {
  chatbotId: string
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const PARAM_TYPES = ['string', 'number', 'boolean'] as const

const methodColors: Record<string, string> = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function ApiConnectionForm({ chatbotId }: ApiConnectionFormProps) {
  const { data: connections, isLoading } = useApiConnections(chatbotId)
  const createConnection = useCreateApiConnection(chatbotId)
  const updateConnection = useUpdateApiConnection(chatbotId)
  const deleteConnection = useDeleteApiConnection(chatbotId)

  const { data: forms } = useEnquiryForms(chatbotId)
  const enquiryForms = (forms || []).filter((f) => f.is_enabled)

  const [showForm, setShowForm] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [method, setMethod] = useState<string>('GET')
  const [url, setUrl] = useState('')
  const [parameters, setParameters] = useState<ApiConnectionParameter[]>([])
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([])
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [responsePath, setResponsePath] = useState('')
  const [timeoutMs, setTimeoutMs] = useState(10000)
  // Card display
  const [cardInstructions, setCardInstructions] = useState('')
  const [ctaType, setCtaType] = useState<'none' | 'form' | 'link'>('none')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaFormId, setCtaFormId] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')

  const resetForm = () => {
    setName('')
    setDescription('')
    setMethod('GET')
    setUrl('')
    setParameters([])
    setHeaders([])
    setBodyTemplate('')
    setResponsePath('')
    setTimeoutMs(10000)
    setCardInstructions('')
    setCtaType('none')
    setCtaLabel('')
    setCtaFormId('')
    setCtaUrl('')
    setShowAdvanced(false)
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (conn: ApiConnection) => {
    setEditingId(conn.id)
    setName(conn.name)
    setDescription(conn.description)
    setMethod(conn.method)
    setUrl(conn.url)
    setParameters(conn.parameters.length > 0 ? [...conn.parameters] : [])
    // Headers come masked from GET — convert to key/value pairs
    const headerEntries = conn.headers ? Object.entries(conn.headers) : []
    setHeaders(headerEntries.map(([key, value]) => ({ key, value: String(value) })))
    setBodyTemplate(conn.request_body_template ? JSON.stringify(conn.request_body_template, null, 2) : '')
    setResponsePath(conn.response_path || '')
    setTimeoutMs(conn.timeout_ms)
    setCardInstructions(conn.card_instructions || '')
    setCtaType(conn.cta_type || 'none')
    setCtaLabel(conn.cta_label || '')
    setCtaFormId(conn.cta_form_id || '')
    setCtaUrl(conn.cta_url || '')
    setShowAdvanced(headerEntries.length > 0 || !!conn.request_body_template || !!conn.response_path || conn.timeout_ms !== 10000)
    setShowForm(true)
  }

  const handleAddParam = () => {
    setParameters([...parameters, { name: '', type: 'string', description: '', required: true }])
  }

  const handleRemoveParam = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  const handleParamChange = (
    index: number,
    field: keyof ApiConnectionParameter,
    value: string | boolean
  ) => {
    const updated = [...parameters]
    updated[index] = { ...updated[index], [field]: value }
    setParameters(updated)
  }

  const handleAddHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const handleRemoveHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headers]
    updated[index] = { ...updated[index], [field]: value }
    setHeaders(updated)
  }

  const handleSubmit = () => {
    const headersObj: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) headersObj[h.key.trim()] = h.value
    }

    let parsedBody: Record<string, unknown> | null = null
    if (bodyTemplate.trim()) {
      try {
        parsedBody = JSON.parse(bodyTemplate)
      } catch {
        toast.error('Invalid JSON in request body template')
        return
      }
    }

    if (ctaType === 'form' && !ctaFormId) {
      toast.error('Choose a form for the CTA button')
      return
    }
    if (ctaType === 'link' && !/^https?:\/\//i.test(ctaUrl.trim())) {
      toast.error('CTA link must start with http:// or https://')
      return
    }

    const payload = {
      name,
      description,
      method,
      url,
      parameters: parameters.filter((p) => p.name.trim()),
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      request_body_template: parsedBody,
      response_path: responsePath.trim() || null,
      timeout_ms: timeoutMs,
      card_instructions: cardInstructions.trim(),
      cta_type: ctaType,
      cta_label: ctaLabel.trim(),
      cta_form_id: ctaType === 'form' ? ctaFormId : null,
      cta_url: ctaType === 'link' ? ctaUrl.trim() : null,
    }

    if (editingId) {
      updateConnection.mutate(
        { connectionId: editingId, data: payload },
        {
          onSuccess: () => {
            toast('API connection updated')
            resetForm()
          },
          onError: (err) => toast.error(err.message),
        }
      )
    } else {
      createConnection.mutate(payload, {
        onSuccess: () => {
          toast('API connection created')
          resetForm()
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  const handleToggle = (connectionId: string, currentEnabled: boolean) => {
    updateConnection.mutate(
      { connectionId, data: { is_enabled: !currentEnabled } },
      {
        onSuccess: () => toast(currentEnabled ? 'Connection disabled' : 'Connection enabled'),
        onError: () => toast.error('Failed to update connection'),
      }
    )
  }

  const handleDelete = (connectionId: string) => {
    deleteConnection.mutate(connectionId, {
      onSuccess: () => toast('API connection deleted'),
      onError: () => toast.error('Failed to delete connection'),
    })
  }

  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method)

  if (isLoading) {
    return <p className="text-muted-foreground">Loading API connections...</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your chatbot to external REST APIs so it can fetch live data during conversations.
      </p>

      {connections && connections.length > 0 && (
        <div className="space-y-3">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-bold ${methodColors[conn.method] || ''}`}
                    >
                      {conn.method}
                    </span>
                    <p className="font-medium">{conn.name}</p>
                    {!conn.is_enabled && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{conn.description}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground font-mono">
                    {conn.url}
                  </p>
                  {conn.parameters.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {conn.parameters.map((p) => (
                        <Badge key={p.name} variant="outline" className="text-xs">
                          {p.name}: {p.type}
                          {p.required ? '' : '?'}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(conn)}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(conn.id, conn.is_enabled)}
                    disabled={updateConnection.isPending}
                    title={conn.is_enabled ? 'Disable' : 'Enable'}
                  >
                    {conn.is_enabled ? (
                      <Power className="h-4 w-4 text-green-600" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(conn.id)}
                    disabled={deleteConnection.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Edit API Connection' : 'New API Connection'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Name + Method */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name (snake_case)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. get_bookings"
                />
              </div>
              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: URL */}
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/bookings/{booking_id}"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{param_name}'} for URL parameters
              </p>
            </div>

            {/* Row 3: Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to call this API and what it returns"
                rows={2}
              />
            </div>

            {/* Parameters */}
            <div className="space-y-2">
              <Label>Parameters</Label>
              {parameters.map((param, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="name"
                    value={param.name}
                    onChange={(e) => handleParamChange(i, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={param.type}
                    onChange={(e) => handleParamChange(i, 'type', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  >
                    {PARAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="description"
                    value={param.description}
                    onChange={(e) => handleParamChange(i, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Checkbox
                      checked={param.required}
                      onCheckedChange={(checked) =>
                        handleParamChange(i, 'required', checked as boolean)
                      }
                    />
                    <span className="text-xs text-muted-foreground">Req</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveParam(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddParam}>
                <Plus className="mr-1 h-3 w-3" /> Add Parameter
              </Button>
            </div>

            {/* Card display */}
            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Card Display</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Controls how results from this connection are presented in the chat.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_instructions">Display instructions (optional)</Label>
                <Textarea
                  id="card_instructions"
                  value={cardInstructions}
                  onChange={(e) => setCardInstructions(e.target.value)}
                  placeholder={'e.g. Lead with the tour name and price. Keep it to one short sentence and never mention internal IDs.'}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Told to the assistant when it presents these results — it shapes the wording and
                  which details get called out. Card layout itself stays consistent.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cta_type">Call-to-action button</Label>
                <Select
                  value={ctaType}
                  onValueChange={(value) => setCtaType(value as 'none' | 'form' | 'link')}
                >
                  <SelectTrigger id="cta_type">
                    <SelectValue>
                      {(v) => CTA_TYPE_LABELS[v as string] ?? CTA_TYPE_LABELS.none}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No button</SelectItem>
                    <SelectItem value="form">Open a form</SelectItem>
                    <SelectItem value="link">Open a link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {ctaType !== 'none' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cta_label">Button label</Label>
                    <Input
                      id="cta_label"
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      placeholder={ctaType === 'form' ? 'e.g. Enquire now' : 'e.g. Book this tour'}
                      maxLength={60}
                    />
                  </div>

                  {ctaType === 'form' ? (
                    <div className="space-y-2">
                      <Label htmlFor="cta_form">Form to open</Label>
                      <Select
                        value={ctaFormId}
                        onValueChange={(value) => setCtaFormId(value as string)}
                      >
                        <SelectTrigger id="cta_form">
                          <SelectValue placeholder="Select a form">
                            {(v) =>
                              enquiryForms.find((f) => f.id === v)?.display_name ?? 'Select a form'
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {enquiryForms.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {enquiryForms.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No enabled forms yet — create one in the Enquiry Forms tab first.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cta_url">Link</Label>
                      <Input
                        id="cta_url"
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://example.com/tours/{slug}"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {'{field}'} to insert a value from the item, so each card links to its
                        own page — e.g. https://example.com/tours/{'{slug}'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Advanced section */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Advanced Settings
            </button>

            {showAdvanced && (
              <div className="space-y-4 rounded-lg border p-4">
                {/* Headers */}
                <div className="space-y-2">
                  <Label>Headers (auth tokens, API keys)</Label>
                  {editingId && headers.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Saved secrets show masked (••••). Leave one as-is to keep it; type over it to
                      replace it.
                    </p>
                  )}
                  {headers.map((header, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Header name"
                        value={header.key}
                        onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        type="password"
                        value={header.value}
                        onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveHeader(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddHeader}>
                    <Plus className="mr-1 h-3 w-3" /> Add Header
                  </Button>
                </div>

                {/* Body Template (only for POST/PUT/PATCH) */}
                {hasBody && (
                  <div className="space-y-2">
                    <Label>Request Body Template (JSON)</Label>
                    <Textarea
                      value={bodyTemplate}
                      onChange={(e) => setBodyTemplate(e.target.value)}
                      placeholder='{"query": "{search_term}", "limit": 10}'
                      rows={3}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{param_name}'} placeholders. If empty, parameters are sent as the body.
                    </p>
                  </div>
                )}

                {/* Response Path */}
                <div className="space-y-2">
                  <Label>Response Path (optional)</Label>
                  <Input
                    value={responsePath}
                    onChange={(e) => setResponsePath(e.target.value)}
                    placeholder="data.bookings"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dot-notation to extract a specific field from the response
                  </p>
                </div>

                {/* Timeout */}
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 10000)}
                    min={1000}
                    max={30000}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={(editingId ? updateConnection.isPending : createConnection.isPending) || !name || !description || !url}
              >
                {editingId
                  ? (updateConnection.isPending ? 'Saving...' : 'Save Changes')
                  : (createConnection.isPending ? 'Creating...' : 'Create Connection')}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add API Connection
        </Button>
      )}
    </div>
  )
}

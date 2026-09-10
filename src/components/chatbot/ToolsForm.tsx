'use client'

import { useState } from 'react'
import { useChatbotTools, useCreateTool, useDeleteTool } from '@/hooks/useTools'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

interface ToolsFormProps {
  chatbotId: string
}

export function ToolsForm({ chatbotId }: ToolsFormProps) {
  const { data: tools, isLoading } = useChatbotTools(chatbotId)
  const createTool = useCreateTool(chatbotId)
  const deleteTool = useDeleteTool(chatbotId)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [params, setParams] = useState<Array<{ key: string; type: string }>>([])

  const handleAddParam = () => {
    setParams([...params, { key: '', type: 'string' }])
  }

  const handleRemoveParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index))
  }

  const handleParamChange = (index: number, field: 'key' | 'type', value: string) => {
    const updated = [...params]
    updated[index][field] = value
    setParams(updated)
  }

  const handleSubmit = () => {
    const parameters: Record<string, string> = {}
    for (const p of params) {
      if (p.key.trim()) parameters[p.key.trim()] = p.type
    }

    createTool.mutate(
      {
        name,
        description,
        parameters,
        webhook_url: webhookUrl || undefined,
      },
      {
        onSuccess: () => {
          toast('Tool created')
          setName('')
          setDescription('')
          setWebhookUrl('')
          setParams([])
          setShowForm(false)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleDelete = (toolId: string) => {
    deleteTool.mutate(toolId, {
      onSuccess: () => toast('Tool deleted'),
      onError: () => toast.error('Failed to delete tool'),
    })
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading tools...</p>
  }

  return (
    <div className="space-y-4">
      {tools && tools.length > 0 && (
        <div className="space-y-3">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(tool.parameters).map(([key, type]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}: {type}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(tool.id)}
                  disabled={deleteTool.isPending}
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
            <CardTitle className="text-base">New Tool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name (snake_case)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. check_inventory"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this tool do?"
              />
            </div>
            <div className="space-y-2">
              <Label>Parameters</Label>
              {params.map((param, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="param_name"
                    value={param.key}
                    onChange={(e) => handleParamChange(i, 'key', e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={param.type}
                    onChange={(e) => handleParamChange(i, 'type', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveParam(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={handleAddParam}>
                <Plus className="mr-1 h-3 w-3" /> Add Parameter
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Webhook URL (optional)</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={createTool.isPending || !name || !description}>
                {createTool.isPending ? 'Creating...' : 'Create Tool'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Tool
        </Button>
      )}
    </div>
  )
}

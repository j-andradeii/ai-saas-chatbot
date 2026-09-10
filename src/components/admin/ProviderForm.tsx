'use client'

import { useState } from 'react'
import { useUpdateProvider } from '@/hooks/useProviders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { LLMProvider } from '@/types'

interface ProviderFormProps {
  provider: LLMProvider
}

export function ProviderForm({ provider }: ProviderFormProps) {
  const [apiKey, setApiKey] = useState('')
  const [isEnabled, setIsEnabled] = useState(provider.is_enabled)
  const updateProvider = useUpdateProvider()

  const handleSaveKey = () => {
    if (!apiKey.trim()) return
    updateProvider.mutate(
      { id: provider.id, platform_api_key: apiKey },
      {
        onSuccess: () => {
          toast('API key updated')
          setApiKey('')
        },
        onError: () => toast.error('Failed to update API key'),
      }
    )
  }

  const handleToggleEnabled = () => {
    const newValue = !isEnabled
    setIsEnabled(newValue)
    updateProvider.mutate(
      { id: provider.id, is_enabled: newValue },
      {
        onSuccess: () => toast(`${provider.display_name} ${newValue ? 'enabled' : 'disabled'}`),
        onError: () => {
          setIsEnabled(!newValue) // revert
          toast.error('Failed to update provider')
        },
      }
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{provider.display_name}</CardTitle>
        <Badge variant={isEnabled ? 'default' : 'secondary'}>
          {isEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Platform API Key</Label>
          <p className="text-xs text-muted-foreground">
            Current: {provider.platform_api_key || 'Not set'}
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter new API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button
              onClick={handleSaveKey}
              disabled={!apiKey.trim() || updateProvider.isPending}
              size="sm"
            >
              Save Key
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <div>
            <Button
              variant={isEnabled ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleEnabled}
              disabled={updateProvider.isPending}
            >
              {isEnabled ? 'Disable' : 'Enable'} Provider
            </Button>
          </div>
        </div>

        {provider.models && provider.models.length > 0 && (
          <div className="space-y-2">
            <Label>Available Models</Label>
            <div className="flex flex-wrap gap-2">
              {provider.models.map((model) => (
                <Badge key={model.id} variant="outline">
                  {model.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

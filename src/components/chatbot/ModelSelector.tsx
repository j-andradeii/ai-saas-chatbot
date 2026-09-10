'use client'

import { useState } from 'react'
import { useEnabledProviders } from '@/hooks/useProviders'
import { useUpdateChatbot } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

interface ModelSelectorProps {
  chatbot: Chatbot
}

export function ModelSelector({ chatbot }: ModelSelectorProps) {
  const { data: providers, isLoading } = useEnabledProviders()
  const updateChatbot = useUpdateChatbot(chatbot.id)
  const [selectedProvider, setSelectedProvider] = useState(chatbot.llm_provider || '')
  const [selectedModel, setSelectedModel] = useState(chatbot.llm_model || '')

  const currentProvider = providers?.find((p) => p.name === selectedProvider)

  const handleSave = () => {
    if (!selectedProvider || !selectedModel) {
      toast.error('Please select a provider and model')
      return
    }
    updateChatbot.mutate(
      { llm_provider: selectedProvider, llm_model: selectedModel },
      {
        onSuccess: () => toast('Model updated'),
        onError: () => toast.error('Failed to update model'),
      }
    )
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading providers...</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>LLM Provider</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {providers?.map((provider) => (
            <Card
              key={provider.id}
              className={`cursor-pointer transition-colors ${
                selectedProvider === provider.name
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => {
                setSelectedProvider(provider.name)
                // Auto-select first model if switching provider
                if (provider.name !== selectedProvider && provider.models?.length) {
                  setSelectedModel(provider.models[0].name)
                }
              }}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-sm">{provider.display_name}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  {provider.models?.length || 0} models
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {currentProvider && currentProvider.models && currentProvider.models.length > 0 && (
        <div className="space-y-2">
          <Label>Model</Label>
          <div className="flex flex-wrap gap-2">
            {currentProvider.models.map((model) => (
              <Badge
                key={model.id}
                variant={selectedModel === model.name ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedModel(model.name)}
              >
                {model.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button
          onClick={handleSave}
          disabled={updateChatbot.isPending || !selectedProvider || !selectedModel}
        >
          {updateChatbot.isPending ? 'Saving...' : 'Save Model'}
        </Button>
        {chatbot.llm_provider && (
          <p className="text-sm text-muted-foreground">
            Current: {chatbot.llm_provider} / {chatbot.llm_model}
          </p>
        )}
      </div>
    </div>
  )
}

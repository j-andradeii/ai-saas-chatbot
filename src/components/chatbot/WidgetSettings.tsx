'use client'

import { useState } from 'react'
import { useUpdateChatbot } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

interface WidgetSettingsProps {
  chatbot: Chatbot
}

export function WidgetSettings({ chatbot }: WidgetSettingsProps) {
  const updateChatbot = useUpdateChatbot(chatbot.id)
  const [color, setColor] = useState(chatbot.primary_color || '#6366f1')
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>(
    chatbot.widget_position || 'bottom-right'
  )

  const handleSave = () => {
    updateChatbot.mutate(
      { primary_color: color, widget_position: position },
      {
        onSuccess: () => toast('Widget settings saved'),
        onError: () => toast.error('Failed to save widget settings'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="primary_color">Widget Color</Label>
        <div className="flex items-center gap-3">
          <input
            id="primary_color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded border p-0.5"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-32"
            maxLength={7}
          />
          <div
            className="h-10 flex-1 rounded-md"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Widget Position</Label>
        <div className="flex gap-3">
          {(['bottom-right', 'bottom-left'] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPosition(pos)}
              className={`flex-1 rounded-md border p-3 text-center text-sm transition-colors ${
                position === pos
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'hover:border-primary/50'
              }`}
            >
              {pos === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateChatbot.isPending}>
        {updateChatbot.isPending ? 'Saving...' : 'Save Widget Settings'}
      </Button>
    </div>
  )
}

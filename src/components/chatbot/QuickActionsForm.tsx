'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateChatbot } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

const quickActionsSchema = z.object({
  quick_actions: z.array(
    z.object({
      label: z.string().min(1, 'Label is required').max(30, 'Max 30 characters'),
      prompt: z.string().min(1, 'Prompt is required'),
    })
  ),
})

type QuickActionsFormValues = z.infer<typeof quickActionsSchema>

interface QuickActionsFormProps {
  chatbot: Chatbot
}

export function QuickActionsForm({ chatbot }: QuickActionsFormProps) {
  const updateChatbot = useUpdateChatbot(chatbot.id)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<QuickActionsFormValues>({
    resolver: zodResolver(quickActionsSchema),
    defaultValues: {
      quick_actions: chatbot.quick_actions?.length
        ? chatbot.quick_actions.map((a) => ({ label: a.label, prompt: a.prompt }))
        : [],
    },
  })

  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: 'quick_actions',
  })

  const onSubmit = (data: QuickActionsFormValues) => {
    updateChatbot.mutate(
      { quick_actions: data.quick_actions },
      {
        onSuccess: () => toast('Quick actions saved'),
        onError: () => toast.error('Failed to save quick actions'),
      }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Quick actions appear as suggestion buttons in the widget. When clicked,
        the configured prompt is sent as a message.
      </p>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No quick actions yet. Add one below.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex items-start gap-2 rounded-md border p-3"
          >
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => index > 0 && swap(index, index - 1)}
                disabled={index === 0}
                className="h-7 w-7 p-0"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  index < fields.length - 1 && swap(index, index + 1)
                }
                disabled={index === fields.length - 1}
                className="h-7 w-7 p-0"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-xs">Button Label</Label>
                <Input
                  placeholder="e.g. Pricing Info"
                  {...register(`quick_actions.${index}.label`)}
                />
                {errors.quick_actions?.[index]?.label && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.quick_actions[index].label?.message}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Prompt</Label>
                <Input
                  placeholder="e.g. What are your pricing plans?"
                  {...register(`quick_actions.${index}.prompt`)}
                />
                {errors.quick_actions?.[index]?.prompt && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.quick_actions[index].prompt?.message}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="h-7 w-7 p-0 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ label: '', prompt: '' })}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Action
        </Button>
        <Button type="submit" disabled={updateChatbot.isPending}>
          {updateChatbot.isPending ? 'Saving...' : 'Save Quick Actions'}
        </Button>
      </div>
    </form>
  )
}

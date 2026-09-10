'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateChatbot } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

const personalitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  personality_prompt: z.string().max(2000, 'Maximum 2000 characters'),
  welcome_message: z.string().min(1, 'Welcome message is required').max(500),
})

type PersonalityFormValues = z.infer<typeof personalitySchema>

interface PersonalityFormProps {
  chatbot: Chatbot
}

export function PersonalityForm({ chatbot }: PersonalityFormProps) {
  const updateChatbot = useUpdateChatbot(chatbot.id)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PersonalityFormValues>({
    resolver: zodResolver(personalitySchema),
    defaultValues: {
      name: chatbot.name,
      personality_prompt: chatbot.personality_prompt || '',
      welcome_message: chatbot.welcome_message || '',
    },
  })

  const promptLength = watch('personality_prompt')?.length || 0

  const onSubmit = (data: PersonalityFormValues) => {
    updateChatbot.mutate(data, {
      onSuccess: () => toast('Personality settings saved'),
      onError: () => toast.error('Failed to save personality settings'),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Chatbot Name</Label>
        <Input id="name" {...register('name')} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="personality_prompt">Personality Prompt</Label>
        <Textarea
          id="personality_prompt"
          rows={6}
          placeholder="You are a friendly customer support agent for..."
          {...register('personality_prompt')}
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Describe how your chatbot should behave, its tone, and any
            specific instructions.
          </span>
          <span className={promptLength > 1800 ? 'text-destructive' : ''}>
            {promptLength}/2000
          </span>
        </div>
        {errors.personality_prompt && (
          <p className="text-sm text-destructive">
            {errors.personality_prompt.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="welcome_message">Welcome Message</Label>
        <Input
          id="welcome_message"
          placeholder="Hello! How can I help you today?"
          {...register('welcome_message')}
        />
        {errors.welcome_message && (
          <p className="text-sm text-destructive">
            {errors.welcome_message.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={updateChatbot.isPending}>
        {updateChatbot.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

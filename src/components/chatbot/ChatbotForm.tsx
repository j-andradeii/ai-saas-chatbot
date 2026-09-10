'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Chatbot } from '@/types'

const chatbotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  domain: z.string().min(1, 'Domain is required').max(255),
})

type ChatbotFormValues = z.infer<typeof chatbotSchema>

interface ChatbotFormProps {
  onSubmit: (data: ChatbotFormValues) => void
  defaultValues?: Partial<Chatbot>
  isLoading?: boolean
}

export function ChatbotForm({
  onSubmit,
  defaultValues,
  isLoading,
}: ChatbotFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChatbotFormValues>({
    resolver: zodResolver(chatbotSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      domain: defaultValues?.domain ?? '',
    },
  })

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>Chatbot Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Chatbot"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              placeholder="example.com"
              {...register('domain')}
            />
            {errors.domain && (
              <p className="text-sm text-destructive">
                {errors.domain.message}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Chatbot'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

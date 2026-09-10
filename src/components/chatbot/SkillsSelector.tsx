'use client'

import { useState } from 'react'
import { useUpdateChatbot } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Chatbot } from '@/types'

const AVAILABLE_SKILLS = [
  {
    id: 'answer_faqs',
    label: 'Answer FAQs',
    description: 'Answer frequently asked questions about your business',
  },
  {
    id: 'book_appointment',
    label: 'Book Appointment',
    description: 'Help visitors schedule appointments or meetings',
  },
  {
    id: 'product_recommendations',
    label: 'Product Recommendations',
    description: 'Suggest relevant products based on visitor needs',
  },
  {
    id: 'technical_support',
    label: 'Technical Support',
    description: 'Provide technical assistance and troubleshooting',
  },
  {
    id: 'order_tracking',
    label: 'Order Tracking',
    description: 'Help visitors check order status and delivery info',
  },
  {
    id: 'general_enquiry',
    label: 'General Enquiry',
    description: 'Handle general questions and route to the right team',
  },
] as const

interface SkillsSelectorProps {
  chatbot: Chatbot
}

export function SkillsSelector({ chatbot }: SkillsSelectorProps) {
  const updateChatbot = useUpdateChatbot(chatbot.id)
  const [selected, setSelected] = useState<string[]>(chatbot.skills || [])

  const handleToggle = (skillId: string) => {
    setSelected((prev) =>
      prev.includes(skillId)
        ? prev.filter((s) => s !== skillId)
        : [...prev, skillId]
    )
  }

  const handleSave = () => {
    updateChatbot.mutate(
      { skills: selected },
      {
        onSuccess: () => toast('Skills updated'),
        onError: () => toast.error('Failed to update skills'),
      }
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the skills your chatbot should have. These are injected into the
        system prompt to guide the AI&apos;s behavior.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {AVAILABLE_SKILLS.map((skill) => (
          <label
            key={skill.id}
            className="flex items-start gap-3 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={selected.includes(skill.id)}
              onCheckedChange={() => handleToggle(skill.id)}
              className="mt-0.5"
            />
            <div>
              <Label className="cursor-pointer font-medium">
                {skill.label}
              </Label>
              <p className="text-sm text-muted-foreground">
                {skill.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <Button
        onClick={handleSave}
        disabled={updateChatbot.isPending}
      >
        {updateChatbot.isPending ? 'Saving...' : 'Save Skills'}
      </Button>
    </div>
  )
}

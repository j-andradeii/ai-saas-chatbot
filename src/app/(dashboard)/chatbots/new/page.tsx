'use client'

import { useRouter } from 'next/navigation'
import { useCreateChatbot } from '@/hooks/useChatbots'
import { ChatbotForm } from '@/components/chatbot/ChatbotForm'
import { toast } from 'sonner'

export default function NewChatbotPage() {
  const router = useRouter()
  const createChatbot = useCreateChatbot()

  const handleSubmit = (data: { name: string; domain: string }) => {
    createChatbot.mutate(data, {
      onSuccess: (chatbot) => {
        toast('Chatbot created')
        router.push(`/chatbots/${chatbot.id}`)
      },
      onError: () => {
        toast.error('Failed to create chatbot')
      },
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Create New Chatbot</h1>
      <ChatbotForm onSubmit={handleSubmit} isLoading={createChatbot.isPending} />
    </div>
  )
}

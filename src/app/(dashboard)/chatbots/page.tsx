'use client'

import Link from 'next/link'
import { useChatbots } from '@/hooks/useChatbots'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Plus } from 'lucide-react'

export default function ChatbotsPage() {
  const { data: chatbots, isLoading, error } = useChatbots()

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chatbots</h1>
        <Button nativeButton={false} render={<Link href="/chatbots/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Chatbot
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading chatbots...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-destructive">
            Failed to load chatbots. Please try again.
          </p>
        </div>
      )}

      {chatbots && chatbots.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">No chatbots yet</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first chatbot to get started.
            </p>
            <Button nativeButton={false} render={<Link href="/chatbots/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              Create Chatbot
            </Button>
          </CardContent>
        </Card>
      )}

      {chatbots && chatbots.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chatbots.map((chatbot) => (
            <Link key={chatbot.id} href={`/chatbots/${chatbot.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    {chatbot.name}
                  </CardTitle>
                  <Badge variant={chatbot.active ? 'default' : 'secondary'}>
                    {chatbot.active ? 'Active' : 'Inactive'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {chatbot.domain}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

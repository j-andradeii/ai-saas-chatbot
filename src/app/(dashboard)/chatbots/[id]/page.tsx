'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useChatbot, useDeleteChatbot } from '@/hooks/useChatbots'
import { EmbedCodeBlock } from '@/components/chatbot/EmbedCodeBlock'
import { ModelSelector } from '@/components/chatbot/ModelSelector'
import { ToolsForm } from '@/components/chatbot/ToolsForm'
import { EnquiryFormBuilder } from '@/components/chatbot/EnquiryFormBuilder'
import { DocumentUpload } from '@/components/knowledge/DocumentUpload'
import { PersonalityForm } from '@/components/chatbot/PersonalityForm'
import { SkillsSelector } from '@/components/chatbot/SkillsSelector'
import { QuickActionsForm } from '@/components/chatbot/QuickActionsForm'
import { WidgetSettings } from '@/components/chatbot/WidgetSettings'
import { ApiConnectionForm } from '@/components/chatbot/ApiConnectionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ChatbotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: chatbot, isLoading, error } = useChatbot(id)
  const deleteChatbot = useDeleteChatbot()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDelete = () => {
    deleteChatbot.mutate(id, {
      onSuccess: () => {
        toast('Chatbot deleted')
        router.push('/chatbots')
      },
      onError: () => {
        toast.error('Failed to delete chatbot')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading chatbot...</p>
      </div>
    )
  }

  if (error || !chatbot) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">
          Failed to load chatbot. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{chatbot.name}</h1>
          <p className="text-muted-foreground">{chatbot.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={chatbot.active ? 'default' : 'secondary'}>
            {chatbot.active ? 'Active' : 'Inactive'}
          </Badge>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger render={<Button variant="destructive" size="sm" />}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Chatbot</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{chatbot.name}&quot;?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteChatbot.isPending}
                >
                  {deleteChatbot.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personality">Personality</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="quick-actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="api-connections">API Connections</TabsTrigger>
          <TabsTrigger value="enquiry-forms">Enquiry Forms</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="widget">Widget</TabsTrigger>
          <TabsTrigger value="embed">Embed Code</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Chatbot Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Name
                  </dt>
                  <dd className="text-sm">{chatbot.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Domain
                  </dt>
                  <dd className="text-sm">{chatbot.domain}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Status
                  </dt>
                  <dd className="text-sm">
                    {chatbot.active ? 'Active' : 'Inactive'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    LLM Provider
                  </dt>
                  <dd className="text-sm">{chatbot.llm_provider || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    LLM Model
                  </dt>
                  <dd className="text-sm">{chatbot.llm_model || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Created
                  </dt>
                  <dd className="text-sm">
                    {new Date(chatbot.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="personality" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Personality & Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonalityForm chatbot={chatbot} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <SkillsSelector chatbot={chatbot} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="model" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Model</CardTitle>
            </CardHeader>
            <CardContent>
              <ModelSelector chatbot={chatbot} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quick-actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickActionsForm chatbot={chatbot} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tools" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <ToolsForm chatbotId={chatbot.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="api-connections" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <ApiConnectionForm chatbotId={chatbot.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="enquiry-forms" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Enquiry Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <EnquiryFormBuilder chatbotId={chatbot.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUpload chatbotId={chatbot.id} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="widget" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Widget Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <WidgetSettings chatbot={chatbot} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="embed" className="mt-4">
          <EmbedCodeBlock chatbotId={chatbot.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

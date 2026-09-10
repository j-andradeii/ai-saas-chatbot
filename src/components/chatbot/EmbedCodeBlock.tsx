'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface EmbedCodeBlockProps {
  chatbotId: string
}

export function EmbedCodeBlock({ chatbotId }: EmbedCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  const embedCode = `<script src="${appUrl}/api/widget/${chatbotId}" defer></script>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast('Embed code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add this script tag to your website to display the chat widget.
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="mr-1 h-4 w-4" />
            ) : (
              <Copy className="mr-1 h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

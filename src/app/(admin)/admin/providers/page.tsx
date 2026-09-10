'use client'

import { useProviders } from '@/hooks/useProviders'
import { ProviderForm } from '@/components/admin/ProviderForm'

export default function AdminProvidersPage() {
  const { data: providers, isLoading, error } = useProviders()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">LLM Providers</h1>
        <p className="text-muted-foreground">
          Manage platform API keys and enable/disable LLM providers.
        </p>
      </div>

      {isLoading && (
        <p className="text-muted-foreground">Loading providers...</p>
      )}

      {error && (
        <p className="text-destructive">Failed to load providers.</p>
      )}

      {providers && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderForm key={provider.id} provider={provider} />
          ))}
        </div>
      )}
    </div>
  )
}

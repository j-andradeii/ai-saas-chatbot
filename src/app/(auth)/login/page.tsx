import { LoginForm } from './login-form'

/**
 * `proxy.ts` sends unauthenticated visitors here as `/login?next=<pathname>`.
 * Resolve that here so the user lands back where they were headed instead of
 * always being dumped on the dashboard.
 */
function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '/dashboard'
  // Same-origin, absolute paths only — "//evil.com" and "/\evil.com" are
  // both browser-valid protocol-relative URLs, so reject them.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/dashboard'
  }
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { next } = await searchParams
  return <LoginForm next={safeNext(next)} />
}

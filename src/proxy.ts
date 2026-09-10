import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/chatbots', '/conversations', '/enquiries', '/api/chatbots', '/api/conversations', '/api/enquiries']
const adminRoutes = ['/admin', '/api/admin']
const authRoutes = ['/login', '/register']
// Public API routes that bypass auth (widget endpoints used by external visitors)
const publicApiRoutes = ['/api/chat/', '/api/widget/', '/api/enquiries/submit']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session by calling getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Skip auth for public API routes (widget chat, widget JS, enquiry submissions)
  const isPublicApi = publicApiRoutes.some((route) => pathname.startsWith(route))
  if (isPublicApi) return supabaseResponse

  // Protect authenticated routes: redirect to login if no user
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route))

  if ((isProtectedRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Admin route guard: check profile role
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Block mutations during impersonation (read-only)
  const impersonateUserId = request.cookies.get('x-impersonate-user-id')?.value
  if (impersonateUserId && !isAdminRoute) {
    const method = request.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      return NextResponse.json(
        { error: 'Impersonation is read-only. Mutations are blocked.' },
        { status: 403 }
      )
    }
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
}

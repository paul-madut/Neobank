# Supabase Client Files

This directory contains TWO Supabase client files - **both are necessary** and serve different purposes.

## `supabase.ts` - Client-Side Client

**Use in:** Client Components (components with `"use client"`)

```tsx
"use client"
import { createClient } from "@/lib/supabase"

export function MyComponent() {
  const supabase = createClient()
  // Use for client-side auth, queries, etc.
}
```

**Purpose:**
- Used in browser/client-side code
- Uses `createBrowserClient` from `@supabase/ssr`
- Handles authentication in the browser
- Used in forms, client interactions, OAuth flows

## `supabase-server.ts` - Server-Side Client

**Use in:** Server Components, API Routes, Server Actions

```tsx
// Server Component (no "use client")
import { createClient } from "@/lib/supabase-server"

export default async function MyServerComponent() {
  const supabase = await createClient()
  // Use for server-side queries, protected routes
}
```

**Purpose:**
- Used in server-side code
- Uses `createServerClient` from `@supabase/ssr`
- Properly handles cookies in server context
- Used in API routes, server components, middleware/proxy

## Why Both Are Needed

Next.js has two rendering environments:
1. **Browser/Client:** User's web browser
2. **Server:** Next.js server

Each environment requires a different Supabase client configuration:
- Client-side client manages auth in the browser
- Server-side client reads/writes cookies on the server

## Quick Reference

| File | Import | Usage |
|------|--------|-------|
| `supabase.ts` | `@/lib/supabase` | Client components, forms, browser interactions |
| `supabase-server.ts` | `@/lib/supabase-server` | Server components, API routes, protected pages |

## Example Usage

### Client Component (Login Form)
```tsx
"use client"
import { createClient } from "@/lib/supabase" // ← Client version

export function LoginForm() {
  const supabase = createClient()

  const handleLogin = async (email: string, password: string) => {
    await supabase.auth.signInWithPassword({ email, password })
  }
}
```

### Server Component (Protected Page)
```tsx
import { createClient } from "@/lib/supabase-server" // ← Server version

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <div>Welcome {user.email}</div>
}
```

## Summary

**DO NOT DELETE EITHER FILE** - both are required for proper Supabase integration in Next.js!

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Database } from "@/lib/supabase/types"
import { classifyRequestPath } from "@/shared/server/routing/route-policy"

type SupabaseResponseCookie = {
  name: string
  value: string
  options: CookieOptions
}

function applySupabaseResponseState(
  response: NextResponse,
  cookies: readonly SupabaseResponseCookie[],
  headers: ReadonlyMap<string, string>,
): NextResponse {
  for (const { name, value, options } of cookies) {
    response.cookies.set(name, value, options)
  }
  for (const [name, value] of headers) {
    response.headers.set(name, value)
  }
  return response
}

function apiError(status: 401 | 404, error: string, code: string): NextResponse {
  return NextResponse.json(
    { error, code },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

export async function proxy(request: NextRequest) {
  const routeClass = classifyRequestPath(request.nextUrl.pathname)

  if (routeClass === "unknown-api") {
    return apiError(404, "No encontrado", "not_found")
  }

  if (routeClass === "public-api" || routeClass === "public-page" || routeClass === "public-auth-route") {
    return NextResponse.next({ request })
  }

  const responseCookies: SupabaseResponseCookie[] = []
  const responseHeaders = new Map<string, string>()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headersToSet = {}) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            responseCookies.push({ name, value, options })
          }
          for (const [name, value] of Object.entries(headersToSet)) {
            responseHeaders.set(name, value)
          }
          supabaseResponse = applySupabaseResponseState(
            NextResponse.next({ request }),
            responseCookies,
            responseHeaders,
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && routeClass === "authenticated-api") {
    return applySupabaseResponseState(
      apiError(401, "No autenticado", "unauthorized"),
      responseCookies,
      responseHeaders,
    )
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return applySupabaseResponseState(
      NextResponse.redirect(url),
      responseCookies,
      responseHeaders,
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk|json)$).*)",
  ],
}

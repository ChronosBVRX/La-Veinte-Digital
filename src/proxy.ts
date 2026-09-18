import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import type { Database } from "@/lib/supabase/types"
import { classifyRequestPath } from "@/shared/server/routing/route-policy"
import { loadAccountAccessState, type AccountAccessState } from "@/shared/server/admin/account-access"

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

  if (
    routeClass === "public-api" ||
    routeClass === "public-page" ||
    routeClass === "public-auth-route" ||
    routeClass === "public-static-asset"
  ) {
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

  // Verificación central de suspensión / papelera. El estado vive en
  // user_admin_status y se lee con la sesión del propio usuario (RLS de fila
  // propia). Si la lectura falla, la disponibilidad no se rompe: el baneo de
  // Supabase Auth y las RPC de escritura siguen siendo la capa fuerte.
  const access = await loadAccountAccessState(supabase, user.id)

  if (access?.blocked) {
    return applySupabaseResponseState(
      blockedResponse(request, routeClass, access),
      responseCookies,
      responseHeaders,
    )
  }

  return supabaseResponse
}

function blockedResponse(
  request: NextRequest,
  routeClass: ReturnType<typeof classifyRequestPath>,
  access: AccountAccessState,
): NextResponse {
  if (routeClass === "authenticated-api") {
    return NextResponse.json(
      { error: access.message, code: access.code },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    )
  }

  // Páginas y Server Actions (POST a la ruta de página) se dirigen al aviso
  // público. En métodos no-GET se usa 303 para convertir a un GET seguro.
  const url = request.nextUrl.clone()
  url.pathname = "/cuenta-suspendida"
  url.search = ""
  return NextResponse.redirect(url, request.method === "GET" ? 307 : 303)
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk|json|pdf|txt|csv|zip|woff|woff2|ttf|otf|eot|ico|xml|wasm|mp3|mp4|webm)$).*)",
  ],
}

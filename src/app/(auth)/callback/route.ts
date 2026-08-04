import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED_INTERNAL_PATHS = [
  "/",
  "/profile",
  "/calculadoras",
  "/asistente",
  "/bitacora",
  "/nomina",
  "/vacaciones",
  "/simulador",
  "/calendario",
  "/tarjeton",
  "/escritos",
  "/catalogo",
]

function isSafeInternalPath(path: string | null): boolean {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false
  }
  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/callback")) {
    return false
  }
  if (path === "/") return true
  return ALLOWED_INTERNAL_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  )
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")
  const oauthError = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  const destination = isSafeInternalPath(next) ? next : "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${destination}`)
    }
    if (error.message?.toLowerCase().includes("verify")) {
      return NextResponse.redirect(`${origin}/login?error=email_not_confirmed`)
    }
  }

  if (oauthError) {
    const reason = errorDescription
      ? encodeURIComponent(`${oauthError}: ${errorDescription}`.slice(0, 200))
      : encodeURIComponent(oauthError)
    return NextResponse.redirect(`${origin}/login?error=${reason}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

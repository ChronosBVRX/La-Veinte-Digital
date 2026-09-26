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
  "/calendario",
  "/tarjeton",
  "/escritos",
  "/guia",
  "/restablecer-password",
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
      if (destination === "/") {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase.rpc("ensure_profile_exists")

            const metaMatricula = typeof user.user_metadata?.matricula === "string" ? user.user_metadata.matricula.trim() : null
            const metaAdscripcion = typeof user.user_metadata?.adscripcion === "string" ? user.user_metadata.adscripcion.trim() : null
            if (metaMatricula || metaAdscripcion) {
              await supabase
                .from("profiles")
                .update({
                  ...(metaMatricula ? { matricula: metaMatricula } : {}),
                  ...(metaAdscripcion ? { adscripcion: metaAdscripcion } : {}),
                })
                .eq("id", user.id)
            }

            const { data: profile } = await supabase
              .from("profiles")
              .select("matricula, adscripcion")
              .eq("id", user.id)
              .maybeSingle()

            const { data: prefs } = await supabase
              .from("worker_preferences")
              .select("onboarding_state")
              .eq("user_id", user.id)
              .maybeSingle()

            const isConfiguredOrBasic = prefs?.onboarding_state === "configured" || prefs?.onboarding_state === "basic"
            const hasWorkerData = Boolean(profile?.matricula?.trim())

            if (!isConfiguredOrBasic && !hasWorkerData) {
              return NextResponse.redirect(`${origin}/profile/mi-informacion-laboral?onboarding=true`)
            }
          }
        } catch (e) {
          console.error("[callback] Error checking onboarding state:", e)
        }
      }

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

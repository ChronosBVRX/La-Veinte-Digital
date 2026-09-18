import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { signOutAction } from "@/app/(auth)/actions"
import { loadAccountAccessState, ACCOUNT_SUSPENDED_MESSAGE, ACCOUNT_TRASHED_MESSAGE } from "@/shared/server/admin/account-access"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Acceso restringido | La Veinte Digital",
  robots: { index: false, follow: false },
}

/**
 * Aviso humano para cuentas suspendidas o enviadas a papelera.
 *
 * Página pública y sin datos internos: nunca revela motivos administrativos,
 * correos de terceros ni información de la bitácora.
 */
export default async function SuspendedAccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let message = "Tu cuenta no tiene acceso a la plataforma en este momento."
  let title = "Acceso restringido"

  if (user) {
    const access = await loadAccountAccessState(supabase, user.id)
    if (access?.code === "account_trashed") {
      title = "Cuenta en proceso de eliminación"
      message = ACCOUNT_TRASHED_MESSAGE
    } else if (access?.code === "account_suspended") {
      title = "Cuenta suspendida"
      message = ACCOUNT_SUSPENDED_MESSAGE
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem 1rem",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "460px" }}>
        <Card padding="1.75rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--primary)",
                }}
              >
                La Veinte Digital
              </p>
              <h1 style={{ margin: "0.375rem 0 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--fg)" }}>
                {title}
              </h1>
            </div>

            <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.55, color: "var(--muted)" }}>
              {message}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.25rem" }}>
              <Link href="/soporte" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="md" fullWidth>
                  Ir a soporte
                </Button>
              </Link>

              {user ? (
                <form action={signOutAction}>
                  <Button type="submit" variant="primary" size="md" fullWidth>
                    Cerrar sesión
                  </Button>
                </form>
              ) : (
                <Link href="/login" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="md" fullWidth>
                    Volver al inicio de sesión
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}

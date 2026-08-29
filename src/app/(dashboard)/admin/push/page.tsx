import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { EnviarNotificacionForm } from "@/features/push/components/EnviarNotificacionForm"

function allowedEmails(): string[] {
  return (process.env.PUSH_ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export default async function AdminPushPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? ""
  const allowed = allowedEmails()

  const isAdmin = allowed.length > 0 && allowed.includes(email.toLowerCase())
  const configured = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Administración"
        title="Enviar notificación"
        description="Envía una notificación push a los dispositivos de La Veinte Digital."
      />

      {!isAdmin ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.25rem" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            No tienes permisos para enviar notificaciones. Configura <code>PUSH_ADMIN_ALLOWED_EMAILS</code> en el
            entorno para habilitar esta sección.
          </p>
        </div>
      ) : (
        <>
          {!configured && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "1rem", color: "#991b1b", fontSize: "0.875rem" }}>
              Firebase Admin no está configurado. Define <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> en el entorno
              para poder enviar.
            </div>
          )}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1.25rem" }}>
            <EnviarNotificacionForm email={email} />
          </div>
        </>
      )}
    </div>
  )
}

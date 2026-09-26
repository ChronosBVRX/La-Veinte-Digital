import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Button } from "@/shared/components/ui/Button"
import { SimplePushAlertForm } from "@/features/push/components/SimplePushAlertForm"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceRoleClient(url, key)
}

export default async function AdminPushPage() {
  const { user, capabilities } = await getAdminCapabilities()

  if (!user || (!capabilities.isAdmin && !capabilities.canAccessLegacyPush)) {
    redirect("/admin")
  }

  const email = user.email ?? ""
  const configured = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  // Obtener dispositivos activos para mostrar cifra real
  let totalActiveDevices = 0
  const supabase = serviceClient()
  if (supabase) {
    const { count } = await supabase
      .from("push_devices")
      .select("*", { count: "exact", head: true })
      .eq("notifications_enabled", true)
    totalActiveDevices = count ?? 0
  }

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Link href="/admin" style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver al Panel de Administración
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="Administración de Alertas"
        title="Enviar Alerta Push a Teléfonos"
        description="Escribe el mensaje, elige el tipo y envía la alerta instantánea a los teléfonos de los agremiados."
      />

      {!configured && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "1rem", color: "#991b1b", fontSize: "0.875rem" }}>
          Firebase FCM no está configurado (falta <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> en el entorno). Las notificaciones no podrán entregarse hasta agregar las credenciales de Firebase Admin.
        </div>
      )}

      <SimplePushAlertForm userEmail={email} totalDevices={totalActiveDevices} />
    </div>
  )
}

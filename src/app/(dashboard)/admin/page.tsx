import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { fetchAdminOperationalMetrics } from "@/features/announcements/services/admin-metrics-service"
import { getAdminUserMetrics } from "@/features/admin-users/services/admin-users-service"
import { AdminDashboardContent } from "@/features/admin/components/AdminDashboardContent"
import { Card } from "@/shared/components/ui/Card"

export default async function AdminHomePage() {
  const { capabilities } = await getAdminCapabilities()

  // Si solo tiene acceso al push heredado, redirigir a su sección
  if (!capabilities.isAdmin && capabilities.canAccessLegacyPush) {
    redirect("/admin/push")
  }

  if (!capabilities.isAdmin) {
    return (
      <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "1.5rem" }}>
        <Card padding="1.5rem">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Acceso restringido</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Se requieren privilegios de administrador general para ver este resumen.
          </p>
        </Card>
      </div>
    )
  }

  const metrics = await fetchAdminOperationalMetrics()

  // Indicadores reales del Centro de Usuarios. Si la lectura falla, la sección
  // muestra guiones (nunca datos simulados) sin romper el resto del panel.
  let userMetrics: Awaited<ReturnType<typeof getAdminUserMetrics>> | null = null
  try {
    userMetrics = await getAdminUserMetrics()
  } catch {
    userMetrics = null
  }

  return <AdminDashboardContent metrics={metrics} userMetrics={userMetrics} />
}

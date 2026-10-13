import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { CajaDashboard } from "@/features/caja/components/CajaDashboard"
import { Card } from "@/shared/components/ui/Card"

import { CajaAdminVisibilityToggle } from "@/features/caja/components/CajaAdminVisibilityToggle"

export default async function AdminCajaPage() {
  const { capabilities } = await getAdminCapabilities()

  if (!capabilities.isAdmin) {
    return (
      <div style={{ width: "100%", maxWidth: "600px", margin: "1.5rem auto", boxSizing: "border-box" }}>
        <Card padding="clamp(1.25rem, 4vw, 1.5rem)">
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Acceso restringido</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Se requieren privilegios de administrador para probar el módulo de Caja de Ahorro.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ width: "100%", maxWidth: "1000px", margin: "0 auto", boxSizing: "border-box", minWidth: 0 }}>
      <CajaAdminVisibilityToggle />
      <CajaDashboard />
    </div>
  )
}

import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { isCajaPubliclyEnabled } from "@/lib/caja/visibility"
import { CajaDashboard } from "@/features/caja/components/CajaDashboard"
import { Card } from "@/shared/components/ui/Card"
import { ShieldWarning } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/shared/components/ui/Button"

export default async function CajaPage() {
  const [{ capabilities }, isPublic] = await Promise.all([
    getAdminCapabilities(),
    isCajaPubliclyEnabled(),
  ])

  // Si no es admin y la caja no está abierta al público, mostrar aviso de prueba
  if (!capabilities.isAdmin && !isPublic) {
    return (
      <div style={{ maxWidth: "560px", margin: "3rem auto", padding: "1.5rem" }}>
        <Card padding="2rem">
          <div style={{ textAlign: "center" }}>
            <ShieldWarning size={48} color="var(--primary)" weight="duotone" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--fg)" }}>
              Módulo en Fase de Pruebas
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
              El apartado de <strong>Caja de Ahorro SNTSS</strong> se encuentra actualmente en fase de integración y prueba exclusiva para administradores de La Veinte Digital. Muy pronto estará disponible para todos los compañeros sindicalizados.
            </p>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button variant="outline" size="md">
                Volver al inicio
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "1.5rem auto", padding: "0 1rem" }}>
      <CajaDashboard />
    </div>
  )
}

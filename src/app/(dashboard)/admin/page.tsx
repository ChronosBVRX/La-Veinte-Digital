import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  Megaphone,
  PlusCircle,
  DeviceMobile,
  CalendarCheck,
  AndroidLogo,
  Bell,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr"

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

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración"
          title="Panel de control"
          description="Gestión editorial, avisos, campañas push y herramientas operativas."
        />
        <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md">
            <PlusCircle size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            Crear aviso
          </Button>
        </Link>
      </div>

      {/* Sección principal: Avisos y Campañas */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Comunicación Editorial
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "var(--accent)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <Megaphone size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Avisos y Comunicados</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Crear, programar, publicar avisos en bandeja y despachar notificaciones push a Android.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <Link href="/admin/avisos" style={{ textDecoration: "none", flex: 1 }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Ver avisos
                </Button>
              </Link>
              <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="sm">
                  Nuevo
                </Button>
              </Link>
            </div>
          </Card>

          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "var(--accent)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <DeviceMobile size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Barra Informativa Móvil</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Administrar mensajes cortos, tips y herramientas que rotan en la barra inferior móvil.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/admin/barra" style={{ textDecoration: "none", display: "block" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Gestionar barra
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Sección secundaria: Herramientas operativas del sistema */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Herramientas Operativas Existentes
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <Bell size={20} weight="duotone" color="var(--primary)" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Notificación push directa</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Formulario de envío directo a dispositivos registrados o por correo autorizado.
            </p>
            <Link href="/admin/push" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Abrir formulario push
              </Button>
            </Link>
          </Card>

          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <CalendarCheck size={20} weight="duotone" color="#059669" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Administración Vacaciones</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Control de calendario vacacional, periodos programados y reglas de rol.
            </p>
            <Link href="/vacaciones/admin" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Abrir panel vacaciones
              </Button>
            </Link>
          </Card>

          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <AndroidLogo size={20} weight="duotone" color="#16a34a" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Releases Android</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Historial de builds APK (stable, beta, dev) y manifiestos de actualización.
            </p>
            <Link href="/admin/android" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Ver releases Android
              </Button>
            </Link>
          </Card>

          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <SlidersHorizontal size={20} weight="duotone" color="#6366f1" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Vista de Trabajadores</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Inspeccionar cómo los trabajadores ven la bandeja de comunicados institucional.
            </p>
            <Link href="/avisos" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Ver bandeja de avisos
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

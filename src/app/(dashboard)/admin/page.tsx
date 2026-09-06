import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { fetchAdminOperationalMetrics } from "@/features/announcements/services/admin-metrics-service"
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
  PaperPlaneTilt,
  Clock,
  CheckCircle,
  WarningCircle,
  Broadcast,
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

  const metrics = await fetchAdminOperationalMetrics()

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración General"
          title="Panel de Operaciones"
          description="Monitoreo en tiempo real, gestión editorial institucional y herramientas de plataforma."
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="md">
              <PlusCircle size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Crear aviso
            </Button>
          </Link>
          <Link href="/admin/campanas/nueva" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="md">
              <PaperPlaneTilt size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Despachar push
            </Button>
          </Link>
        </div>
      </div>

      {/* Métricas operativas agregadas (Sin exposición de PII) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {/* Avisos */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Avisos Totales</span>
            <Megaphone size={20} weight="duotone" color="var(--primary)" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
            {metrics.announcements.total}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            <span style={{ color: "#059669", fontWeight: 600 }}>{metrics.announcements.published} pub</span>
            <span>·</span>
            <span>{metrics.announcements.draft} borr</span>
            <span>·</span>
            <span>{metrics.announcements.inBar} en barra</span>
          </div>
        </Card>

        {/* Dispositivos Android */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Dispositivos Push</span>
            <AndroidLogo size={20} weight="duotone" color="#16a34a" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
            {metrics.push.totalDevices}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            Tokens FCM registrados activos
          </div>
        </Card>

        {/* Última campaña push */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Última Campaña Push</span>
            <Broadcast size={20} weight="duotone" color="var(--primary)" />
          </div>
          {metrics.push.lastCampaign ? (
            <div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {metrics.push.lastCampaign.title}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.375rem", fontSize: "0.75rem" }}>
                <span
                  style={{
                    padding: "0.1rem 0.375rem",
                    borderRadius: "0.25rem",
                    fontWeight: 700,
                    fontSize: "0.6875rem",
                    background: metrics.push.lastCampaign.status === "COMPLETED" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)",
                    color: metrics.push.lastCampaign.status === "COMPLETED" ? "#059669" : "#2563eb",
                  }}
                >
                  {metrics.push.lastCampaign.status}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {metrics.push.lastCampaign.acceptedCount} entregados
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Sin campañas despachadas
            </div>
          )}
        </Card>

        {/* Cron Heartbeat */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Cron Automático</span>
            <Clock size={20} weight="duotone" color={metrics.cron.lastStatus === "COMPLETED" ? "#059669" : "var(--muted)"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {metrics.cron.lastStatus === "COMPLETED" ? (
              <CheckCircle size={16} weight="bold" color="#059669" />
            ) : (
              <WarningCircle size={16} weight="bold" color="#d97706" />
            )}
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              {metrics.cron.lastStatus || "Sin ejecuciones"}
            </span>
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            {metrics.cron.lastRunAt
              ? `Último latido: ${new Date(metrics.cron.lastRunAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
              : "GitHub Actions / Vercel Cron (15 min)"}
          </div>
        </Card>
      </div>

      {/* Sección principal: Comunicación Editorial */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Gestión Editorial Institucional
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* Card Avisos */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "var(--accent)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <Megaphone size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Avisos y Comunicados</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Crear, programar, publicar avisos en bandeja institucional y preparar notificaciones.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <Link href="/admin/avisos" style={{ textDecoration: "none", flex: 1 }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Ver avisos ({metrics.announcements.total})
                </Button>
              </Link>
              <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="sm">
                  Nuevo
                </Button>
              </Link>
            </div>
          </Card>

          {/* Card Barra Móvil */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "var(--accent)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <DeviceMobile size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Barra Informativa Móvil</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Monitorear mensajes cortos, tips verificados y herramientas que rotan en teléfonos móviles.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/admin/barra" style={{ textDecoration: "none", display: "block" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Gestionar barra ({metrics.announcements.inBar} configurados)
                </Button>
              </Link>
            </div>
          </Card>

          {/* Card Campañas Push */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "var(--accent)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <PaperPlaneTilt size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Campañas Push Android</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Despachar notificaciones masivas o de prueba (SELF) con seguimiento transaccional.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/admin/campanas/nueva" style={{ textDecoration: "none", display: "block" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Despachar nueva campaña
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Sección secundaria: Herramientas operativas del sistema */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Herramientas Operativas de Plataforma
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <Bell size={20} weight="duotone" color="var(--primary)" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Push Directo (Legado)</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Formulario de prueba directa a tokens FCM individuales o autorizados por correo.
            </p>
            <Link href="/admin/push" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Abrir push directo
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
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Bandeja de Trabajadores</h3>
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

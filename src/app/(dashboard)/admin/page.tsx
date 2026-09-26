import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { fetchAdminOperationalMetrics } from "@/features/announcements/services/admin-metrics-service"
import { getAdminUserMetrics } from "@/features/admin-users/services/admin-users-service"
import { AdminUserMetricsSection } from "@/features/admin-users/components/AdminUserMetricsSection"
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
  FileText,
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

  // Indicadores reales del Centro de Usuarios. Si la lectura falla, la sección
  // muestra guiones (nunca datos simulados) sin romper el resto del panel.
  let userMetrics: Awaited<ReturnType<typeof getAdminUserMetrics>> | null = null
  try {
    userMetrics = await getAdminUserMetrics()
  } catch {
    userMetrics = null
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Cabecera y acciones rápidas */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración General"
          title="Panel de Operaciones"
          description="Centro de control institucional de La Veinte Digital: alertas a teléfonos, avisos oficiales y usuarios."
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/admin/push" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="md">
              <Bell size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Enviar Alerta Push
            </Button>
          </Link>
          <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="md">
              <PlusCircle size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Crear aviso
            </Button>
          </Link>
        </div>
      </div>

      {/* Banner de acceso rápido a Alerta Push */}
      <Card
        padding="1.25rem"
        style={{
          border: "1px solid rgba(37, 99, 235, 0.25)",
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.01) 100%)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.875rem", alignItems: "center", minWidth: "260px", flex: 1 }}>
            <div
              style={{
                background: "var(--primary)",
                color: "#ffffff",
                padding: "0.625rem",
                borderRadius: "0.625rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PaperPlaneTilt size={26} weight="fill" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                  Envío Rápido de Alertas Push
                </h3>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.4rem",
                    borderRadius: "0.25rem",
                    background: "rgba(37, 99, 235, 0.12)",
                    color: "var(--primary)",
                  }}
                >
                  FÁCIL Y RÁPIDO
                </span>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Escribe tu mensaje, elige el tipo y envíalo en un clic a los <strong>{metrics.push.totalDevices} teléfonos activos</strong>.
              </p>
            </div>
          </div>
          <Link href="/admin/push" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="md">
              <Bell size={18} weight="bold" style={{ marginRight: "0.375rem" }} />
              Escribir y Enviar Alerta
            </Button>
          </Link>
        </div>
      </Card>

      {/* Métricas operativas agregadas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {/* Teléfonos Android */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Teléfonos Conectados</span>
            <AndroidLogo size={20} weight="duotone" color="#16a34a" />
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
            {metrics.push.totalDevices}
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            Dispositivos listos para recibir alertas push
          </div>
        </Card>

        {/* Avisos */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Avisos Institucionales</span>
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

        {/* Última campaña push */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Última Notificación</span>
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
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>Sincronización Automática</span>
            <Clock size={20} weight="duotone" color={metrics.cron.lastStatus === "COMPLETED" ? "#059669" : "var(--muted)"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {metrics.cron.lastStatus === "COMPLETED" ? (
              <CheckCircle size={16} weight="bold" color="#059669" />
            ) : (
              <WarningCircle size={16} weight="bold" color="#d97706" />
            )}
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              {metrics.cron.lastStatus === "COMPLETED" ? "Operativo" : (metrics.cron.lastStatus || "Sin ejecuciones")}
            </span>
          </div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
            {metrics.cron.lastRunAt
              ? `Último latido: ${new Date(metrics.cron.lastRunAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
              : "Verificación activa cada 15 min"}
          </div>
        </Card>
      </div>

      {/* Centro de Administración de Usuarios */}
      <AdminUserMetricsSection metrics={userMetrics} />

      {/* Módulos: Comunicación y Difusión */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Comunicación y Alertas a la Base
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* Card Alertas Push */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <Bell size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Alertas Push Inmediatas</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Envía alertas directas a los teléfonos: escribe tu mensaje, elige el tipo y despacha al instante.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/admin/push" style={{ textDecoration: "none", display: "block" }}>
                <Button variant="primary" size="sm" style={{ width: "100%" }}>
                  <PaperPlaneTilt size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                  Enviar Alerta Push
                </Button>
              </Link>
            </div>
          </Card>

          {/* Card Avisos */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "#059669", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <Megaphone size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Avisos y Comunicados</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Crear, programar y publicar noticias institucionales completas en la bandeja pública.
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
              <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "#d97706", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <DeviceMobile size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Barra Informativa Móvil</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Monitorear los mensajes cortos, tips verificados y avisos que rotan en la app de los trabajadores.
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

          {/* Card Vista Trabajador */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div style={{ background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <SlidersHorizontal size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Bandeja de Trabajadores</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Inspeccionar en vivo cómo los compañeros visualizan las noticias y comunicados en el portal.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/avisos" style={{ textDecoration: "none", display: "block" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Ver como trabajador
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Módulos: Gestión Institucional y Sistema */}
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Gestión Laboral y Plataforma
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
          {/* Card Vacaciones */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <CalendarCheck size={20} weight="duotone" color="#059669" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Administración Vacaciones</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Control del calendario vacacional, periodos programados y reglas de rol institucional.
            </p>
            <Link href="/vacaciones/admin" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Abrir panel vacaciones
              </Button>
            </Link>
          </Card>

          {/* Card Releases Android */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <AndroidLogo size={20} weight="duotone" color="#16a34a" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Releases Android</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Historial de compilaciones APK (stable, beta, dev) y manifiestos de actualización para móviles.
            </p>
            <Link href="/admin/android" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Ver releases Android
              </Button>
            </Link>
          </Card>

          {/* Card Auditoría */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <FileText size={20} weight="duotone" color="var(--primary)" />
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>Auditoría de Acciones</h3>
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
              Registro cronológico de cambios de roles, publicaciones y despachos realizados por administradores.
            </p>
            <Link href="/admin/usuarios/auditoria" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                Ver registro de auditoría
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

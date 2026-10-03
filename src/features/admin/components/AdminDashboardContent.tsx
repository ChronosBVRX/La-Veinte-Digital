"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bell,
  PlusCircle,
  Users,
  PaperPlaneTilt,
  Megaphone,
  DeviceMobile,
  MagnifyingGlass,
  SlidersHorizontal,
  CalendarCheck,
  AndroidLogo,
  FileText,
  Clock,
  CheckCircle,
  WarningCircle,
  Broadcast,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { AdminUserMetricsSection } from "@/features/admin-users/components/AdminUserMetricsSection"
import type { AdminOperationalMetrics } from "@/features/announcements/services/admin-metrics-service"
import type { AdminUserMetrics } from "@/shared/contracts/admin-users"

export interface AdminDashboardContentProps {
  metrics: AdminOperationalMetrics
  userMetrics: AdminUserMetrics | null
}

type TabKey = "difusion" | "usuarios" | "plataforma" | "auditoria"

export function AdminDashboardContent({ metrics, userMetrics }: AdminDashboardContentProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("difusion")

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "1.25rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Cabecera y acciones prioritarias inmediatas */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <PageHeader
          eyebrow="Administración Institucional"
          title="Panel de Plataforma"
          description="Consola de control de La Veinte Digital: difusión masiva, cuentas y estado técnico."
        />
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/admin/push" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="md">
              <Bell size={18} weight="bold" style={{ marginRight: "0.375rem" }} />
              Enviar Alerta Push
            </Button>
          </Link>
          <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="md">
              <PlusCircle size={18} weight="bold" style={{ marginRight: "0.375rem" }} />
              Crear aviso
            </Button>
          </Link>
          <Link href="/admin/usuarios" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="md">
              <Users size={18} weight="bold" style={{ marginRight: "0.375rem" }} />
              Usuarios
            </Button>
          </Link>
        </div>
      </div>

      {/* Franja compacta de estado operativo en vivo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {/* Teléfonos Conectados */}
        <Card padding="0.875rem 1rem">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
              Teléfonos Conectados
            </span>
            <AndroidLogo size={18} weight="duotone" color="#16a34a" />
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
            {metrics.push.totalDevices}
          </div>
          <div style={{ fontSize: "0.6875rem", color: "#16a34a", fontWeight: 600, marginTop: "0.25rem" }}>
            Listos para recibir alertas push
          </div>
        </Card>

        {/* Avisos */}
        <Card padding="0.875rem 1rem">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
              Avisos Institucionales
            </span>
            <Megaphone size={18} weight="duotone" color="var(--primary)" />
          </div>
          <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
            {metrics.announcements.published}{" "}
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--muted)" }}>publicados</span>
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            {metrics.announcements.inBar} en barra · {metrics.announcements.draft} borradores
          </div>
        </Card>

        {/* Última Campaña */}
        <Card padding="0.875rem 1rem">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
              Último Despacho
            </span>
            <Broadcast size={18} weight="duotone" color="var(--primary)" />
          </div>
          {metrics.push.lastCampaign ? (
            <>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {metrics.push.lastCampaign.title}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                <strong style={{ color: "#059669" }}>{metrics.push.lastCampaign.acceptedCount}</strong> entregados ·{" "}
                {metrics.push.lastCampaign.status}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--muted)" }}>Sin campañas</div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Ningún despacho reciente
              </div>
            </>
          )}
        </Card>

        {/* Sincronización Automática */}
        <Card padding="0.875rem 1rem">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>Servicio & Cron</span>
            <Clock
              size={18}
              weight="duotone"
              color={metrics.cron.lastStatus === "COMPLETED" ? "#059669" : "var(--muted)"}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            {metrics.cron.lastStatus === "COMPLETED" ? (
              <CheckCircle size={15} weight="bold" color="#059669" />
            ) : (
              <WarningCircle size={15} weight="bold" color="#d97706" />
            )}
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              {metrics.cron.lastStatus === "COMPLETED" ? "Operativo" : metrics.cron.lastStatus || "Sin ejecuciones"}
            </span>
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            {metrics.cron.lastRunAt
              ? `Último latido: ${new Date(metrics.cron.lastRunAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
              : "Verificación cada 15 min"}
          </div>
        </Card>
      </div>

      {/* Pestañas de control temático para navegación móvil sin scroll infinito */}
      <div
        role="tablist"
        aria-label="Pestañas de gestión administrativa"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {[
          { id: "difusion" as const, label: "Difusión & Alertas", icon: Bell },
          { id: "usuarios" as const, label: "Usuarios & Cuentas", icon: Users },
          { id: "plataforma" as const, label: "Plataforma & Sistema", icon: DeviceMobile },
          { id: "auditoria" as const, label: "Auditoría & Bitácora", icon: FileText },
        ].map((tab) => {
          const isSelected = activeTab === tab.id
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "var(--radius, 0.375rem)",
                fontSize: "0.875rem",
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? "var(--primary)" : "var(--muted)",
                background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                border: "none",
                borderBottom: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={18} weight={isSelected ? "bold" : "regular"} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Contenido según la pestaña activa */}

      {/* PESTAÑA 1: DIFUSIÓN & ALERTAS */}
      {activeTab === "difusion" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Card Alertas Push */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    background: "rgba(37, 99, 235, 0.1)",
                    color: "var(--primary)",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                  }}
                >
                  <PaperPlaneTilt size={24} weight="duotone" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Alertas Push Inmediatas
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                    Envía avisos directos a los <strong>{metrics.push.totalDevices} teléfonos activos</strong> al instante.
                  </p>
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Link href="/admin/push" style={{ textDecoration: "none", display: "block" }}>
                  <Button variant="primary" size="sm" style={{ width: "100%" }}>
                    <PaperPlaneTilt size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                    Escribir y Enviar Alerta
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Card Avisos */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "#059669",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                  }}
                >
                  <Megaphone size={24} weight="duotone" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Avisos y Comunicados
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                    Publica noticias institucionales en la bandeja pública ({metrics.announcements.published} publicados de {metrics.announcements.total}).
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
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#d97706",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                  }}
                >
                  <DeviceMobile size={24} weight="duotone" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Barra Informativa Móvil
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                    Monitorea los mensajes cortos y tips que rotan en la app ({metrics.announcements.inBar} activos en barra).
                  </p>
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Link href="/admin/barra" style={{ textDecoration: "none", display: "block" }}>
                  <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                    Gestionar barra ({metrics.announcements.inBar})
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Card Radar & Calendario Laboral */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    background: "rgba(168, 85, 247, 0.1)",
                    color: "#9333ea",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                  }}
                >
                  <MagnifyingGlass size={24} weight="duotone" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Radar & Alertas de Calendario
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                    Monitoreo de temas gremiales y control de notificaciones de pago por banco y fechas clave.
                  </p>
                </div>
              </div>
              <div style={{ marginTop: "1rem" }}>
                <Link href="/admin/radar" style={{ textDecoration: "none", display: "block" }}>
                  <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                    <CalendarCheck size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                    Abrir Radar & Calendario
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Card Vista Trabajador */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.1)",
                    color: "#6366f1",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                  }}
                >
                  <SlidersHorizontal size={24} weight="duotone" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    Bandeja de Trabajadores
                  </h3>
                  <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                    Inspeccionar en vivo cómo los compañeros visualizan las noticias y comunicados.
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
      )}

      {/* PESTAÑA 2: USUARIOS & CUENTAS */}
      {activeTab === "usuarios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card padding="1.25rem">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.25rem", color: "var(--fg)" }}>
                  Centro de Administración de Usuarios
                </h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0 }}>
                  Búsqueda por matrícula, nombre o correo, asignación de roles, suspensión y papelera recuperable.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link href="/admin/usuarios" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="md">
                    <Users size={18} weight="bold" style={{ marginRight: "0.375rem" }} />
                    Abrir Centro de Usuarios
                  </Button>
                </Link>
                <Link href="/admin/usuarios/auditoria" style={{ textDecoration: "none" }}>
                  <Button variant="secondary" size="md">
                    Ver bitácora
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Métricas de usuarios reales */}
          <AdminUserMetricsSection metrics={userMetrics} />
        </div>
      )}

      {/* PESTAÑA 3: PLATAFORMA & SISTEMA */}
      {activeTab === "plataforma" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Card Releases Android */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <AndroidLogo size={22} weight="duotone" color="#16a34a" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Releases Android APK</h3>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
                Historial de compilaciones APK (canales stable, beta y dev) y verificación de actualizaciones móviles.
              </p>
              <Link href="/admin/android" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Ver releases Android
                  <ArrowRight size={14} weight="bold" style={{ marginLeft: "0.375rem" }} />
                </Button>
              </Link>
            </Card>

            {/* Card Vacaciones */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <CalendarCheck size={22} weight="duotone" color="#059669" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Administración de Vacaciones</h3>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 1rem", lineHeight: 1.4 }}>
                Reglas del calendario vacacional de la plataforma, roles de descanso y periodos institucionales.
              </p>
              <Link href="/vacaciones/admin" style={{ textDecoration: "none" }}>
                <Button variant="secondary" size="sm" style={{ width: "100%" }}>
                  Abrir panel vacaciones
                  <ArrowRight size={14} weight="bold" style={{ marginLeft: "0.375rem" }} />
                </Button>
              </Link>
            </Card>

            {/* Card Sincronización Automática */}
            <Card padding="1.25rem">
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <Clock size={22} weight="duotone" color="#2563eb" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Servicio Cron & FCM</h3>
              </div>
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 0.5rem", lineHeight: 1.4 }}>
                Ejecuciones del motor de alertas automáticas y recordatorios programados.
              </p>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Último estado: <strong>{metrics.cron.lastStatus || "Sin ejecuciones"}</strong>
                {metrics.cron.lastRunAt && (
                  <span> · {new Date(metrics.cron.lastRunAt).toLocaleString("es-MX")}</span>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* PESTAÑA 4: AUDITORÍA & BITÁCORA */}
      {activeTab === "auditoria" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div
                style={{
                  background: "rgba(37, 99, 235, 0.1)",
                  color: "var(--primary)",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  display: "flex",
                }}
              >
                <FileText size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                  Registro de Auditoría de Acciones
                </h3>
                <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, lineHeight: 1.4 }}>
                  Trazabilidad cronológica de cambios de roles, suspensiones de cuentas, publicaciones y despachos masivos.
                </p>
              </div>
            </div>
            <div style={{ marginTop: "1rem" }}>
              <Link href="/admin/usuarios/auditoria" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="sm">
                  <Clock size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                  Ver bitácora completa de auditoría
                </Button>
              </Link>
            </div>
          </Card>

          <Card padding="1.25rem" style={{ borderLeft: "4px solid var(--primary)" }}>
            <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", marginBottom: "0.375rem" }}>
              <ShieldCheck size={20} weight="bold" color="var(--primary)" />
              <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700 }}>
                Gobernanza y Privacidad de la Plataforma
              </h4>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5 }}>
              Las operaciones en el panel administrativo de La Veinte Digital operan exclusivamente sobre metadatos técnicos,
              roles de acceso institucional y estados de cuenta. Ningún administrador tiene acceso a contraseñas, tarjetones
              privados ni documentación laboral confidencial de los usuarios.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}

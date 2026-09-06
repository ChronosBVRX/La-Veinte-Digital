import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { listAdminAnnouncements } from "@/features/announcements/services/announcements-service"
import {
  isAnnouncementEligibleForBar,
  requiresNormativaReview,
  announcementToMobileValueItem,
} from "@/features/announcements/services/mobile-bar-service"
import { MOBILE_VALUE_ITEMS } from "@/shared/components/app/mobileValueItems"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  PlusCircle,
  DeviceMobile,
  CheckCircle,
  WarningCircle,
  BookOpen,
  ArrowSquareOut,
  Compass,
  Lightbulb,
} from "@phosphor-icons/react/dist/ssr"

export default async function AdminBarraPage() {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.canManageAnnouncements) {
    redirect("/admin")
  }

  const { items } = await listAdminAnnouncements({ status: "ALL", limit: 100 })
  const barAnnouncements = items.filter((item) => item.show_in_bar)

  const activeDynamicItems = barAnnouncements.filter((item) => isAnnouncementEligibleForBar(item))
  const pendingOrInactiveItems = barAnnouncements.filter((item) => !isAnnouncementEligibleForBar(item))

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración"
          title="Barra Informativa Móvil"
          description="Monitoreo y administración de consejos, herramientas y avisos en la barra fija inferior para dispositivos móviles."
        />
        <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md">
            <PlusCircle size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            Crear consejo o herramienta
          </Button>
        </Link>
      </div>

      {/* Previsualizador de la barra */}
      <Card padding="1.25rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <DeviceMobile size={22} weight="duotone" color="var(--primary)" />
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Previsualización en Pantalla Móvil
          </h3>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1rem" }}>
          Así visualizan los trabajadores los mensajes en sus teléfonos (rotación cada 25 segundos, con botón de cierre por sesión).
        </p>

        {activeDynamicItems.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {activeDynamicItems.slice(0, 3).map((item) => {
              const valItem = announcementToMobileValueItem(item)
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    background: "var(--accent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "var(--card)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {valItem.type === "tool" ? <Compass size={18} weight="duotone" /> : <Lightbulb size={18} weight="duotone" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", display: "block" }}>
                      {valItem.eyebrow} · Publicado dinámico
                    </span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--fg)", fontWeight: 500 }}>
                      {valItem.text}
                    </span>
                  </div>
                  {valItem.href && (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                      {valItem.href}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "var(--accent)",
              border: "1px dashed var(--border)",
              color: "var(--muted)",
              fontSize: "0.875rem",
            }}
          >
            No hay avisos dinámicos activos en este momento. La barra está mostrando el <strong>catálogo local estático</strong> ({MOBILE_VALUE_ITEMS.length} herramientas y consejos base).
          </div>
        )}
      </Card>

      {/* Consejos dinámicos configurados */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)", margin: 0 }}>
          Avisos con difusión en Barra ({barAnnouncements.length})
        </h3>

        {barAnnouncements.length === 0 ? (
          <Card padding="2rem">
            <div style={{ textAlign: "center", color: "var(--muted)" }}>
              <p style={{ margin: "0 0 1rem", fontSize: "0.9375rem" }}>
                Aún no has configurado ningún aviso con la opción &ldquo;Mostrar en la barra inferior&rdquo;.
              </p>
              <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="md">
                  Crear primer aviso para la barra
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {barAnnouncements.map((item) => {
              const eligible = isAnnouncementEligibleForBar(item)
              const needsReview = requiresNormativaReview(item)
              return (
                <Card key={item.id} padding="1rem">
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "0.25rem",
                            background: eligible ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                            color: eligible ? "#059669" : "#d97706",
                          }}
                        >
                          {eligible ? "Al aire en barra" : item.status}
                        </span>

                        {needsReview && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#dc2626",
                              background: "rgba(220, 38, 38, 0.08)",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            <WarningCircle size={14} weight="bold" />
                            Requiere revisión editorial de normativa
                          </span>
                        )}

                        {item.reviewed_at && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#059669",
                            }}
                          >
                            <CheckCircle size={14} weight="bold" />
                            Revisión editorial verificada
                          </span>
                        )}
                      </div>

                      <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--fg)" }}>
                        {item.bar_text || item.title}
                      </div>

                      {item.source_document && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "0.375rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                          <BookOpen size={14} />
                          <span>
                            {item.source_document} {item.source_reference ? `· ${item.source_reference}` : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Link href={`/admin/avisos/${item.id}`} style={{ textDecoration: "none" }}>
                        <Button variant="secondary" size="sm">
                          Editar / Revisar
                          <ArrowSquareOut size={14} style={{ marginLeft: "0.375rem" }} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Catálogo local estático de fallback */}
      <Card padding="1.25rem">
        <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.5rem", color: "var(--fg)" }}>
          Catálogo Base Local (Fallback de Alta Resiliencia)
        </h4>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
          Estos {MOBILE_VALUE_ITEMS.length} mensajes están compilados en la aplicación para asegurar que el trabajador nunca vea una barra vacía ni sufra demoras por problemas de conectividad o de base de datos.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
          {MOBILE_VALUE_ITEMS.map((loc) => (
            <div
              key={loc.id}
              style={{
                padding: "0.625rem 0.875rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                <span style={{ fontWeight: 700, fontSize: "0.6875rem", color: "var(--primary)", textTransform: "uppercase" }}>
                  {loc.eyebrow || loc.type}
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.6875rem" }}>
                  {loc.href}
                </span>
              </div>
              <div style={{ color: "var(--fg)", fontWeight: 500 }}>
                {loc.text}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

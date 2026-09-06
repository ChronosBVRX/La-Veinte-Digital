import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { listAdminAnnouncements } from "@/features/announcements/services/announcements-service"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { PlusCircle, Megaphone, CaretRight, CheckCircle, Clock, Archive } from "@phosphor-icons/react/dist/ssr"

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminAvisosPage({ searchParams }: PageProps) {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.canManageAnnouncements) {
    redirect("/admin")
  }

  const { status = "ALL" } = await searchParams
  const { items, total } = await listAdminAnnouncements({ status })

  const tabs = [
    { label: "Todos", value: "ALL" },
    { label: "Borradores", value: "DRAFT" },
    { label: "Programados", value: "SCHEDULED" },
    { label: "Publicados", value: "PUBLISHED" },
    { label: "Archivados", value: "ARCHIVED" },
  ]

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración"
          title="Avisos y Comunicados"
          description="Gestión editorial de comunicados, tips para la barra y notificaciones push."
        />
        <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md">
            <PlusCircle size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
            Crear aviso
          </Button>
        </Link>
      </div>

      {/* Tabs de filtro */}
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
        {tabs.map((tab) => {
          const isActive = status === tab.value
          return (
            <Link
              key={tab.value}
              href={tab.value === "ALL" ? "/admin/avisos" : `/admin/avisos?status=${tab.value}`}
              style={{
                textDecoration: "none",
                padding: "0.5rem 0.875rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 500,
                background: isActive ? "var(--primary)" : "var(--card)",
                color: isActive ? "#ffffff" : "var(--fg)",
                border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Lista de avisos */}
      {items.length === 0 ? (
        <Card padding="2rem" style={{ textAlign: "center" }}>
          <Megaphone size={32} weight="duotone" color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.25rem" }}>No hay avisos en esta sección</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 1rem" }}>
            Crea un nuevo comunicado o cambia el filtro de búsqueda.
          </p>
          <Link href="/admin/avisos/nuevo" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm">
              Crear el primer aviso
            </Button>
          </Link>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => {
            const isDraft = item.status === "DRAFT"
            const isPublished = item.status === "PUBLISHED"
            const isScheduled = item.status === "SCHEDULED"
            const isArchived = item.status === "ARCHIVED"

            const statusColor = isPublished ? "#059669" : isScheduled ? "#0284c7" : isDraft ? "#d97706" : "#64748b"
            const statusLabel = isPublished ? "Publicado" : isScheduled ? "Programado" : isDraft ? "Borrador" : "Archivado"

            return (
              <Card key={item.id} padding="1.25rem">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "0.25rem",
                          background: `${statusColor}15`,
                          color: statusColor,
                          border: `1px solid ${statusColor}40`,
                          textTransform: "uppercase",
                        }}
                      >
                        {statusLabel}
                      </span>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                        {item.kind} · Rev #{item.revision}
                      </span>
                      {item.show_in_bar && (
                        <span style={{ fontSize: "0.6875rem", color: "var(--primary)", background: "var(--accent)", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>
                          Barra móvil
                        </span>
                      )}
                      {item.show_in_inbox && (
                        <span style={{ fontSize: "0.6875rem", color: "#475569", background: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>
                          Bandeja
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.375rem", color: "var(--fg)" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.5rem", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.push_summary || item.body}
                    </p>

                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Creado: {new Date(item.created_at).toLocaleDateString("es-MX")}
                      {item.publish_at && ` · Publicado/Programado: ${new Date(item.publish_at).toLocaleDateString("es-MX")}`}
                      {item.expires_at && ` · Vence: ${new Date(item.expires_at).toLocaleDateString("es-MX")}`}
                    </span>
                  </div>

                  <Link href={`/admin/avisos/${item.id}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                    <Button variant="secondary" size="sm">
                      {isDraft ? "Editar" : "Detalle"}
                      <CaretRight size={14} weight="bold" style={{ marginLeft: "0.25rem" }} />
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8125rem", marginTop: "1rem" }}>
        Total de avisos registrados: {total}
      </div>
    </div>
  )
}

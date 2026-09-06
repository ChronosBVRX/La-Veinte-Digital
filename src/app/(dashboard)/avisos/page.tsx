import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getWorkerInbox } from "@/features/announcements/services/announcements-inbox"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Bell, CaretRight, Check, SlidersHorizontal, Megaphone } from "@phosphor-icons/react/dist/ssr"

export default async function WorkerAvisosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { items, unreadCount } = await getWorkerInbox(user.id)

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Comunicación oficial"
          title="Avisos y Novedades"
          description="Información institucional, convocatorias y actualizaciones para el personal del IMSS."
        />
        <Link href="/avisos/preferencias" style={{ textDecoration: "none" }}>
          <Button variant="secondary" size="sm">
            <SlidersHorizontal size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Preferencias push
          </Button>
        </Link>
      </div>

      {unreadCount > 0 && (
        <div style={{
          background: "rgba(37, 99, 235, 0.08)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
          color: "var(--primary)",
        }}>
          <Bell size={18} weight="fill" />
          <span>Tienes <strong>{unreadCount} {unreadCount === 1 ? "aviso nuevo" : "avisos nuevos"}</strong> sin leer.</span>
        </div>
      )}

      {items.length === 0 ? (
        <Card padding="2.5rem 1.5rem" style={{ textAlign: "center" }}>
          <Megaphone size={36} weight="duotone" color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
          <h3 style={{ fontSize: "1.0625rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
            No hay avisos publicados en este momento
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Cuando la Sección XX publique comunicados o convocatorias, aparecerán aquí.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((item) => {
            const isUnread = !item.is_read && !item.is_expired

            return (
              <Link
                key={item.id}
                href={`/avisos/${item.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Card
                  padding="1.25rem"
                  style={{
                    border: isUnread ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: isUnread ? "rgba(37, 99, 235, 0.02)" : "var(--card)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                        {isUnread && (
                          <span style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "var(--primary)",
                            display: "inline-block",
                          }} />
                        )}
                        {item.is_expired ? (
                          <span style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            padding: "0.1rem 0.4rem",
                            borderRadius: "0.25rem",
                            background: "var(--accent)",
                            color: "var(--muted)",
                            textTransform: "uppercase",
                          }}>
                            Aviso vencido
                          </span>
                        ) : isUnread ? (
                          <span style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            padding: "0.1rem 0.4rem",
                            borderRadius: "0.25rem",
                            background: "rgba(37, 99, 235, 0.1)",
                            color: "var(--primary)",
                            textTransform: "uppercase",
                          }}>
                            Nuevo
                          </span>
                        ) : (
                          <span style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            color: "var(--muted)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}>
                            <Check size={12} weight="bold" /> Leído
                          </span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {item.publish_at ? new Date(item.publish_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "Reciente"}
                        </span>
                      </div>

                      <h3 style={{
                        fontSize: "1.0625rem",
                        fontWeight: isUnread ? 700 : 600,
                        margin: "0 0 0.375rem",
                        color: "var(--fg)",
                      }}>
                        {item.title}
                      </h3>

                      <p style={{
                        fontSize: "0.8125rem",
                        color: "var(--muted)",
                        margin: 0,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {item.push_summary || item.body}
                      </p>
                    </div>

                    <CaretRight size={18} weight="bold" color="var(--muted)" style={{ marginTop: "0.25rem", flexShrink: 0 }} />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

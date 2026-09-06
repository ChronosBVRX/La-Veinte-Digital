import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAnnouncementById } from "@/features/announcements/services/announcements-service"
import { markAnnouncementAsRead } from "@/features/announcements/services/announcements-inbox"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { ArrowLeft, ArrowSquareOut, Calendar, Clock, BookOpen } from "@phosphor-icons/react/dist/ssr"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DetalleAvisoPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params
  const announcement = await getAnnouncementById(id)

  if (!announcement || announcement.status !== "PUBLISHED" || !announcement.show_in_inbox) {
    notFound()
  }

  // Marcar como leído de forma idempotente en servidor
  await markAnnouncementAsRead(announcement.id, user.id)

  const isExpired = announcement.expires_at
    ? new Date(announcement.expires_at).getTime() < Date.now()
    : false

  const destination = announcement.destination_path

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Link href="/avisos" style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver a avisos
          </Button>
        </Link>
      </div>

      <Card padding="2rem 1.5rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--accent)",
            color: "var(--primary)",
            textTransform: "uppercase",
          }}>
            {announcement.kind}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Calendar size={14} weight="bold" />
            {announcement.publish_at
              ? new Date(announcement.publish_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
              : "Reciente"}
          </span>
        </div>

        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 1rem", color: "var(--fg)", lineHeight: 1.3 }}>
          {announcement.title}
        </h1>

        {isExpired && (
          <div style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            fontSize: "0.8125rem",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}>
            <Clock size={16} weight="bold" />
            <span>
              <strong>Aviso vencido:</strong> La vigencia de este comunicado concluyó el{" "}
              {new Date(announcement.expires_at!).toLocaleDateString("es-MX")}. Se conserva para consulta histórica.
            </span>
          </div>
        )}

        <div style={{
          fontSize: "0.9375rem",
          lineHeight: 1.7,
          color: "var(--fg)",
          whiteSpace: "pre-wrap",
          marginBottom: "1.5rem",
        }}>
          {announcement.body}
        </div>

        {/* Cita normativa si aplica */}
        {(announcement.source_document || announcement.source_reference) && (
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderLeft: "4px solid var(--primary)",
            borderRadius: "0.375rem",
            padding: "0.875rem 1rem",
            marginBottom: "1.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary)", marginBottom: "0.25rem" }}>
              <BookOpen size={16} weight="bold" />
              <span>Fundamentación documental</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              {[
                announcement.source_document,
                announcement.source_reference,
                announcement.source_version,
                announcement.source_page,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        )}

        {/* Botón de acción (CTA) hacia destino */}
        {destination && !isExpired && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem", display: "flex", justifyContent: "flex-end" }}>
            <Link href={destination} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="md">
                Ir al contenido
                <ArrowSquareOut size={16} weight="bold" style={{ marginLeft: "0.5rem" }} />
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}

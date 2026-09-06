import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { getAnnouncementById } from "@/features/announcements/services/announcements-service"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { AnnouncementForm } from "@/features/announcements/components/AnnouncementForm"
import { ArrowLeft, CaretRight, RocketLaunch } from "@phosphor-icons/react/dist/ssr"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DetalleAvisoAdminPage({ params }: PageProps) {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.canManageAnnouncements) {
    redirect("/admin")
  }

  const { id } = await params
  const announcement = await getAnnouncementById(id)

  if (!announcement) {
    notFound()
  }

  const isPublished = announcement.status === "PUBLISHED"
  const isScheduled = announcement.status === "SCHEDULED"

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href="/admin/avisos" style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver a avisos
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="Administración"
        title={announcement.status === "DRAFT" ? "Editar borrador" : "Detalle de aviso"}
        description={`Aviso: ${announcement.title}`}
      />

      {/* Si está publicado o programado, panel de acción de campaña push */}
      {(isPublished || isScheduled) && (
        <Card padding="1.25rem" style={{ border: "1px solid var(--primary)", background: "var(--accent)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <RocketLaunch size={24} weight="duotone" color="var(--primary)" />
              <div>
                <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9375rem", fontWeight: 700 }}>
                  Campaña Push Android
                </h4>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
                  Despacha este aviso como notificación al celular de los trabajadores elegibles.
                </p>
              </div>
            </div>
            <Link href={`/admin/campanas/nueva?announcement_id=${announcement.id}`} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm">
                Configurar envío push
                <CaretRight size={14} weight="bold" style={{ marginLeft: "0.25rem" }} />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <AnnouncementForm initialData={announcement} />
    </div>
  )
}

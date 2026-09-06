import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { AnnouncementForm } from "@/features/announcements/components/AnnouncementForm"

export default async function NuevoAvisoPage() {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.canManageAnnouncements) {
    redirect("/admin")
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Administración"
        title="Crear nuevo aviso"
        description="Redacta un comunicado institucional, configura canales y programa su publicación."
      />
      <AnnouncementForm />
    </div>
  )
}

import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { getAnnouncementById } from "@/features/announcements/services/announcements-service"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { CampaignDispatchForm } from "@/features/push/components/CampaignDispatchForm"
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

interface PageProps {
  searchParams: Promise<{ announcement_id?: string }>
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceRoleClient(url, key)
}

export default async function NuevaCampanaPage({ searchParams }: PageProps) {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) {
    redirect("/admin")
  }

  const { announcement_id } = await searchParams
  let announcement = null
  if (announcement_id) {
    announcement = await getAnnouncementById(announcement_id)
  }

  // Obtener estimación de dispositivos elegibles en servidor
  const supabase = serviceClient()
  let totalEligibleDevices = 0
  let myDevicesCount = 0

  if (supabase) {
    const { count: allCount } = await supabase
      .from("push_devices")
      .select("*", { count: "exact", head: true })
      .eq("notifications_enabled", true)
    totalEligibleDevices = allCount ?? 0

    const { count: selfCount } = await supabase
      .from("push_devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("notifications_enabled", true)
    myDevicesCount = selfCount ?? 0
  }

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <Link href={announcement_id ? `/admin/avisos/${announcement_id}` : "/admin"} style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
            Volver
          </Button>
        </Link>
      </div>

      <PageHeader
        eyebrow="Campaña Push Android"
        title="Despacho de Notificación"
        description="Envía una notificación push inmediata o realiza una prueba previa a tu propio teléfono."
      />

      <CampaignDispatchForm
        announcement={announcement}
        totalEligibleDevices={totalEligibleDevices}
        myDevicesCount={myDevicesCount}
      />
    </div>
  )
}

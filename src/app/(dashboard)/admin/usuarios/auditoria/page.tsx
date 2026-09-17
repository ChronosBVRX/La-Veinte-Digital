import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { getAdminAuditPage } from "@/features/admin-users/services/admin-users-service"
import { AuditLogScreen } from "@/features/admin-users/components/AuditLogScreen"
import { PageHeader } from "@/shared/components/app/PageHeader"
import type { AdminAuditPage } from "@/shared/contracts/admin-users"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Bitácora administrativa | Administración",
  robots: { index: false, follow: false },
}

export default async function AdminAuditLogPage() {
  const { capabilities } = await getAdminCapabilities()

  if (!capabilities.isAdmin) {
    redirect("/admin")
  }

  let initialPage: AdminAuditPage | null = null
  let initialError = false
  try {
    initialPage = await getAdminAuditPage({ page: 1, pageSize: 25 })
  } catch {
    initialError = true
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Administración General"
        title="Bitácora administrativa"
        description="Registro inmutable de acciones sobre cuentas: cambio de rol, suspensión, reactivación, papelera, restauración, cierre de sesiones e intentos rechazados."
        backHref="/admin/usuarios"
      />

      <AuditLogScreen initialPage={initialPage} initialError={initialError} />
    </div>
  )
}

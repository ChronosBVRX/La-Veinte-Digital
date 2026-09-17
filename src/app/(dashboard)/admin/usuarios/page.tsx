import Link from "next/link"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { getAdminUsersPage } from "@/features/admin-users/services/admin-users-service"
import { AdminUsersScreen } from "@/features/admin-users/components/AdminUsersScreen"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Button } from "@/shared/components/ui/Button"
import { UsersThree, ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr"
import { DEFAULT_ADMIN_USERS_QUERY } from "@/shared/contracts/admin-users"
import type { AdminUserPage } from "@/shared/contracts/admin-users"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Usuarios | Administración",
  robots: { index: false, follow: false },
}

export default async function AdminUsersPage() {
  const { capabilities } = await getAdminCapabilities()

  if (!capabilities.isAdmin) {
    redirect("/admin")
  }

  let initialPage: AdminUserPage | null = null
  let initialError = false
  try {
    initialPage = await getAdminUsersPage(DEFAULT_ADMIN_USERS_QUERY)
  } catch {
    initialError = true
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PageHeader
        eyebrow="Administración General"
        title="Centro de usuarios"
        description="Búsqueda, roles de plataforma, suspensión, papelera recuperable y bitácora. Toda acción queda auditada y se verifica en el servidor."
        backHref="/admin"
        actions={
          <Link href="/admin/usuarios/auditoria" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="md">
              <ClockCounterClockwise size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Ver bitácora
            </Button>
          </Link>
        }
      />

      <AdminUsersScreen initialPage={initialPage} initialError={initialError} />

      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <UsersThree size={16} weight="duotone" />
        Las fichas muestran solo estados técnicos y conteos. Nunca se abren documentos, tarjetones ni contenido privado.
      </p>
    </div>
  )
}

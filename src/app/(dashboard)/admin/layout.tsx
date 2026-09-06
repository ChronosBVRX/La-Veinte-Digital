import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import type { ReactNode } from "react"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, capabilities } = await getAdminCapabilities()

  if (!user) {
    redirect("/login")
  }

  // Si el usuario no tiene ninguna capacidad administrativa, se deniega acceso
  if (!capabilities.canAccessAdminPanel) {
    return (
      <div style={{ maxWidth: "600px", margin: "3rem auto", padding: "1.5rem", textAlign: "center" }}>
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "2rem 1.5rem",
        }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>
            Acceso restringido
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            No tienes permisos para acceder al área de administración de La Veinte Digital.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      {children}
    </div>
  )
}

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/shared/components/layout/DashboardShell"
import { ToastProvider } from "@/shared/components/ui/Toast"
import { PushTokenSync } from "@/features/push/components/PushTokenSync"
import { PayslipGlobalInvalidation } from "@/shared/components/layout/PayslipGlobalInvalidation"
import type { ReactNode } from "react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  const allowedEmails = (process.env.PUSH_ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const isLegacyAllowed = !!user.email && allowedEmails.includes(user.email.toLowerCase())
  const canAccessAdmin = profile?.role === "admin" || isLegacyAllowed

  // Representación Sindical XXI: acceso solo con membresía activa (o admin global).
  // Aditivo: no altera el resto del layout.
  let canAccessUnion = canAccessAdmin
  if (!canAccessUnion) {
    const { count } = await supabase
      .from("union_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("active", true)
    canAccessUnion = (count ?? 0) > 0
  }

  return (
    <ToastProvider>
      <DashboardShell
        fullName={profile?.full_name ?? null}
        canAccessAdmin={canAccessAdmin}
        canAccessUnion={canAccessUnion}
      >
        {children}
      </DashboardShell>
      <PushTokenSync />
      <PayslipGlobalInvalidation />
    </ToastProvider>
  )
}

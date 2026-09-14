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

  // Representación Sindical XXI (BETA PRIVADA): acceso SOLO con membresía
  // activa en union_members. profiles.role='admin' NO otorga acceso sindical.
  // Aditivo: no altera el resto del layout.
  const { count: unionCount } = await supabase
    .from("union_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", true)
  const canAccessUnion = (unionCount ?? 0) > 0

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

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/shared/components/layout/DashboardShell"
import { ToastProvider } from "@/shared/components/ui/Toast"
import { PushTokenSync } from "@/features/push/components/PushTokenSync"
import type { ReactNode } from "react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single()

  return (
    <ToastProvider>
      <DashboardShell fullName={profile?.full_name ?? null}>
        {children}
      </DashboardShell>
      <PushTokenSync />
    </ToastProvider>
  )
}

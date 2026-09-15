import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CopyServicePage } from "@/features/copy-service/components/CopyServicePage"

export const metadata = {
  title: "Sacar copias",
  description: "Usa tu celular como escáner y envía el documento a imprimir en la oficina sindical.",
}

export default async function CopiasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/copias")
  }

  return <CopyServicePage userId={user.id} />
}

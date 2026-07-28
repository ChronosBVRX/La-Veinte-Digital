import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RegisterForm } from "./register-form"

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <img src="/Logo SXX_recortado.png" alt="La Veinte Digital" style={{ maxHeight: "80px", width: "auto", display: "inline-block" }} />
        </div>
        <p style={{ color: "var(--muted)", marginBottom: "2rem", textAlign: "center" }}>
          Regístrate en La Veinte Digital
        </p>
        <RegisterForm />
      </div>
    </div>
  )
}

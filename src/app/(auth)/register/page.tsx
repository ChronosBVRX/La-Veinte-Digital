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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <img src="/Logo SXX_recortado.png" alt="SXX" style={{ maxHeight: "80px", width: "auto", display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)", letterSpacing: "-0.02em" }}>SXX</span>
              <span style={{ fontSize: "1rem", color: "var(--muted)" }}>|</span>
              <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em" }}>La Veinte Digital</span>
            </div>
          </div>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: "2rem", textAlign: "center" }}>
          Regístrate en La Veinte Digital
        </p>
        <RegisterForm />
      </div>
    </div>
  )
}

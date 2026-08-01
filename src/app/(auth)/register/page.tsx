import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Image from "next/image"
import { RegisterForm } from "./register-form"

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "1rem",
            background: "linear-gradient(135deg, var(--primary), #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          }}>
            <Image
              src="/Logo SXX_recortado.png"
              alt="SXX"
              width={44}
              height={44}
              style={{ maxHeight: "44px", width: "auto", filter: "brightness(0) invert(1)" }}
            />
          </div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>La Veinte Digital</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Regístrate en la plataforma
          </p>
        </div>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem",
          boxShadow: "var(--shadow-md)",
        }}>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}

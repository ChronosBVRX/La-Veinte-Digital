import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Image from "next/image"
import { RecuperarPasswordForm } from "./recuperar-form"

export default async function RecuperarPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "1rem",
            background: "linear-gradient(135deg, var(--primary), #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          }}>
            <Image
              src="/logo-icon.png"
              alt="La Veinte Digital"
              width={44}
              height={44}
              style={{ maxHeight: "44px", width: "auto" }}
            />
          </div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Recuperar contraseña</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", margin: 0 }}>
            Ingresa tu correo para recibir las instrucciones
          </p>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem",
          boxShadow: "var(--shadow-md)",
        }}>
          <RecuperarPasswordForm />
        </div>
      </div>
    </div>
  )
}

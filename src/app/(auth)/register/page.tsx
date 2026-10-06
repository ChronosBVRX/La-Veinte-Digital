import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Image from "next/image"
import { RegisterForm } from "./register-form"

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect("/")

  return (
    <div
      style={{
        minHeight: "var(--visual-viewport-height, 100dvh)",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        placeItems: "center",
        padding: "clamp(0.75rem, 3vw, 1.25rem)",
        paddingTop: "max(clamp(0.75rem, 3vw, 1.25rem), env(safe-area-inset-top, 0px))",
        paddingBottom: "max(clamp(0.75rem, 3vw, 1.25rem), env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px", minWidth: 0, margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(1.25rem, 4vw, 2rem)" }}>
          <div style={{
            width: "clamp(58px, 15vw, 72px)",
            height: "clamp(58px, 15vw, 72px)",
            borderRadius: "1rem",
            background: "linear-gradient(135deg, var(--primary), #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 0.875rem", boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          }}>
            <Image
              src="/logo-icon.png"
              alt="La Veinte Digital"
              width={44}
              height={44}
              style={{ maxHeight: "62%", width: "auto", height: "auto" }}
            />
          </div>
          <h1 style={{ fontSize: "clamp(1.2rem, 5vw, 1.375rem)", fontWeight: 700, margin: "0 0 0.25rem" }}>La Veinte Digital</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Regístrate en la plataforma
          </p>
        </div>
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "clamp(1rem, 4.5vw, 1.5rem)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}>
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}

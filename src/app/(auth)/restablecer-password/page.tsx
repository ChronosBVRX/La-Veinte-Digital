import Image from "next/image"
import { RestablecerPasswordForm } from "./restablecer-form"

export default function RestablecerPasswordPage() {
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
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>Nueva contraseña</h1>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)", margin: 0 }}>
            Establece una contraseña segura para tu cuenta
          </p>
        </div>

        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.5rem",
          boxShadow: "var(--shadow-md)",
        }}>
          <RestablecerPasswordForm />
        </div>
      </div>
    </div>
  )
}

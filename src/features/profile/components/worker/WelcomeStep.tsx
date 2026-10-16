"use client"
import { Button } from "@/shared/components/ui/Button"
import { CheckCircle2, Sparkles } from "lucide-react"

interface WelcomeStepProps {
  onStart: () => void
  onChoosePayslip?: () => void
  onSkipBasic: () => void
  loading: boolean
  isInitialOnboarding?: boolean
}

export function WelcomeStep({ onStart, onChoosePayslip, onSkipBasic, loading, isInitialOnboarding }: WelcomeStepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", textAlign: "center" }}>
      {isInitialOnboarding && (
        <div
          role="status"
          style={{
            width: "100%",
            maxWidth: "480px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
            lineHeight: 1.45,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
          }}
        >
          <CheckCircle2 size={16} style={{ color: "#166534", flexShrink: 0 }} />
          <span>
            <strong>¡Registro e inicio de sesión exitoso!</strong> Tu cuenta ya está activa. Puedes configurar tus datos laborales ahora o ir directo al inicio.
          </span>
        </div>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(37, 99, 235, 0.08)",
          color: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={28} />
      </div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>¡Tu cuenta está lista!</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.9375rem", margin: 0, lineHeight: 1.5, maxWidth: "520px" }}>
        Elige cómo quieres preparar tu perfil laboral para personalizar tus calculadoras, vacaciones y herramientas:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "400px" }}>
        {onChoosePayslip && (
          <Button onClick={onChoosePayslip} disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            Subir mi tarjetón IMSS (Recomendado)
          </Button>
        )}
        <Button
          variant={onChoosePayslip ? "secondary" : "primary"}
          onClick={onStart}
          disabled={loading}
          style={{ width: "100%", justifyContent: "center" }}
        >
          Capturar datos manualmente
        </Button>
        <Button variant="ghost" onClick={onSkipBasic} loading={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Redirigiendo al inicio..." : "Omitir por ahora (Modo básico)"}
        </Button>
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0 }}>
        Tardarás menos de 2 minutos y podrás cambiarlo cuando quieras.
      </p>
    </div>
  )
}

"use client"
import { Button } from "@/shared/components/ui/Button"

export function WelcomeStep({ onStart, onSkipBasic, loading }: { onStart: () => void; onSkipBasic: () => void; loading: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem" }}>👋</div>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>¡Tu cuenta está lista!</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.9375rem", margin: 0, lineHeight: 1.5 }}>
        Vamos a configurar tu perfil laboral. Esto te ayudará a completar automáticamente calculadoras, simulaciones de nómina, vacaciones y otras herramientas que elijas usar.
      </p>
      <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0 }}>Tardarás menos de 2 minutos.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "320px" }}>
        <Button onClick={onStart} style={{ width: "100%", justifyContent: "center" }}>Comenzar</Button>
        <Button variant="ghost" onClick={onSkipBasic} loading={loading} style={{ width: "100%", justifyContent: "center" }}>
          Usar modo básico
        </Button>
      </div>
    </div>
  )
}

"use client"
import { Button } from "@/shared/components/ui/Button"

export function BasicModeCard({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mi información laboral</h1>
      <p style={{ fontSize: "0.9375rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
        Estás en modo básico. No tienes datos laborales guardados.
      </p>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
        Si decides agregarlos, podrás usar las calculadoras y simuladores con tus datos reales y ahorrar tiempo en cada herramienta.
      </p>
      <Button onClick={onConfigure} style={{ maxWidth: "320px", width: "100%", justifyContent: "center" }}>
        Configurar mi perfil laboral
      </Button>
    </div>
  )
}

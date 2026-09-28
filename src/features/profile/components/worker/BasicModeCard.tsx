"use client"
import Link from "next/link"
import { Button } from "@/shared/components/ui/Button"

export function BasicModeCard({ onConfigure }: { onConfigure: () => void }) {
  const handleScrollToTarjeton = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("subir-tarjeton")
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
    }
    onConfigure()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mi información laboral</h1>
      <p style={{ fontSize: "0.9375rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
        Estás en modo básico. No tienes datos laborales guardados.
      </p>
      <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, maxWidth: "520px" }}>
        Si decides agregarlos, podrás usar las calculadoras y simuladores con tus datos reales y ahorrar tiempo en cada herramienta.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", maxWidth: "320px", width: "100%" }}>
        <Button onClick={handleScrollToTarjeton} style={{ width: "100%", justifyContent: "center" }}>
          Subir mi tarjetón IMSS
        </Button>
        <Button variant="secondary" onClick={onConfigure} style={{ width: "100%", justifyContent: "center" }}>
          Configurar mi perfil laboral
        </Button>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
          }}
        >
          Ir al inicio →
        </Link>
      </div>
    </div>
  )
}

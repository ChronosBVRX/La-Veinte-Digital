"use client"

import { Button } from "@/shared/components/ui/Button"

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  void error
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ textAlign: "center", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Algo salió mal</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          Ocurrió un error inesperado. Intenta de nuevo o vuelve al inicio.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <Button onClick={reset}>Reintentar</Button>
          <Button variant="secondary" onClick={() => { window.location.href = "/" }}>
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}

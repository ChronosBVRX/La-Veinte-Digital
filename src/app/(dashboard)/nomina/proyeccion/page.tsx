"use client"

import { Card } from "@/shared/components/ui/Card"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

export default function NominaProyeccionPage() {
  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <Card padding="1.5rem" style={{ textAlign: "center" }}>
        <LoadingSpinner text="Cargando proyecci&oacute;n..." />
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.75rem" }}>
          Usa el panel principal de N&oacute;mina para generar una proyecci&oacute;n desde tu perfil.
        </p>
      </Card>
    </div>
  )
}

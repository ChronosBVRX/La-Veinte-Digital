"use client"

import Link from "next/link"
import type { ConfirmTarjetonResponse, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Badge } from "@/shared/components/ui/Badge"

interface ImportSuccessProps {
  parsed: ParsedImssTarjeton
  response: ConfirmTarjetonResponse
  onStartOver: () => void
}

export function ImportSuccess({ parsed, response, onStartOver }: ImportSuccessProps) {
  const periodLabel = parsed.document.periodRaw || "periodo no detectado"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 560, margin: "0 auto" }}>
      <Card padding="1.5rem" style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.75rem", borderColor: "var(--success)" }}>
        <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: "1.125rem" }}>Tarjetón confirmado</div>
        <div style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          El recibo de <strong>{periodLabel}</strong> quedó registrado en tu historial
          {response.profileUpdated || response.payrollContextUpdated
            ? " y tu información laboral ya está actualizada."
            : "."}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge variant="success">Guardado</Badge>
          {response.profileUpdated && <Badge variant="info">Perfil actualizado</Badge>}
          {response.payrollContextUpdated && <Badge variant="info">Contexto de nómina actualizado</Badge>}
          {response.duplicate && <Badge variant="warning">Ya habías subido este archivo</Badge>}
        </div>
        {response.duplicate && (
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            No se guardó una copia duplicada; se reutilizó el registro existente.
          </div>
        )}
      </Card>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button variant="secondary" onClick={onStartOver}>
          Subir otro tarjetón
        </Button>
        <Link href="/calculadoras" style={{ textDecoration: "none" }}>
          <Button>Ir a calculadoras</Button>
        </Link>
        <Link href="/profile/mi-informacion-laboral" style={{ textDecoration: "none" }}>
          <Button variant="outline">Mi información laboral</Button>
        </Link>
      </div>
    </div>
  )
}

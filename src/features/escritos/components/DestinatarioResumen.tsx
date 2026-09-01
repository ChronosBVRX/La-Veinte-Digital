"use client"

import { Button } from "@/shared/components/ui/Button"
import type { DestinoCargoNombre } from "@/shared/contracts/escrito-draft"
import { findDestinatario } from "@/features/escritos/data/directorio-destinatarios"

export interface DestinatarioResumenProps {
  destino: DestinoCargoNombre
  onChangeRequest?: () => void
  readOnly?: boolean
  style?: React.CSSProperties
}

/**
 * DestinatarioResumen / RecipientSummary
 * Visor compacto de 48-64px que muestra a quién va dirigido el escrito
 * sin ocupar una tarjeta masiva en pantallas móviles ni en el editor.
 */
export function DestinatarioResumen({
  destino,
  onChangeRequest,
  readOnly = false,
  style,
}: DestinatarioResumenProps) {
  const matchOficial = findDestinatario(destino.cargo, destino.nombre)
  const isManual = !matchOficial && Boolean(destino.nombre || destino.cargo)

  const displayName = destino.nombre?.trim() || (isManual ? "Destinatario no especificado" : "Dirigencia Seccional")
  const displayCargo = destino.cargo?.trim() || ""
  const displayOrgano = matchOficial?.organo || (isManual ? "Destinatario manual" : "")

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.875rem",
        minHeight: "52px",
        maxHeight: "64px",
        boxSizing: "border-box",
        width: "100%",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "1.125rem",
            lineHeight: 1,
            flexShrink: 0,
            padding: "0.25rem",
            borderRadius: "0.375rem",
            background: "var(--accent)",
          }}
          aria-hidden="true"
        >
          {matchOficial?.categoria === "comite_ejecutivo"
            ? "🏛️"
            : matchOficial?.categoria === "secretarias"
            ? "💼"
            : matchOficial?.categoria === "comisiones"
            ? "⚖️"
            : matchOficial?.categoria === "subcomisiones"
            ? "🤝"
            : isManual
            ? "✍️"
            : "👤"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--fg)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`Para: ${displayName}`}
          >
            <span style={{ color: "var(--muted)", fontWeight: 500, marginRight: "0.25rem" }}>Para:</span>
            {displayName}
          </div>

          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${displayCargo}${displayOrgano ? ` · ${displayOrgano}` : ""}`}
          >
            {displayCargo}
            {displayCargo && displayOrgano && " · "}
            {displayOrgano && (
              <span style={{ fontStyle: isManual ? "italic" : "normal" }}>
                {displayOrgano}
              </span>
            )}
          </div>
        </div>
      </div>

      {!readOnly && onChangeRequest && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onChangeRequest}
          style={{
            flexShrink: 0,
            fontSize: "0.75rem",
            padding: "0.25rem 0.625rem",
            height: "32px",
          }}
        >
          Cambiar
        </Button>
      )}
    </div>
  )
}

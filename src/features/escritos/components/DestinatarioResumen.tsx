"use client"

import { Button } from "@/shared/components/ui/Button"
import type { DestinoCargoNombre } from "@/shared/contracts/escrito-draft"
import { findDestinatario } from "@/features/escritos/data/directorio-destinatarios"

export interface DestinatarioResumenProps {
  destino: DestinoCargoNombre
  onChangeRequest?: () => void
  onRemoveRequest?: () => void
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
  onRemoveRequest,
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

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div
            style={{
              display: "block",
              width: "100%",
              maxWidth: "100%",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--fg)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`Para: ${displayName}`}
          >
            <span style={{ color: "var(--muted)", fontWeight: 500, marginRight: "0.25rem", display: "inline-block" }}>Para:</span>
            {displayName}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.25rem",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              fontSize: "0.75rem",
              color: "var(--muted)",
              fontStyle: isManual ? "italic" : "normal",
              overflow: "hidden",
            }}
            title={`${displayCargo}${displayOrgano ? ` · ${displayOrgano}` : ""}`}
          >
            {displayCargo && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>
                {displayCargo}
              </span>
            )}
            {displayCargo && displayOrgano && <span style={{ flexShrink: 0 }}>·</span>}
            {displayOrgano && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 2, minWidth: 0 }}>
                {displayOrgano}
              </span>
            )}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          {onChangeRequest && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onChangeRequest}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                height: "32px",
              }}
            >
              Cambiar
            </Button>
          )}
          {onRemoveRequest && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemoveRequest}
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem",
                height: "32px",
                color: "var(--muted)",
              }}
              title="Quitar destinatario"
              aria-label="Quitar destinatario"
            >
              Quitar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

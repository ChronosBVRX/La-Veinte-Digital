"use client"

/**
 * Revisión previa al guardado: reordenar, rotar, eliminar, cambiar filtro,
 * volver a tomar y decidir si se conserva en Documentos personales.
 *
 * La Veinte Digital
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  Camera,
  Check,
  Info,
  Plus,
  Trash,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { SCAN_FILTERS, type ScanFilter, type ScanMode } from "@/shared/contracts/document-scan"
import type { MoveDirection, ScanPage } from "../types/scanner-types"

export interface DocumentScannerReviewProps {
  mode: ScanMode
  pages: ScanPage[]
  busy: boolean
  error: string | null
  saveToDocuments: boolean
  nativeEngine: boolean
  onToggleSave: (value: boolean) => void
  onChangeFilter: (id: string, filter: ScanFilter) => void
  onRotate: (id: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, direction: MoveDirection) => void
  onAddPage: () => void
  onRetake: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}

const FILTER_LABELS: Record<ScanFilter, string> = {
  original: "Original",
  enhanced: "Color mejorado",
  grayscale: "Grises",
  bw: "Blanco y negro",
}

export function DocumentScannerReview({
  mode,
  pages,
  busy,
  error,
  saveToDocuments,
  nativeEngine,
  onToggleSave,
  onChangeFilter,
  onRotate,
  onRemove,
  onMove,
  onAddPage,
  onRetake,
  onCancel,
  onConfirm,
}: DocumentScannerReviewProps) {
  const isIne = mode !== "document"
  const canConfirm = isIne ? pages.length >= 2 : pages.length >= 1

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          {isIne ? "Revisa el frente y el reverso" : "Revisa tus páginas"}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>
          {isIne
            ? "Se guardarán ambas caras centradas en una sola hoja tamaño carta."
            : `${pages.length} ${pages.length === 1 ? "página" : "páginas"} · Puedes reordenarlas, rotarlas o volver a tomarlas.`}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
        {pages.map((page, index) => {
          const pageLabel = isIne ? (index === 0 ? "Frente" : "Reverso") : `Página ${index + 1}`
          return (
          <div
            key={page.id}
            style={{
              display: "flex",
              gap: "0.875rem",
              padding: "0.75rem",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 84,
                height: 112,
                flexShrink: 0,
                borderRadius: "0.5rem",
                overflow: "hidden",
                background: "var(--accent)",
                border: "1px solid var(--border)",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- previsualización local de un blob */}
              <img
                src={page.previewUrl}
                alt={pageLabel}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `rotate(${page.rotation}deg)`,
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
                  {pageLabel}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                  {page.width}×{page.height}
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {SCAN_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => onChangeFilter(page.id, filter)}
                    disabled={busy}
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "999px",
                      border: `1px solid ${page.filter === filter ? "var(--primary)" : "var(--border)"}`,
                      background: page.filter === filter ? "var(--primary)" : "var(--accent)",
                      color: page.filter === filter ? "var(--primary-fg)" : "var(--fg)",
                      cursor: busy ? "wait" : "pointer",
                    }}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                <IconAction label="Rotar 90°" onClick={() => onRotate(page.id)} disabled={busy}>
                  <ArrowsClockwise size={16} />
                </IconAction>
                <IconAction label="Volver a tomar" onClick={() => onRetake(page.id)} disabled={busy}>
                  <Camera size={16} />
                </IconAction>
                {!isIne && (
                  <>
                    <IconAction label="Mover arriba" onClick={() => onMove(page.id, "up")} disabled={busy || index === 0}>
                      <ArrowUp size={16} />
                    </IconAction>
                    <IconAction
                      label="Mover abajo"
                      onClick={() => onMove(page.id, "down")}
                      disabled={busy || index === pages.length - 1}
                    >
                      <ArrowDown size={16} />
                    </IconAction>
                  </>
                )}
                <IconAction
                  label="Eliminar página"
                  onClick={() => onRemove(page.id)}
                  disabled={busy || (isIne && pages.length <= 2)}
                  danger
                >
                  <Trash size={16} />
                </IconAction>
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {!isIne && (
        <Button variant="secondary" size="sm" onClick={onAddPage} disabled={busy} style={{ alignSelf: "flex-start" }}>
          <Plus size={16} />
          Agregar página
        </Button>
      )}

      {isIne && (
        <div
          style={{
            display: "flex",
            gap: "0.625rem",
            alignItems: "flex-start",
            padding: "0.75rem 0.875rem",
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "0.625rem",
            fontSize: "0.8125rem",
            color: "var(--muted)",
            lineHeight: 1.45,
          }}
        >
          <Info size={18} weight="duotone" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            No se leen ni extraen datos del INE (nombre, CURP, clave de elector, QR). Solo se compone la imagen en
            una hoja tamaño carta.
          </span>
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          padding: "0.75rem 0.875rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.625rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={saveToDocuments}
          onChange={(event) => onToggleSave(event.target.checked)}
          disabled={busy}
          style={{ marginTop: "0.15rem", width: 18, height: 18, accentColor: "var(--primary)" }}
        />
        <span style={{ fontSize: "0.8125rem", color: "var(--fg)", lineHeight: 1.45 }}>
          <strong>Guardar también en mis documentos</strong>
          <span style={{ display: "block", color: "var(--muted)", marginTop: "0.125rem" }}>
            {saveToDocuments
              ? "El PDF se conservará en Documentos personales."
              : "El PDF solo se enviará a imprimir; no se guardará en el dispositivo."}
          </span>
        </span>
      </label>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "0.625rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.8125rem",
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      )}

      {nativeEngine && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
          Capturado con el escáner de Google ML Kit (procesamiento en el dispositivo).
        </p>
      )}

      <div style={{ display: "flex", gap: "0.625rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" size="md" loading={busy} disabled={!canConfirm || busy} onClick={onConfirm}>
          <Check size={18} />
          {saveToDocuments ? "Guardar PDF" : "Enviar a imprimir"}
        </Button>
      </div>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: "0.5rem",
        border: `1px solid ${danger ? "#fecaca" : "var(--border)"}`,
        background: "transparent",
        color: danger ? "#dc2626" : "var(--fg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}

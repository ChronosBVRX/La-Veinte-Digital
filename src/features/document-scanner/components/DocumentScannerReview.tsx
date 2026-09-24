"use client"

/**
 * Revisión previa al guardado: reordenar, rotar, eliminar, cambiar filtro,
 * volver a tomar y decidir si se conserva en Documentos personales.
 *
 * La Veinte Digital
 */

import { useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  Camera,
  Check,
  Info,
  MagnifyingGlassPlus,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { SCAN_FILTERS, type ScanFilter, type ScanMode } from "@/shared/contracts/document-scan"
import type { MoveDirection, ScanPage } from "../types/scanner-types"

export interface DocumentScannerReviewProps {
  mode: ScanMode
  intent?: "save" | "print"
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
  enhanced: "Documento",
  grayscale: "Grises",
  bw: "Blanco y negro",
}

export function DocumentScannerReview({
  mode,
  intent,
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
  const [zoomedPageId, setZoomedPageId] = useState<string | null>(null)
  const isIne = mode !== "document"
  const canConfirm = isIne ? pages.length >= 2 : pages.length >= 1
  const visibleFilters: readonly ScanFilter[] = isIne
    ? (["original"] as const)
    : SCAN_FILTERS

  const zoomedPage = pages.find((p) => p.id === zoomedPageId)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          {isIne ? "Revisa el frente y el reverso" : "Revisa tus páginas"}
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>
          {isIne
            ? "Se guardarán ambas caras centradas en una sola hoja tamaño carta."
            : `${pages.length} ${pages.length === 1 ? "página" : "páginas"} · Toca cualquier miniatura para verla en grande.`}
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
              role="button"
              tabIndex={0}
              onClick={() => setZoomedPageId(page.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setZoomedPageId(page.id)
                }
              }}
              title="Toca para ver en grande"
              aria-label={`Ver ${pageLabel} en grande`}
              style={{
                width: 96,
                height: 128,
                flexShrink: 0,
                borderRadius: "0.5rem",
                overflow: "hidden",
                background: "var(--accent)",
                border: "1px solid var(--border)",
                position: "relative",
                cursor: "pointer",
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
              <div
                style={{
                  position: "absolute",
                  right: 4,
                  bottom: 4,
                  background: "rgba(0, 0, 0, 0.65)",
                  color: "#ffffff",
                  borderRadius: "0.25rem",
                  padding: "2px 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <MagnifyingGlassPlus size={14} />
              </div>
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
                {visibleFilters.map((filter) => (
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
            El INE se conserva en color original sin filtros agresivos para proteger la fotografía, tramas y sellos de seguridad oficiales. No se leen ni extraen datos personales (sin OCR). Se compone en una sola hoja tamaño carta.
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
          <strong>Guardar también en Mis documentos</strong>
          <span style={{ display: "block", color: "var(--muted)", marginTop: "0.125rem" }}>
            {intent === "print"
              ? "Opcional. Si no lo activas, el archivo solo se utilizará para enviarlo a imprimir."
              : saveToDocuments
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
          {intent === "print" ? "Enviar a imprimir" : saveToDocuments ? "Guardar PDF" : "Enviar a imprimir"}
        </Button>
      </div>

      {zoomedPage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa ampliada"
          onClick={() => setZoomedPageId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.78)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--card)",
              color: "var(--fg)",
              borderRadius: "0.875rem",
              border: "1px solid var(--border)",
              maxWidth: "min(540px, 94vw)",
              maxHeight: "90vh",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border)",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.9375rem" }}>
                  {isIne
                    ? pages.findIndex((p) => p.id === zoomedPage.id) === 0
                      ? "Frente"
                      : "Reverso"
                    : `Página ${pages.findIndex((p) => p.id === zoomedPage.id) + 1}`}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {zoomedPage.width}×{zoomedPage.height}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPageId(null)}
                aria-label="Cerrar vista previa ampliada"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--accent)",
                  color: "var(--fg)",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
                background: "var(--bg)",
                overflow: "auto",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- previsualización local de un blob */}
              <img
                src={zoomedPage.previewUrl}
                alt="Vista previa ampliada"
                style={{
                  maxWidth: "100%",
                  maxHeight: "58vh",
                  objectFit: "contain",
                  borderRadius: "0.375rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
                  transform: `rotate(${zoomedPage.rotation}deg)`,
                }}
              />
            </div>

            <div
              style={{
                padding: "0.75rem 1rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                background: "var(--card)",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginRight: "0.25rem" }}>
                Filtro:
              </span>
              {visibleFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => onChangeFilter(zoomedPage.id, filter)}
                  disabled={busy}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "0.3rem 0.65rem",
                    borderRadius: "999px",
                    border: `1px solid ${zoomedPage.filter === filter ? "var(--primary)" : "var(--border)"}`,
                    background: zoomedPage.filter === filter ? "var(--primary)" : "var(--accent)",
                    color: zoomedPage.filter === filter ? "var(--primary-fg)" : "var(--fg)",
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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

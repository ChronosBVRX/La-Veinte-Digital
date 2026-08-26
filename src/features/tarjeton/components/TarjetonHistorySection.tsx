"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog"
import { CheckCircle, Trash, Plus, Info, CaretDown } from "@phosphor-icons/react"

interface PreviousImport {
  id: string
  periodRaw: string | null
  extractionMethod: string
  globalConfidence: number
  createdAt: string
  employeeName: string | null
  totalNet: number | null
}

export function TarjetonHistorySection({
  imports: initial,
  latestConcepts = [],
  onUploadNew,
}: {
  imports: PreviousImport[]
  latestConcepts?: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }>
  onUploadNew?: () => void
}) {
  const [imports, setImports] = useState(initial)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await fetch("/api/tarjeton/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingId }),
      })
      if (res.ok) {
        setImports((prev) => prev.filter((i) => i.id !== deletingId))
      }
    } catch {
      /* noop */
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }, [deletingId])

  const latest = imports[0]

  if (imports.length === 0) {
    return (
      <div style={{ marginTop: "2rem" }}>
        <Card padding="1.5rem" style={{ textAlign: "center", background: "var(--accent)" }}>
          <p style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: "0 0 0.5rem" }}>
            No tienes tarjetones importados
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0 0 1rem", lineHeight: 1.4 }}>
            Importa tu primer tarjetón para consultar tus conceptos y utilizar las herramientas de nómina.
          </p>
          {onUploadNew && (
            <Button variant="primary" onClick={onUploadNew}>
              <Plus size={18} weight="bold" /> Importar mi tarjetón
            </Button>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      {/* Latest tarjetón highlight */}
      {latest && (
        <Card padding="1.25rem" style={{ marginBottom: "1.25rem", borderColor: "var(--primary)", borderWidth: "1.5px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1 }}>
              <CheckCircle size={24} weight="fill" color="var(--state-success-fg)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--fg)" }}>
                    Tarjetón · {latest.periodRaw ?? "Periodo reciente"}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", background: "var(--accent)", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-pill)" }}>
                    {latest.employeeName ?? "Trabajador"}
                  </span>
                </div>

                {latest.totalNet != null && (
                  <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--primary)", margin: "0.25rem 0" }}>
                    Neto: ${latest.totalNet.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}

                <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                  Importado el {new Date(latest.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeletingId(latest.id)}
              aria-label="Eliminar tarjetón"
              style={{
                color: "var(--error)",
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.5rem",
              }}
            >
              <Trash size={18} weight="bold" />
            </Button>
          </div>

          {/* Detalles técnicos colapsables */}
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem 0",
                fontSize: "var(--text-xs)",
                color: "var(--muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontFamily: "inherit",
              }}
            >
              <CaretDown size={12} weight="bold" style={{ transform: showDetails ? "rotate(180deg)" : "none", transition: "transform var(--transition)" }} />
              {showDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
            </button>
            {showDetails && (
              <div style={{ padding: "0.5rem 0.75rem", background: "var(--accent)", borderRadius: "var(--radius-sm)", marginTop: "0.375rem", fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                Método de extracción: {latest.extractionMethod === "native_text" ? "Texto digital" : "OCR"} · Confianza: {Math.round(latest.globalConfidence * 100)}%
              </div>
            )}
          </div>

          {/* Conceptos del último tarjetón */}
          {latestConcepts.length > 0 && (
            <div style={{ marginTop: "1rem", paddingTop: "0.875rem", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", marginBottom: "0.5rem" }}>
                Conceptos desglosados
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {latestConcepts.map((c, i) => (
                  <Link
                    key={`${c.code}-${i}`}
                    href={`/guia/conceptos/${c.code}`}
                    title={`Explicación del concepto ${c.code}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "9999px",
                      background: c.kind === "earning" ? "var(--state-info-bg)" : "var(--state-warning-bg)",
                      color: c.kind === "earning" ? "var(--state-info-fg)" : "var(--state-warning-fg)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 600,
                      textDecoration: "none",
                      lineHeight: 1.3,
                    }}
                  >
                    {c.code} · {c.description}
                    <Info size={14} weight="fill" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Upload new button */}
      {onUploadNew && (
        <div style={{ marginBottom: imports.length > 1 ? "1.5rem" : 0 }}>
          <Button variant="secondary" size="md" onClick={onUploadNew}>
            <Plus size={18} weight="bold" /> Subir otro tarjetón
          </Button>
        </div>
      )}

      {/* Older uploads */}
      {imports.length > 1 && (
        <>
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.75rem" }}>
            Tarjetones anteriores ({imports.length - 1})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {imports.slice(1).map((imp) => (
              <Card key={imp.id} padding="0.875rem 1.25rem">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                    <CheckCircle size={18} weight="fill" color="var(--state-success-fg)" style={{ flexShrink: 0, opacity: 0.8 }} />
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)" }}>
                        {imp.periodRaw ?? "Sin periodo"}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                        Neto: ${imp.totalNet?.toLocaleString("es-MX", { minimumFractionDigits: 2 }) ?? "—"} · Importado el {new Date(imp.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(imp.id)}
                    aria-label="Eliminar tarjetón"
                    style={{
                      color: "var(--error)",
                      minWidth: 44,
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.5rem",
                    }}
                  >
                    <Trash size={16} weight="bold" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Diálogo accesible de confirmación de eliminación */}
      <ConfirmDialog
        open={deletingId !== null}
        title="¿Eliminar este tarjetón?"
        description="Se eliminará de tu historial de La Veinte Digital. Esta acción no afecta tu información en IMSS."
        confirmLabel="Eliminar tarjetón"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  )
}

"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Badge } from "@/shared/components/ui/Badge"
import { ConfirmDialog } from "@/shared/components/ui/ConfirmDialog"
import { CheckCircle, Trash, Plus, Info, CaretDown, Check, ArrowCounterClockwise } from "@phosphor-icons/react"

export interface PreviousImport {
  id: string
  periodRaw: string | null
  extractionMethod: string
  globalConfidence: number
  createdAt: string
  employeeName: string | null
  totalNet: number | null
}

interface TarjetonHistorySectionProps {
  imports: PreviousImport[]
  activePayslipId?: string | null
  latestPayslipId?: string | null
  selectionMode?: "AUTO_LATEST" | "PINNED"
  latestConcepts?: Array<{ code: string; description: string; amount: number; kind: "earning" | "deduction" }>
  onUploadNew?: () => void
  uploadHref?: string
}

export function TarjetonHistorySection({
  imports: initial,
  activePayslipId: initialActiveId,
  latestPayslipId,
  selectionMode: initialSelectionMode = "AUTO_LATEST",
  latestConcepts = [],
  onUploadNew,
  uploadHref,
}: TarjetonHistorySectionProps) {
  const router = useRouter()
  const [imports, setImports] = useState(initial)
  const [activeId, setActiveId] = useState<string | null>(
    initialActiveId ?? (initial[0]?.id ?? null)
  )
  const [selectionMode, setSelectionMode] = useState<"AUTO_LATEST" | "PINNED">(initialSelectionMode)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activatingPeriod, setActivatingPeriod] = useState<string | null>(null)
  const [isActivating, setIsActivating] = useState(false)
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
      const response = await res.json()
      if (res.ok && response.ok) {
        setImports((prev) => prev.filter((i) => i.id !== deletingId))
        if (activeId === deletingId) {
          setActiveId(response.activePayslipId ?? null)
          setSelectionMode(response.selectionMode ?? "AUTO_LATEST")
        }

        const detail = {
          activePayslipId: response.activePayslipId,
          selectionMode: response.selectionMode,
          contextRevision: response.contextRevision,
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nomina_payslip_updated", { detail }))
          try {
            const bc = new BroadcastChannel("la20-worker-context")
            bc.postMessage({ type: "nomina_payslip_updated", detail })
            bc.close()
          } catch {
            // Ignorar si no está soportado
          }
        }
        router.refresh()
      }
    } catch {
      /* noop */
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }, [deletingId, activeId, router])

  const handleActivate = useCallback(async (payslipId: string) => {
    setIsActivating(true)
    try {
      const res = await fetch("/api/tarjeton/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pin", payslipId }),
      })
      const response = await res.json()
      if (res.ok && response.ok) {
        if (response.selectionMode === "PINNED" && response.activePayslipId !== payslipId) {
          console.error("[TarjetonHistorySection] Inconsistencia: el servidor activó un tarjetón distinto al solicitado:", response)
          return
        }
        setActiveId(response.activePayslipId)
        setSelectionMode(response.selectionMode)

        const detail = {
          activePayslipId: response.activePayslipId,
          employeeNumber: response.employeeNumber,
          selectionMode: response.selectionMode,
          contextRevision: response.contextRevision,
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nomina_payslip_updated", { detail }))
          try {
            const bc = new BroadcastChannel("la20-worker-context")
            bc.postMessage({ type: "nomina_payslip_updated", detail })
            bc.close()
          } catch {
            // Ignorar si no está soportado
          }
        }
        router.refresh()
      }
    } catch {
      /* noop */
    } finally {
      setIsActivating(false)
      setActivatingId(null)
      setActivatingPeriod(null)
    }
  }, [router])

  const handleResetToLatest = useCallback(async () => {
    setIsActivating(true)
    try {
      const res = await fetch("/api/tarjeton/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto_latest" }),
      })
      const response = await res.json()
      if (res.ok && response.ok) {
        setActiveId(response.activePayslipId)
        setSelectionMode(response.selectionMode)

        const detail = {
          activePayslipId: response.activePayslipId,
          employeeNumber: response.employeeNumber,
          selectionMode: response.selectionMode,
          contextRevision: response.contextRevision,
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("nomina_payslip_updated", { detail }))
          try {
            const bc = new BroadcastChannel("la20-worker-context")
            bc.postMessage({ type: "nomina_payslip_updated", detail })
            bc.close()
          } catch {
            // Ignorar si no está soportado
          }
        }
        router.refresh()
      }
    } catch {
      /* noop */
    } finally {
      setIsActivating(false)
    }
  }, [router])

  if (imports.length === 0) {
    return (
      <div style={{ marginTop: "1rem" }}>
        <Card padding="1.5rem" style={{ textAlign: "center", background: "var(--accent)" }}>
          <p style={{ fontSize: "var(--text-md)", fontWeight: 600, margin: "0 0 0.5rem" }}>
            No tienes tarjetones importados
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: "0 0 1rem", lineHeight: 1.4 }}>
            Importa tu primer tarjetón para consultar tus conceptos y utilizar las herramientas de nómina.
          </p>
          {uploadHref && (
            <Link href={uploadHref} style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              background: "var(--primary)", color: "var(--primary-fg)",
              textDecoration: "none", fontWeight: 600, fontSize: "var(--text-sm)",
            }}>
              <Plus size={18} weight="bold" /> Importar mi tarjetón
            </Link>
          )}
          {onUploadNew && !uploadHref && (
            <Button variant="primary" onClick={onUploadNew}>
              <Plus size={18} weight="bold" /> Importar mi tarjetón
            </Button>
          )}
        </Card>
      </div>
    )
  }

  const effectiveLatestId = latestPayslipId ?? imports[0]?.id ?? null
  const isPinnedOlder = selectionMode === "PINNED" && (effectiveLatestId ? activeId !== effectiveLatestId : false)

  return (
    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Botón para volver al más reciente si está fijado uno anterior */}
      {isPinnedOlder && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--accent)", padding: "0.75rem 1rem", borderRadius: "var(--radius)", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
            Tienes un tarjetón anterior fijado como activo.
          </span>
          <Button variant="secondary" size="sm" onClick={handleResetToLatest} loading={isActivating}>
            <ArrowCounterClockwise size={16} weight="bold" style={{ marginRight: "0.25rem" }} />
            Volver al tarjetón más reciente
          </Button>
        </div>
      )}

      {/* Lista de tarjetones */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {imports.map((imp) => {
          const isCurrentActive = imp.id === activeId
          const isLatestRecord = effectiveLatestId ? imp.id === effectiveLatestId : false

          return (
            <div key={imp.id} data-testid={`tarjeton-card-${imp.id}`}>
              <Card
                padding="1.125rem"
                style={{
                  borderColor: isCurrentActive ? "var(--primary)" : "var(--border)",
                  borderWidth: isCurrentActive ? "2px" : "1px",
                  background: isCurrentActive ? "color-mix(in srgb, var(--primary) 3%, var(--card))" : "var(--card)",
                }}
              >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1, minWidth: 260 }}>
                  <CheckCircle
                    size={22}
                    weight="fill"
                    color={isCurrentActive ? "var(--primary)" : "var(--state-success-fg)"}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--fg)" }}>
                        Tarjetón · {imp.periodRaw ?? "Periodo no detectado"}
                      </span>
                      {isCurrentActive && (
                        <Badge variant="info">
                          <Check size={14} weight="bold" style={{ marginRight: 2 }} /> ACTIVO
                        </Badge>
                      )}
                      {isLatestRecord && (
                        <Badge variant={isCurrentActive ? "neutral" : "info"}>
                          MÁS RECIENTE
                        </Badge>
                      )}
                      {imp.employeeName && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--muted)", background: "var(--accent)", padding: "0.125rem 0.5rem", borderRadius: "var(--radius-pill)" }}>
                          {imp.employeeName}
                        </span>
                      )}
                    </div>

                    {imp.totalNet != null && (
                      <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: isCurrentActive ? "var(--primary)" : "var(--fg)", margin: "0.25rem 0" }}>
                        Neto: ${imp.totalNet.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}

                    <p style={{ fontSize: "var(--text-xs)", color: "var(--muted)", margin: "0.25rem 0 0" }}>
                      Importado el {new Date(imp.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Acciones para el tarjetón */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {!isCurrentActive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActivatingId(imp.id)
                        setActivatingPeriod(imp.periodRaw ?? "este periodo")
                      }}
                      loading={isActivating && activatingId === imp.id}
                    >
                      Usar este tarjetón
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingId(imp.id)}
                    aria-label="Eliminar tarjetón"
                    style={{
                      color: "var(--error)",
                      minWidth: 40,
                      minHeight: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.375rem",
                    }}
                  >
                    <Trash size={18} weight="bold" />
                  </Button>
                </div>
              </div>

              {/* Detalles técnicos y conceptos solo para el activo */}
              {isCurrentActive && (
                <>
                  <div style={{ marginTop: "0.5rem" }}>
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
                        Método de extracción: {imp.extractionMethod === "native_text" ? "Texto digital" : "OCR"} · Confianza: {Math.round(imp.globalConfidence * 100)}%
                      </div>
                    )}
                  </div>

                  {latestConcepts.length > 0 && (
                    <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
                        Conceptos de este tarjetón
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                        {latestConcepts.map((c, i) => (
                          <Link
                            key={`${c.code}-${i}`}
                            href={`/guia/conceptos/${c.code}`}
                            title={`Explicación del concepto ${c.code}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              padding: "0.25rem 0.625rem",
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
                            <Info size={12} weight="fill" aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              </Card>
            </div>
          )
        })}
      </div>

      {/* Upload new button */}
      {(uploadHref || onUploadNew) && (
        <div style={{ marginTop: "0.5rem" }}>
          {uploadHref ? (
            <Link href={uploadHref} style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem", borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              color: "var(--fg)", textDecoration: "none",
              fontWeight: 600, fontSize: "var(--text-sm)",
            }}>
              <Plus size={18} weight="bold" /> Subir otro tarjetón
            </Link>
          ) : (
            <Button variant="secondary" size="md" onClick={onUploadNew}>
              <Plus size={18} weight="bold" /> Subir otro tarjetón
            </Button>
          )}
        </div>
      )}

      {/* Diálogo de confirmación para usar un tarjetón anterior */}
      <ConfirmDialog
        open={activatingId !== null}
        title={`¿Quieres usar el tarjetón de ${activatingPeriod ?? "este periodo"}?`}
        description="Calculadoras, Vacaciones, Guía y las demás herramientas usarán sus datos para calcular tus derechos y nómina."
        confirmLabel="Usar este tarjetón"
        cancelLabel="Cancelar"
        loading={isActivating}
        onConfirm={() => {
          if (activatingId) void handleActivate(activatingId)
        }}
        onCancel={() => {
          setActivatingId(null)
          setActivatingPeriod(null)
        }}
      />

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

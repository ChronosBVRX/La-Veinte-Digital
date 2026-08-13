"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { CheckCircle, Trash, Plus, Info } from "@phosphor-icons/react"

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
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("¿Eliminar este tarjetón?")) return
    setDeleting(id)
    try {
      const res = await fetch("/api/tarjeton/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setImports((prev) => prev.filter((i) => i.id !== id))
    } catch { /* noop */ }
    finally { setDeleting(null) }
  }, [])

  const latest = imports[0]

  return (
    <div style={{ marginTop: "2rem" }}>
      {/* Latest tarjetón highlight */}
      {latest && (
        <Card padding="1rem 1.25rem" style={{ marginBottom: "1rem", borderColor: "var(--primary)", borderWidth: "1.5px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <CheckCircle size={20} weight="fill" color="var(--state-success-fg)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0 0 0.25rem" }}>
                Tu último tarjetón fue de <strong>{latest.periodRaw ?? "este periodo"}</strong>
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
                {latest.employeeName ?? "Trabajador"} · {latest.extractionMethod === "native_text" ? "Texto nativo" : "OCR"}
                {latest.totalNet != null && ` · Neto $${latest.totalNet.toLocaleString()}`}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: "0.375rem" }}>
                {new Date(latest.createdAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(latest.id)}
                loading={deleting === latest.id}
                style={{ color: "var(--error)", padding: "0 0.25rem" }}
              >
                <Trash size={14} />
              </Button>
            </div>
          </div>
          {latestConcepts.length > 0 && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
                Conceptos de tu último tarjetón
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
                      gap: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "9999px",
                      background: c.kind === "earning" ? "#eff6ff" : "#fffbeb",
                      color: c.kind === "earning" ? "var(--info)" : "var(--warning)",
                      fontSize: "0.75rem",
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
        </Card>
      )}

      {/* Upload new button */}
      {onUploadNew && (
        <Button variant="secondary" size="sm" onClick={onUploadNew} style={{ marginBottom: imports.length > 1 ? "1rem" : 0 }}>
          <Plus size={14} /> Subir otro tarjetón
        </Button>
      )}

      {/* Older uploads */}
      {imports.length > 1 && (
        <>
          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", margin: "0 0 0.5rem" }}>
            Anteriores ({imports.length - 1})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {imports.slice(1).map((imp) => (
              <Card key={imp.id} padding="0.625rem 0.875rem">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <CheckCircle size={14} weight="fill" color="var(--state-success-fg)" style={{ flexShrink: 0, opacity: 0.6 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{imp.periodRaw ?? "Sin periodo"}</span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                      Neto ${imp.totalNet?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.625rem", color: "var(--muted)" }}>
                    {new Date(imp.createdAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(imp.id)}
                    loading={deleting === imp.id}
                    style={{ color: "var(--error)", padding: "0 0.25rem" }}
                  >
                    <Trash size={12} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

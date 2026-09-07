"use client"

import { useState } from "react"

export type AiReportCategory =
  | "normativa-incorrecta"
  | "cita-incorrecta"
  | "ofensivo"
  | "datos-personales"
  | "otro"

const CATEGORIES: { value: AiReportCategory; label: string }[] = [
  { value: "normativa-incorrecta", label: "Información normativa incorrecta" },
  { value: "cita-incorrecta", label: "Cita o fuente incorrecta" },
  { value: "ofensivo", label: "Contenido ofensivo o dañino" },
  { value: "datos-personales", label: "Expuso información personal" },
  { value: "otro", label: "Otro" },
]

const STORAGE_KEY = "laveinte-ai-reports-v1"
const RATE_LIMIT_MS = 60_000
const MAX_PER_DAY = 20

function redactPII(text: string): string {
  return text
    .replace(/\b\d{11}\b/g, "[NSS redactado]")
    .replace(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}\b/gi, "[CURP redactada]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[correo redactado]")
    .replace(/\b\d{10}\b/g, "[teléfono redactado]")
    .slice(0, 2000)
}

function readQueue(): { at: number }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { at: number }[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface AiContentReportProps {
  responseId: string
  source?: string
  contentPreview?: string
}

/**
 * Mecanismo interno para reportar contenido generado por IA (exigencia Play).
 * 100% local: guarda el reporte redactado en el dispositivo, confirma recepción,
 * evita duplicados (por responseId) y aplica rate limiting. No envía PII.
 */
export function AiContentReport({ responseId, source, contentPreview }: AiContentReportProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<AiReportCategory>("normativa-incorrecta")
  const [status, setStatus] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = () => {
    try {
      const now = Date.now()
      const queue = readQueue().filter((r) => now - r.at < 24 * 3600_000)
      const reportKey = `laveinte-ai-report-${responseId}`
      if (localStorage.getItem(reportKey)) {
        setStatus("Este contenido ya fue reportado. Gracias por tu aviso.")
        setDone(true)
        setOpen(false)
        return
      }
      if (queue.length >= MAX_PER_DAY) {
        setStatus("Límite diario de reportes alcanzado. Intenta mañana.")
        return
      }
      const last = queue[queue.length - 1]
      if (last && now - last.at < RATE_LIMIT_MS) {
        setStatus("Espera un momento antes de enviar otro reporte.")
        return
      }
      queue.push({ at: now })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
      const record = {
        responseId,
        category,
        source: source ?? "app",
        at: new Date(now).toISOString(),
        preview: redactPII(contentPreview ?? ""),
      }
      localStorage.setItem(reportKey, JSON.stringify(record))
      setStatus("Reporte recibido. Gracias — lo revisaremos.")
      setDone(true)
      setOpen(false)
    } catch {
      setStatus("No fue posible guardar el reporte en este dispositivo.")
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      {!open && !done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Reportar contenido generado por IA"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: "var(--muted)",
            fontSize: "0.72rem",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Reportar contenido
        </button>
      )}
      {open && (
        <div
          role="group"
          aria-label="Reportar contenido generado por IA"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            padding: "0.625rem",
            marginTop: "0.375rem",
            background: "var(--card)",
          }}
        >
          <p style={{ fontSize: "0.72rem", color: "var(--muted)", margin: "0 0 0.375rem" }}>
            Se incluirá una versión redactada del contenido (sin NSS, CURP, correos ni teléfonos).
          </p>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
            Motivo
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AiReportCategory)}
              aria-label="Categoría del reporte"
              style={{
                display: "block",
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.375rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                fontSize: "0.78rem",
                minHeight: 44,
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={submit}
              style={{
                background: "var(--primary)",
                color: "var(--primary-fg)",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.5rem 0.875rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Enviar reporte
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "0.375rem",
                padding: "0.5rem 0.875rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {status && (
        <p role="status" style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.375rem 0 0" }}>
          {status}
        </p>
      )}
    </div>
  )
}

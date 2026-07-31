"use client"

import type { CalculatorPrefillResponse } from "@/shared/contracts/calculator-prefill"
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"

/**
 * Indicador visual del estado del prerrelleno.
 * Mensajes breves, sin saturar la interfaz.
 */

interface Props {
  data: CalculatorPrefillResponse | null
  loading: boolean
  error: string | null
}

type Tone = "confirmed" | "suggested" | "warning" | "muted"

const TONE_STYLES: Record<Tone, { color: string; background: string; border: string }> = {
  confirmed: { color: "var(--success)", background: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.25)" },
  suggested: { color: "var(--info)", background: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.25)" },
  warning: { color: "var(--warning)", background: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.3)" },
  muted: { color: "var(--muted)", background: "var(--accent)", border: "var(--border)" },
}

function Message({ tone, text, secondary }: { tone: Tone; text: string; secondary?: string }) {
  const style = TONE_STYLES[tone]
  const Icon =
    tone === "confirmed" ? CheckCircle2 :
    tone === "warning" ? AlertTriangle :
    tone === "muted" ? XCircle : Info
  return (
    <div style={{
      display: "flex",
      gap: "0.5rem",
      alignItems: "flex-start",
      background: style.background,
      border: `1px solid ${style.border}`,
      borderRadius: "var(--radius)",
      padding: "0.6rem 0.75rem",
      fontSize: "0.8125rem",
      color: "var(--fg)",
    }}>
      <Icon size={16} style={{ color: style.color, flexShrink: 0, marginTop: "0.125rem" }} />
      <div>
        <span style={{ color: style.color, fontWeight: 600 }}>{text}</span>
        {secondary && (
          <p style={{ margin: "0.125rem 0 0", color: "var(--muted)" }}>{secondary}</p>
        )}
      </div>
    </div>
  )
}

function buildMessages(data: CalculatorPrefillResponse): { tone: Tone; text: string; secondary?: string }[] {
  const messages: { tone: Tone; text: string; secondary?: string }[] = []
  const fields = data.fields

  if (data.categoryResolutionStatus === "ambiguous") {
    return [{
      tone: "warning" as const,
      text: "No fue posible identificar tu categoría de forma única.",
      secondary: "Selecciónala manualmente para calcular.",
    }]
  }

  if (data.categoryResolutionStatus === "not_found") {
    return [{
      tone: "warning" as const,
      text: "No pudimos identificar tu categoría. Puedes seleccionarla manualmente.",
    }]
  }

  if (data.categoryResolutionStatus === "missing_profile") {
    return [{
      tone: "muted" as const,
      text: "No fue posible generar valores sugeridos. Puedes capturar los campos manualmente.",
    }]
  }

  const hasSalary = fields.concepto002 !== undefined
  if (hasSalary) {
    messages.push({
      tone: "suggested",
      text: "Valores sugeridos con base en tu categoría y perfil.",
      secondary: "Sueldo obtenido del tabulador vigente. Revisa y pulsa Calcular.",
    })
  } else {
    messages.push({
      tone: "muted",
      text: "Puedes capturar los campos manualmente.",
    })
  }

  const hasPayslip = Object.values(fields).some((f) => f?.source === "last_payslip" || f?.source === "multiple_payslips")
  if (hasPayslip) {
    messages.push({
      tone: "confirmed",
      text: "Un concepto proviene de tu último tarjetón confirmado.",
    })
  }

  const has022 = fields.concepto022 !== undefined
  if (has022) {
    messages.push({
      tone: "warning",
      text: "El concepto 022 (anual por antigüedad) se muestra solo como referencia y no se integra en el cálculo.",
    })
  }

  const requiresConfirmation = Object.values(fields).some((f) => f?.confidence === "requires_confirmation")
  if (requiresConfirmation) {
    messages.push({
      tone: "warning",
      text: "Algunos valores requieren confirmación.",
    })
  }

  if (data.missingFacts.includes("antigüedad")) {
    messages.push({
      tone: "muted",
      text: "Agrega tu antigüedad para obtener prestaciones relacionadas.",
    })
  }
  if (data.missingFacts.some((m) => m.includes("días laborados"))) {
    messages.push({
      tone: "muted",
      text: "Puedes capturar los días laborados manualmente.",
    })
  }
  if (data.missingFacts.some((m) => m.includes("tarjetón") || m.includes("evidencia"))) {
    messages.push({
      tone: "muted",
      text: "Este concepto depende de evidencia en tarjetón que aún no está confirmada.",
    })
  }

  return messages.slice(0, 3)
}

export function PrefillStatus({ data, loading, error }: Props) {
  if (loading) return null
  if (!data) {
    if (!error) return null
    return (
      <Message tone="muted" text="No fue posible obtener valores sugeridos. Puedes capturar los campos manualmente." />
    )
  }

  const messages = buildMessages(data)
  if (messages.length === 0) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {messages.map((m, i) => <Message key={i} tone={m.tone} text={m.text} secondary={m.secondary} />)}
    </div>
  )
}

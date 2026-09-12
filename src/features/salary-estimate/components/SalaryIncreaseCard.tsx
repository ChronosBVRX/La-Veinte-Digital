"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Card } from "@/shared/components/ui/Card"
import { useLiveWorkerContext } from "@/shared/hooks/useLiveWorkerContext"
import { formatCurrency } from "@/features/calculators/lib/money"
import { calculateSalaryIncrease } from "@/features/salary-estimate/lib/calculate-salary-increase"
import { selectSalaryEstimateInputs } from "@/features/salary-estimate/services/salary-estimate-selector"

const IMPORT_HREF = "/profile/mi-informacion-laboral"
const IMPORT_MESSAGE = "Importa tu tarjetón más reciente para conocer tu aumento salarial estimado."

/**
 * Card pequeño en inicio con el aumento quincenal bruto estimado.
 * Lee el tarjetón activo vía `useLiveWorkerContext` (misma fuente que las
 * calculadoras) y se actualiza con `nomina_payslip_updated` + BroadcastChannel.
 * Sin animaciones: respeta `prefers-reduced-motion` por construcción.
 */
export function SalaryIncreaseCard() {
  const context = useLiveWorkerContext(null)

  const result = useMemo(() => {
    const selection = selectSalaryEstimateInputs(context)
    return calculateSalaryIncrease(selection)
  }, [context])

  if (result.calculationStatus === "missing-concept11" && process.env.NODE_ENV !== "production") {
    console.info("[salary-estimate] Concepto 11 no detectado en el tarjetón activo; se muestra mensaje de revisión.")
  }

  if (result.calculationStatus !== "ok") {
    return (
      <section aria-label="Tu aumento estimado" data-testid="salary-estimate-empty" style={{ marginBottom: "var(--space-4)", minWidth: 0, maxWidth: "100%" }}>
        <Card style={{ padding: "var(--space-4)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--fg)", overflowWrap: "break-word" }}>
            Tu aumento estimado
          </p>
          <p style={{ margin: "0.375rem 0 0", fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.5, overflowWrap: "break-word" }}>
            <Link href={IMPORT_HREF} style={{ color: "var(--primary)", fontWeight: 600 }}>
              {IMPORT_MESSAGE}
            </Link>
          </p>
        </Card>
      </section>
    )
  }

  const aumentoFormateado = formatCurrency(result.estimatedFortnightlyIncrease)

  return (
    <section aria-label="Tu aumento estimado" data-testid="salary-estimate-card" style={{ marginBottom: "var(--space-4)", minWidth: 0, maxWidth: "100%" }}>
      <Card style={{ padding: "var(--space-4)" }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--fg)", overflowWrap: "break-word" }}>
          Tu aumento estimado
        </p>
        <p style={{ margin: "0.375rem 0 0", fontSize: "var(--text-sm)", color: "var(--fg)", lineHeight: 1.5, overflowWrap: "break-word" }}>
          Con esta actualización salarial ganarías aproximadamente {aumentoFormateado} más brutos por quincena.
        </p>
        <p style={{ margin: "0.375rem 0 0", fontSize: "var(--text-xs)", color: "var(--muted)", lineHeight: 1.5, overflowWrap: "break-word" }}>
          Estimación basada en tu tarjetón más reciente y sujeta al convenio salarial definitivo.
        </p>
      </Card>
    </section>
  )
}

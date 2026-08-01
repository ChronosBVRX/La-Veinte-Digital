"use client"

import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"

function money(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currencyStyle(value: number | undefined): React.CSSProperties {
  if (value === undefined) return { color: "var(--muted)" }
  return { color: "var(--fg)", fontWeight: 700 }
}

export function Summary({ parsed }: { parsed: ParsedImssTarjeton }) {
  const { payroll, extraction } = parsed
  const { earnings, deductions, totalEarnings, totalDeductions, netPay } = payroll

  const sumEarnings = earnings.reduce((s, l) => s + l.amount, 0)
  const sumDeductions = Math.abs(deductions.reduce((s, l) => s + l.amount, 0))

  const validations = extraction.validations
  const earningsOk = validations.earningsTotalMatches
  const deductionsOk = validations.deductionsTotalMatches
  const netOk = validations.netPayMatches

  const rows: Array<{ label: string; value: number | undefined; computed: number; ok: boolean | null }> = [
    { label: "Percepciones", value: totalEarnings, computed: sumEarnings, ok: earningsOk },
    { label: "Deducciones", value: totalDeductions, computed: sumDeductions, ok: deductionsOk },
  ]

  return (
    <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Resumen del recibo</span>
        <Badge variant="info">
          {extraction.method === "native_text" ? "Texto nativo" : extraction.method === "ocr" ? "OCR" : "Mixto"}
        </Badge>
      </div>

      {rows.map((row) => (
        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
          <span style={{ color: "var(--muted)" }}>{row.label}</span>
          <span style={currencyStyle(row.value)}>
            {money(row.value)}
            {row.ok === null ? null : (
              <Badge variant={row.ok ? "success" : "error"} style={{ marginLeft: "0.375rem" }}>
                {row.ok ? "Cuadra" : "No cuadra"}
              </Badge>
            )}
          </span>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
        <span style={{ fontWeight: 600 }}>Líquido</span>
        <span style={currencyStyle(netPay)}>
          {money(netPay)}
          {netOk !== null && (
            <Badge variant={netOk ? "success" : "error"} style={{ marginLeft: "0.375rem" }}>
              {netOk ? "Coincide" : "Revisa"}
            </Badge>
          )}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem", color: "var(--muted)" }}>
        <span>Conceptos</span>
        <span>{earnings.length} percepciones · {deductions.length} deducciones</span>
      </div>
    </Card>
  )
}

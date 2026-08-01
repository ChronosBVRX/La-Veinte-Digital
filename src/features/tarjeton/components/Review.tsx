"use client"

import { useMemo, useState } from "react"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Badge } from "@/shared/components/ui/Badge"
import { ExtractedField } from "./ExtractedField"
import { Summary } from "./Summary"
import { Differences } from "./Differences"
import { requiresReviewForConfidence } from "@/features/tarjeton/lib/confidence"

interface ReviewProps {
  parsed: ParsedImssTarjeton
  profile: TarjetonProfileSnapshot | null
  confirming: boolean
  onConfirm: (opts: {
    profileUpdates: ConfirmTarjetonRequest["profileUpdates"]
    acknowledgeTotalDifference: boolean
  }) => void
  onCancel: () => void
}

export function Review({ parsed, profile, confirming, onConfirm, onCancel }: ReviewProps) {
  const [updates, setUpdates] = useState<ConfirmTarjetonRequest["profileUpdates"]>({})
  const [acknowledge, setAcknowledge] = useState(false)
  const { employee, payroll, document, extraction, vacations, attendance } = parsed

  const validations = extraction.validations
  const totalsMismatch = Boolean(
    validations.earningsTotalMatches === false ||
    validations.deductionsTotalMatches === false ||
    validations.netPayMatches === false,
  )

  const seniorityNeedsReview = useMemo(
    () => requiresReviewForConfidence(extraction.globalConfidence, true),
    [extraction.globalConfidence],
  )

  const profileFields = [
    { key: "employeeNumber" as const, label: "Matrícula", sensitive: false },
    { key: "fullName" as const, label: "Nombre", sensitive: false },
    { key: "assignmentName" as const, label: "Adscripción", sensitive: false },
    { key: "categoryName" as const, label: "Categoría", sensitive: false },
    { key: "entryDate" as const, label: "Fecha de ingreso", sensitive: false },
  ]

  const conceptRows = [...payroll.earnings, ...payroll.deductions]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Revisa los datos extraídos</div>
          <div style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
            {document.periodRaw || "Periodo no detectado"} · {document.folio ? `Folio ${document.folio}` : "Sin folio"} ·{" "}
            {extraction.method === "native_text" ? "texto nativo" : extraction.method === "ocr" ? "OCR" : "mixto"}
          </div>
        </div>
        <Badge variant={extraction.globalConfidence >= 0.85 ? "success" : "warning"}>
          Confianza global {Math.round(extraction.globalConfidence * 100)}%
        </Badge>
      </div>

      <Differences parsed={parsed} profile={profile} updates={updates} onToggle={(key) => {
        setUpdates((prev) => ({ ...prev, [key]: !prev[key] }))
      }} />

      {totalsMismatch && (
        <Card padding="1rem" style={{ borderColor: "var(--error)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Badge variant="error">Totales no cuadran</Badge>
              <span style={{ fontSize: "0.875rem" }}>
                La suma de conceptos no coincide con los totales declarados. Verifica los importes.
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
                style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
              />
              <span>
                <strong>Entiendo la diferencia</strong> y confirmo que el tarjetón es el correcto.
              </span>
            </label>
          </div>
        </Card>
      )}

      <Summary parsed={parsed} />

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Datos del trabajador</div>
        {profileFields.map((f) => (
          <ExtractedField key={f.key} label={f.label} field={{ value: employee[f.key] ?? null, rawValue: null, page: 1, confidence: extraction.globalConfidence, method: extraction.method, requiresReview: false }} />
        ))}
        {employee.seniority && (
          <ExtractedField label="Antigüedad efectiva" field={{ value: employee.seniority.raw, rawValue: null, page: 1, confidence: extraction.globalConfidence, method: extraction.method, requiresReview: seniorityNeedsReview }} />
        )}
      </Card>

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
          Conceptos ({conceptRows.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "3.5rem 1fr auto", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 600 }}>
          <span>Código</span>
          <span>Descripción</span>
          <span style={{ textAlign: "right" }}>Importe</span>
        </div>
        {conceptRows.map((line) => (
          <div key={`${line.kind}-${line.lineIndex}`} style={{ display: "grid", gridTemplateColumns: "3.5rem 1fr auto", gap: "0.5rem", fontSize: "0.875rem", alignItems: "center" }}>
            <Badge variant={line.kind === "earning" ? "info" : "warning"}>{line.code}</Badge>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.description}</span>
            <span style={{ fontWeight: 600, textAlign: "right", color: line.kind === "deduction" && line.amount < 0 ? "var(--error)" : "var(--fg)" }}>
              {line.amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </Card>

      {(Object.keys(vacations).length > 0 || Object.keys(attendance).length > 0) && (
        <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Asistencia y vacaciones</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
            {Object.entries(attendance).map(([key, value]) => (
              <span key={key} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                {key}: <strong style={{ color: "var(--fg)" }}>{String(value)}</strong>
              </span>
            ))}
            {Object.entries(vacations).map(([key, value]) => (
              <span key={key} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                {key}: <strong style={{ color: "var(--fg)" }}>{String(value)}</strong>
              </span>
            ))}
          </div>
        </Card>
      )}

      {extraction.warnings.length > 0 && (
        <Card padding="1rem" style={{ borderColor: "var(--warning)" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.375rem" }}>Advertencias</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {extraction.warnings.map((w, i) => (
              <li key={i} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>
          Cancelar
        </Button>
        <Button
          onClick={() => onConfirm({ profileUpdates: updates, acknowledgeTotalDifference: acknowledge })}
          disabled={totalsMismatch && !acknowledge}
          loading={confirming}
        >
          Confirmar tarjetón
        </Button>
      </div>
    </div>
  )
}

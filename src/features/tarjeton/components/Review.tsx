"use client"

import { useMemo, useState } from "react"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ReviewedConceptLine } from "@/features/tarjeton/lib/confirm-mark"
import { needsExplicitConfirmation } from "@/features/tarjeton/lib/confirm-mark"
import { requiresReviewForConfidence } from "@/features/tarjeton/lib/confidence"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { Badge } from "@/shared/components/ui/Badge"
import { ExtractedField } from "./ExtractedField"
import { Summary } from "./Summary"
import { Differences } from "./Differences"

interface ReviewProps {
  parsed: ParsedImssTarjeton
  profile: TarjetonProfileSnapshot | null
  confirming: boolean
  onConfirm: (opts: {
    profileUpdates: ConfirmTarjetonRequest["profileUpdates"]
    acknowledgeTotalDifference: boolean
    authorizeServerStorage: boolean
    conceptLines: ReviewedConceptLine[]
  }) => void
  onCancel: () => void
}

const DETAIL_LABELS: Record<string, string> = {
  delays: "Retardos",
  exitPasses: "Pases de salida",
  absences: "Faltas",
  noDelayDays: "Días sin retardo",
  attendanceScore: "Asiduidad",
  incidentFortnight: "Quincena de incidencia",
  generalIllnessLeave: "Incapacidad por enfermedad general",
  occupationalRiskLeave: "Incapacidad por riesgo de trabajo",
  maternityLeave: "Incapacidad por maternidad",
  license140Bis: "Licencia 140 Bis",
  paidLicenses: "Licencias con sueldo",
  unpaidLicenses: "Licencias sin sueldo",
  commissions: "Comisiones",
  trainingCommissions: "Comisiones por capacitación",
  scholarshipWithPay: "Beca con sueldo",
  scholarshipWithoutPay: "Beca sin sueldo",
  concept033Days: "Días del concepto 033",
  enjoyedDays: "Vacaciones disfrutadas",
  daysInYear: "Días de vacaciones en el año",
  twentyYearsOrMoreDays: "Vacaciones por 20 años o más",
  expiredPeriods: "Periodos vacacionales vencidos",
  continuityMark: "Marca de continuidad",
  periodNumberToEnjoy: "Periodo por disfrutar",
  firstPeriodStartRaw: "Inicio del primer periodo",
  secondPeriodStartRaw: "Inicio del segundo periodo",
  accumulatedRetirementDays: "Días acumulados para jubilación",
}

function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function buildFriendlyWarnings(warnings: string[]): string[] {
  const messages: string[] = []
  const unreadEarnings = warnings.filter((warning) => warning.includes("Fila de earning sin interpretar")).length
  const unreadDeductions = warnings.filter((warning) => warning.includes("Fila de deduction sin interpretar")).length

  if (unreadEarnings > 0) messages.push(`No se pudieron leer ${unreadEarnings} percepciones. Revisa la lista de conceptos.`)
  if (unreadDeductions > 0) messages.push(`No se pudieron leer ${unreadDeductions} deducciones. Revisa la lista de conceptos.`)
  if (warnings.some((warning) => warning.includes("suma de percepciones") || warning.includes("suma de deducciones"))) {
    messages.push("Los importes detectados todavía no coinciden con los totales impresos en el tarjetón.")
  }
  if (warnings.some((warning) => warning.includes("Faltan datos laborales críticos"))) {
    messages.push("Falta revisar uno o más datos principales del trabajador.")
  }
  if (warnings.some((warning) => warning.includes("No se detectaron conceptos"))) {
    messages.push("Una de las dos listas de pago quedó vacía. No confirmes hasta revisarla.")
  }

  return [...new Set(messages)]
}

export function Review({ parsed, profile, confirming, onConfirm, onCancel }: ReviewProps) {
  const [updates, setUpdates] = useState<ConfirmTarjetonRequest["profileUpdates"]>({})
  const [acknowledge, setAcknowledge] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [rows, setRows] = useState<ReviewedConceptLine[]>(() =>
    [...parsed.payroll.earnings, ...parsed.payroll.deductions].map((line) => ({
      ...line,
      confirmedByUser: !needsExplicitConfirmation(line.confidence),
    })),
  )

  const { employee, document, extraction, vacations, attendance } = parsed
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
  const friendlyWarnings = useMemo(
    () => buildFriendlyWarnings(extraction.warnings),
    [extraction.warnings],
  )

  const profileFields = [
    { key: "employeeNumber" as const, label: "Matrícula" },
    { key: "fullName" as const, label: "Nombre" },
    { key: "categoryName" as const, label: "Categoría" },
    { key: "entryDate" as const, label: "Fecha de ingreso" },
  ]

  const visibleRows = rows.filter((row) => row.deleted !== true)
  const pendingReview = visibleRows.filter((row) => !row.confirmedByUser)
  const invalidAmounts = visibleRows.some((row) => parseAmount(String(row.amount)) === null)

  function updateRow(lineIndex: number, kind: ReviewedConceptLine["kind"], patch: Partial<ReviewedConceptLine>) {
    setRows((previous) => previous.map((row) => (
      row.lineIndex === lineIndex && row.kind === kind ? { ...row, ...patch } : row
    )))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Revisa los datos detectados</div>
          <div style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
            {document.periodRaw || "Periodo no detectado"} · {document.folio ? `Folio ${document.folio}` : "Sin folio"}
          </div>
        </div>
        <Badge variant={extraction.globalConfidence >= 0.85 ? "success" : "warning"}>
          Calidad de lectura {Math.round(extraction.globalConfidence * 100)}%
        </Badge>
      </div>

      <Differences
        parsed={parsed}
        profile={profile}
        updates={updates}
        onToggle={(key) => setUpdates((previous) => ({ ...previous, [key]: !previous[key] }))}
      />

      {totalsMismatch && (
        <Card padding="1rem" style={{ borderColor: "var(--error)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <Badge variant="error">Revisa los importes</Badge>
              <span style={{ fontSize: "0.875rem" }}>
                La suma de los conceptos no coincide con los totales impresos en el recibo.
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(event) => setAcknowledge(event.target.checked)}
                style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
              />
              <span>Ya revisé los importes y confirmo que deseo continuar.</span>
            </label>
          </div>
        </Card>
      )}

      <Summary parsed={parsed} />

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Datos del trabajador</div>
        {profileFields.map((field) => (
          <ExtractedField
            key={field.key}
            label={field.label}
            field={{
              value: employee[field.key] ?? null,
              rawValue: null,
              page: 1,
              confidence: extraction.globalConfidence,
              method: extraction.method,
              requiresReview: false,
            }}
          />
        ))}
        {employee.seniority && (
          <ExtractedField
            label="Antigüedad efectiva"
            field={{
              value: employee.seniority.raw,
              rawValue: null,
              page: 1,
              confidence: extraction.globalConfidence,
              method: extraction.method,
              requiresReview: seniorityNeedsReview,
            }}
          />
        )}
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", paddingTop: "0.5rem" }}>
          La adscripción no se modifica con el tarjetón; se conserva la que ya tienes guardada en tu perfil.
        </div>
      </Card>

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>Conceptos de pago ({visibleRows.length})</div>
          {pendingReview.length > 0 && <Badge variant="warning">{pendingReview.length} por revisar</Badge>}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Comprueba el código, el nombre y el importe. Puedes corregirlos o eliminar una fila que no pertenezca al tarjetón.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visibleRows.map((row) => {
            const needsConfirm = needsExplicitConfirmation(row.confidence)
            const unconfirmed = !row.confirmedByUser
            return (
              <div
                key={`${row.kind}-${row.lineIndex}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem",
                  borderRadius: "var(--radius-sm)",
                  background: unconfirmed ? "color-mix(in srgb, var(--warning) 12%, var(--card))" : "transparent",
                  flexWrap: "wrap",
                }}
              >
                <Badge variant={row.kind === "earning" ? "info" : "warning"}>
                  {row.kind === "earning" ? "Percepción" : "Deducción"}
                </Badge>
                <Input
                  value={row.code}
                  onChange={(event) => updateRow(row.lineIndex, row.kind, { code: event.target.value })}
                  aria-label={`Código del concepto ${row.lineIndex}`}
                  style={{ width: "4.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <Input
                  value={row.description}
                  onChange={(event) => updateRow(row.lineIndex, row.kind, { description: event.target.value })}
                  aria-label={`Nombre del concepto ${row.lineIndex}`}
                  style={{ flex: 1, minWidth: "12rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <Input
                  value={String(row.amount)}
                  onChange={(event) => {
                    const amount = parseAmount(event.target.value)
                    if (amount !== null) updateRow(row.lineIndex, row.kind, { amount })
                  }}
                  aria-label={`Importe del concepto ${row.lineIndex}`}
                  style={{ width: "7rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", textAlign: "right" }}
                />
                {needsConfirm && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={row.confirmedByUser}
                      onChange={(event) => updateRow(row.lineIndex, row.kind, { confirmedByUser: event.target.checked })}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    Ya lo revisé
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => updateRow(row.lineIndex, row.kind, { deleted: true })}
                  aria-label={`Eliminar concepto ${row.lineIndex}`}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.8125rem",
                  }}
                >
                  Quitar
                </button>
              </div>
            )
          })}
          {visibleRows.length === 0 && (
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              No se detectaron conceptos de pago. Prueba nuevamente con el PDF original.
            </div>
          )}
        </div>
      </Card>

      {(Object.keys(vacations).length > 0 || Object.keys(attendance).length > 0) && (
        <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Asistencia y vacaciones</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
            {[...Object.entries(attendance), ...Object.entries(vacations)].map(([key, value]) => (
              <span key={key} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                {DETAIL_LABELS[key] ?? key}: <strong style={{ color: "var(--fg)" }}>{String(value)}</strong>
              </span>
            ))}
          </div>
        </Card>
      )}

      {friendlyWarnings.length > 0 && (
        <Card padding="1rem" style={{ borderColor: "var(--warning)" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.375rem" }}>Antes de continuar</div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {friendlyWarnings.map((warning) => (
              <li key={warning} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{warning}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="1rem" style={{ borderColor: "var(--primary)" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(event) => setConsentGiven(event.target.checked)}
            style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
          />
          <span>
            <strong>Autorizo guardar los datos confirmados</strong> para usarlos al preparar mi próxima nómina. Podré borrarlos más adelante desde la sección de nómina.
          </span>
        </label>
      </Card>

      {invalidAmounts && (
        <div style={{ fontSize: "0.8125rem", color: "var(--error)" }}>
          Hay un importe inválido. Corrígelo o quita esa fila antes de continuar.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>Cancelar</Button>
        <Button
          onClick={() => onConfirm({
            profileUpdates: updates,
            acknowledgeTotalDifference: acknowledge,
            authorizeServerStorage: consentGiven,
            conceptLines: rows.filter((row) => row.deleted !== true),
          })}
          disabled={(totalsMismatch && !acknowledge) || !consentGiven || invalidAmounts || visibleRows.length === 0}
          loading={confirming}
        >
          Confirmar tarjetón
        </Button>
      </div>
    </div>
  )
}

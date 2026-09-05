"use client"

import { useMemo, useState } from "react"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ReviewedConceptLine } from "@/features/tarjeton/lib/confirm-mark"
import { needsExplicitConfirmation, updateReviewedConcept } from "@/features/tarjeton/lib/confirm-mark"
import { requiresReviewForConfidence } from "@/features/tarjeton/lib/confidence"
import { parseImssMoney } from "@/features/tarjeton/lib/money-parser"
import { formatMexicanDate } from "@/features/tarjeton/lib/imss-date-parser"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { Badge } from "@/shared/components/ui/Badge"
import { Checkbox } from "@/shared/components/ui/Checkbox"
import { ExtractedField } from "./ExtractedField"
import { Summary } from "./Summary"
import { Differences } from "./Differences"
import { ConceptHelp } from "@/shared/components/app/ConceptHelp"

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

export const DETAIL_LABELS: Record<string, string> = {
  delays: "Retardos",
  exitPasses: "Pases de salida",
  absences: "Faltas",
  noDelayDays: "Registros sin retardo",
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
  daysInYear: "Vacaciones en el año",
  twentyYearsOrMoreDays: "Vacaciones por 20 años o más",
  expiredPeriods: "Periodos vacacionales vencidos",
  continuityMark: "Marca de continuidad",
  periodNumberToEnjoy: "Periodo por disfrutar",
  firstPeriodStartRaw: "Inicio del primer periodo",
  secondPeriodStartRaw: "Inicio del segundo periodo",
  accumulatedRetirementDays: "Días acumulados para jubilación",
  porVencer: "Fecha por vencer",
  dueDate: "Fecha por vencer",
}

function parseAmount(value: string): number | null {
  return parseImssMoney(value) ?? null
}

export function buildFriendlyWarnings(warnings: string[]): string[] {
  const messages: string[] = []
  const unreadConcepts = warnings.filter((warning) => warning.includes("Fila de percepción") || warning.includes("Fila de deducción")).length

  if (unreadConcepts > 0) messages.push("No pudimos leer algunos conceptos del tarjetón. Compara la lista con tu recibo antes de continuar.")
  if (warnings.some((warning) => warning.includes("suma de percepciones") || warning.includes("suma de deducciones"))) {
    messages.push("Los importes detectados todavía no coinciden con los totales impresos en el tarjetón.")
  }
  if (warnings.some((warning) => warning.includes("Faltan datos laborales críticos"))) {
    messages.push("Falta revisar uno o más datos principales del trabajador.")
  }
  if (warnings.some((warning) => warning.includes("No se detectaron conceptos"))) {
    messages.push("Una de las dos listas de pago quedó vacía. No confirmes hasta revisarla.")
  }
  if (warnings.some((warning) => warning.includes("Receptor") || warning.includes("datos laborales críticos"))) {
    messages.push("No pudimos confirmar todos los datos del trabajador. Compáralos con tu tarjetón.")
  }
  if (warnings.some((warning) => warning.includes("separar las tablas") || warning.includes("separación de columnas"))) {
    messages.push("No pudimos separar con seguridad percepciones y deducciones. Revisa ambas listas.")
  }
  if (warnings.some((warning) => warning.includes("totales de nómina"))) {
    messages.push("No pudimos leer uno o más totales. Compáralos con el recibo antes de continuar.")
  }
  if (warnings.some((warning) => warning.includes("observaciones"))) {
    messages.push("No pudimos organizar todas las observaciones del tarjetón.")
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
  const fieldConfidences = extraction.fieldConfidences ?? {}
  const seniorityConfidence = fieldConfidences.seniority ?? 0
  const seniorityNeedsReview = requiresReviewForConfidence(seniorityConfidence, true)
  const friendlyWarnings = useMemo(
    () => buildFriendlyWarnings(extraction.warnings),
    [extraction.warnings],
  )

  const profileFields = [
    { key: "employeeNumber" as const, label: "Matrícula" },
    { key: "fullName" as const, label: "Nombre" },
    { key: "categoryName" as const, label: "Categoría" },
    { key: "categoryCode" as const, label: "Clave del puesto" },
    { key: "entryDate" as const, label: "Fecha de ingreso" },
  ]

  const visibleRows = rows.filter((row) => row.deleted !== true)
  const deletedRows = rows.filter((row) => row.deleted === true)
  const pendingReview = visibleRows.filter((row) => !row.confirmedByUser)
  const invalidAmounts = visibleRows.some((row) => parseAmount(String(row.amount)) === null)

  function updateRow(lineIndex: number, kind: ReviewedConceptLine["kind"], patch: Partial<ReviewedConceptLine>) {
    setRows((previous) => updateReviewedConcept(previous, { lineIndex, kind }, patch))
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
            <Checkbox checked={acknowledge} onChange={(event) => setAcknowledge(event.target.checked)} style={{ fontSize: "0.875rem" }}>
              Ya revisé los importes y confirmo que deseo continuar.
            </Checkbox>
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
              confidence: fieldConfidences[field.key] ?? 0,
              method: extraction.method,
              requiresReview: requiresReviewForConfidence(fieldConfidences[field.key] ?? 0, true),
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
              confidence: seniorityConfidence,
              method: extraction.method,
              requiresReview: seniorityNeedsReview,
            }}
          />
        )}
      </Card>

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>Conceptos de pago ({visibleRows.length})</div>
          {pendingReview.length > 0 && <Badge variant="warning">{pendingReview.length} por revisar</Badge>}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Revisa que cada concepto y su importe coincidan con tu tarjetón. Puedes corregir un dato o eliminar una fila que haya sido reconocida por error.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(6rem, 0.8fr) minmax(4.5rem, 0.6fr) minmax(12rem, 2fr) minmax(7rem, 0.8fr) minmax(6rem, 0.8fr)", gap: "0.375rem", color: "var(--muted)", fontSize: "0.75rem", fontWeight: 600, maxWidth: "100%", overflowX: "auto" }}>
          <span>Tipo</span><span>Código</span><span>Descripción</span><span>Importe</span><span>Acción</span>
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
                  value={row.code ?? ""}
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
                {row.code && /^\d{3}$/.test(row.code.trim()) && (
                  <ConceptHelp conceptCode={row.code.trim()} variant="icon" size={18} />
                )}
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
                  <Checkbox
                    checked={row.confirmedByUser}
                    onChange={(event) => updateRow(row.lineIndex, row.kind, { confirmedByUser: event.target.checked })}
                    style={{ alignItems: "center", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                  >
                    Ya lo revisé
                  </Checkbox>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateRow(row.lineIndex, row.kind, { deleted: true })}
                  aria-label={`Eliminar concepto ${row.lineIndex}`}
                >
                  Quitar
                </Button>
              </div>
            )
          })}
          {visibleRows.length === 0 && (
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              No se detectaron conceptos de pago. Prueba nuevamente con el PDF original.
            </div>
          )}
        </div>
        {deletedRows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", borderTop: "1px solid var(--border)", paddingTop: "0.625rem" }}>
            <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: 600 }}>Conceptos quitados</span>
            {deletedRows.map((row) => (
              <div key={`${row.kind}-${row.lineIndex}-deleted`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                <span>{row.kind === "earning" ? "Percepción" : "Deducción"} {row.code}: {row.description}</span>
                <Button variant="ghost" size="sm" onClick={() => updateRow(row.lineIndex, row.kind, { deleted: false })}>Recuperar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(Object.keys(vacations).length > 0 || Object.keys(attendance).length > 0) && (
        <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.25rem" }}>Asistencia y vacaciones</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
            {[...Object.entries(attendance), ...Object.entries(vacations)]
              .filter(([key, value]) => DETAIL_LABELS[key] && value !== undefined && !(key === "dueDate" && vacations.porVencer !== undefined))
              .map(([key, value]) => {
                const displayVal = (key === "porVencer" || key === "dueDate") && typeof value === "string"
                  ? formatMexicanDate(value)
                  : String(value)
                return (
                  <span key={key} style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                    {DETAIL_LABELS[key]}: <strong style={{ color: "var(--fg)" }}>{displayVal}</strong>
                  </span>
                )
              })}
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
        <Checkbox checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} style={{ fontSize: "0.875rem" }}>
          <span>
            <strong>Autorizo guardar los datos confirmados</strong> para usarlos al preparar mi próxima nómina. Podré borrarlos más adelante desde la sección de nómina.
          </span>
        </Checkbox>
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
          disabled={(totalsMismatch && !acknowledge) || !consentGiven || invalidAmounts || visibleRows.length === 0 || pendingReview.length > 0}
          loading={confirming}
        >
          Confirmar tarjetón
        </Button>
      </div>
    </div>
  )
}

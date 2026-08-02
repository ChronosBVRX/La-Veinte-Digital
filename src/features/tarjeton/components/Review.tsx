"use client"

import { useMemo, useState } from "react"
import type { ConfirmTarjetonRequest, ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ReviewedConceptLine } from "@/features/tarjeton/lib/confirm-mark"
import { needsExplicitConfirmation } from "@/features/tarjeton/lib/confirm-mark"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
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
    authorizeServerStorage: boolean
    conceptLines: ReviewedConceptLine[]
  }) => void
  onCancel: () => void
}

function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
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

  const profileFields = [
    { key: "employeeNumber" as const, label: "Matrícula", sensitive: false },
    { key: "fullName" as const, label: "Nombre", sensitive: false },
    { key: "assignmentName" as const, label: "Adscripción", sensitive: false },
    { key: "categoryName" as const, label: "Categoría", sensitive: false },
    { key: "entryDate" as const, label: "Fecha de ingreso", sensitive: false },
  ]

  const visibleRows = rows.filter((row) => row.deleted !== true)
  const pendingReview = rows.filter(
    (row) => row.deleted !== true && !row.confirmedByUser,
  )
  const invalidAmounts = visibleRows.some((row) => parseAmount(String(row.amount)) === null)

  function updateRow(lineIndex: number, patch: Partial<ReviewedConceptLine>) {
    setRows((prev) => prev.map((row) => (row.lineIndex === lineIndex ? { ...row, ...patch } : row)))
  }

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

      <Card padding="1rem" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>Conceptos ({visibleRows.length})</div>
          {pendingReview.length > 0 && (
            <Badge variant="warning">{pendingReview.length} línea(s) por confirmar</Badge>
          )}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Corrige código, descripción o importe, confirma cada línea marcada y elimina falsos positivos del OCR.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {visibleRows.map((row) => {
            const needsConfirm = needsExplicitConfirmation(row.confidence)
            const unconfirmed = !row.confirmedByUser
            return (
              <div
                key={`${row.kind}-${row.lineIndex}`}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.375rem", borderRadius: "var(--radius-sm)",
                  background: unconfirmed ? "color-mix(in srgb, var(--warning) 12%, var(--card))" : "transparent",
                  flexWrap: "wrap",
                }}
              >
                <Badge variant={row.kind === "earning" ? "info" : "warning"}>{row.kind === "earning" ? "P" : "D"}</Badge>
                <Input
                  value={row.code}
                  onChange={(e) => updateRow(row.lineIndex, { code: e.target.value })}
                  aria-label={`Código del concepto ${row.lineIndex}`}
                  style={{ width: "4.5rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <Input
                  value={row.description}
                  onChange={(e) => updateRow(row.lineIndex, { description: e.target.value })}
                  aria-label={`Descripción del concepto ${row.lineIndex}`}
                  style={{ flex: 1, minWidth: "10rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                />
                <Input
                  value={String(row.amount)}
                  onChange={(e) => {
                    const amount = parseAmount(e.target.value)
                    if (amount !== null) updateRow(row.lineIndex, { amount })
                  }}
                  aria-label={`Importe del concepto ${row.lineIndex}`}
                  style={{ width: "7rem", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", textAlign: "right" }}
                />
                {needsConfirm && (
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={row.confirmedByUser}
                      onChange={(e) => updateRow(row.lineIndex, { confirmedByUser: e.target.checked })}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    Confirmar
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => updateRow(row.lineIndex, { deleted: true })}
                  aria-label={`Eliminar concepto ${row.lineIndex}`}
                  style={{
                    background: "transparent", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                    color: "var(--muted)", cursor: "pointer", padding: "0.25rem 0.5rem", fontSize: "0.8125rem",
                  }}
                >
                  Eliminar
                </button>
              </div>
            )
          })}
          {visibleRows.length === 0 && (
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
              No hay conceptos. Si el OCR no reconoció líneas, revisa otro archivo o cancela.
            </div>
          )}
        </div>
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

      <Card padding="1rem" style={{ borderColor: "var(--primary)" }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
          />
          <span>
            <strong>Autorizo guardar mis datos</strong> de este tarjetón (conceptos, asistencias y vacaciones)
            en el servidor para el prerrelleno de mi próxima nómina. Puedo revocarlo o borrarlos desde la pestaña
            de nómina en cualquier momento.
          </span>
        </label>
      </Card>

      {invalidAmounts && (
        <div style={{ fontSize: "0.8125rem", color: "var(--error)" }}>
          Hay importes inválidos: corrígelos o elimina esas líneas antes de confirmar.
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>
          Cancelar
        </Button>
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

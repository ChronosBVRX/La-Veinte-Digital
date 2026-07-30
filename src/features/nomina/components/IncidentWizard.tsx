"use client"

import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { Input, Select } from "@/shared/components/ui/Input"
import type { PayrollIncident, PayrollIncidentType } from "../lib/types"
import { Plus, Trash2, AlertTriangle } from "lucide-react"

interface IncidentWizardProps {
  incidents: PayrollIncident[]
  showForm: boolean
  form: {
    type: PayrollIncidentType | null
    dateFrom: string
    dateTo: string
    hours: string
    days: string
    authorized: boolean | null
    notes: string
  }
  onStartAdding: () => void
  onCancelAdding: () => void
  onUpdateForm: (key: string, value: string | boolean | PayrollIncidentType) => void
  onAddIncident: () => void
  onRemoveIncident: (id: string) => void
}

const INCIDENT_TYPES: { value: PayrollIncidentType; label: string }[] = [
  { value: "absence", label: "Falta" },
  { value: "delay", label: "Retardo" },
  { value: "overtime", label: "Tiempo extra" },
  { value: "weekly_rest_work", label: "Trabajé un descanso semanal" },
  { value: "mandatory_rest_work", label: "Trabajé un día de descanso obligatorio" },
  { value: "vacation", label: "Vacaciones" },
  { value: "paid_leave", label: "Licencia con sueldo" },
  { value: "unpaid_leave", label: "Licencia sin sueldo" },
  { value: "medical_leave", label: "Incapacidad" },
  { value: "maternity_leave", label: "Licencia de maternidad" },
  { value: "temporary_category", label: "Cambio temporal de categoría" },
  { value: "shift_change", label: "Cambio de turno" },
  { value: "manual_adjustment", label: "Otro ajuste" },
]

export function IncidentWizard({
  incidents, showForm, form,
  onStartAdding, onCancelAdding, onUpdateForm,
  onAddIncident, onRemoveIncident,
}: IncidentWizardProps) {
  return (
    <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, margin: 0 }}>
          Incidencias de la quincena
        </h3>
        {!showForm && (
          <Button size="sm" variant="secondary" onClick={onStartAdding}>
            <Plus size={14} /> Agregar
          </Button>
        )}
      </div>

      {incidents.length > 0 && (
        <div style={{ marginBottom: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {incidents.map((inc) => (
            <div key={inc.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
              border: "1px solid var(--border)", fontSize: "0.8125rem",
            }}>
              <div>
                <span style={{ fontWeight: 500 }}>
                  {INCIDENT_TYPES.find((t) => t.value === inc.type)?.label ?? inc.type}
                </span>
                <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                  {inc.dateFrom}{inc.dateTo ? ` - ${inc.dateTo}` : ""}
                  {inc.days ? ` · ${inc.days}d` : ""}
                  {inc.hours ? ` · ${inc.hours}h` : ""}
                </span>
              </div>
              <button
                onClick={() => onRemoveIncident(inc.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "0.25rem" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Select
            id="incident-type"
            label="¿Qué ocurrió?"
            value={form.type ?? ""}
            onChange={(e) => onUpdateForm("type", e.target.value as PayrollIncidentType)}
          >
            <option value="">Seleccionar...</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>

          {form.type && (
            <>
              <Input
                label="Fecha de inicio"
                type="date"
                value={form.dateFrom}
                onChange={(e) => onUpdateForm("dateFrom", e.target.value)}
              />

              {(form.type === "paid_leave" || form.type === "unpaid_leave" || form.type === "medical_leave" || form.type === "maternity_leave" || form.type === "temporary_category" || form.type === "vacation") && (
                <Input
                  label="Fecha de fin"
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => onUpdateForm("dateTo", e.target.value)}
                />
              )}

              {(form.type === "overtime") && (
                <Input
                  label="Horas extra"
                  type="number"
                  min="0"
                  value={form.hours}
                  onChange={(e) => onUpdateForm("hours", e.target.value)}
                />
              )}

              {(form.type === "absence" || form.type === "delay") && (
                <Input
                  label="Días"
                  type="number"
                  min="0"
                  value={form.days}
                  onChange={(e) => onUpdateForm("days", e.target.value)}
                />
              )}

              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
                <AlertTriangle size={12} style={{ verticalAlign: "middle", marginRight: "0.25rem" }} />
                El impacto económico de esta incidencia será calculado según las reglas configuradas.
                {form.type === "absence" && " Las faltas pueden reducir el sueldo base proporcionalmente."}
              </div>

              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <Button variant="ghost" size="sm" onClick={onCancelAdding}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={onAddIncident} disabled={!form.type || !form.dateFrom}>
                  Registrar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

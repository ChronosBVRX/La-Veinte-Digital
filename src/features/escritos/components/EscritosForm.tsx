"use client"

import { Select, Input, Textarea } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"

interface EscritosFormProps {
  tipo: string
  nombre: string
  matricula: string
  adscripcion: string
  categoria: string
  detalle: string
  loading: boolean
  onChange: (field: string, value: string) => void
  onGenerate: () => void
  onClear: () => void
}

const TIPOS_ESCRITO = [
  { value: "solicitud_vacaciones", label: "Solicitud de Vacaciones" },
  { value: "solicitud_permiso", label: "Solicitud de Permiso" },
  { value: "queja_despido", label: "Queja por Despido Injustificado" },
  { value: "solicitud_incapacidad", label: "Solicitud por Incapacidad" },
  { value: "reclamacion_prestaciones", label: "Reclamación de Prestaciones" },
  { value: "solicitud_aumento", label: "Solicitud de Aumento Salarial" },
  { value: "queja_acoso", label: "Queja por Acoso Laboral" },
  { value: "solicitud_cambio", label: "Solicitud de Cambio de Adscripción" },
  { value: "otros", label: "Otro (especificar)" },
]

export function EscritosForm({ tipo, nombre, matricula, adscripcion, categoria, detalle, loading, onChange, onGenerate, onClear }: EscritosFormProps) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
      padding: "1.5rem", marginBottom: "1.5rem",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <Select label="Tipo de escrito" value={tipo} onChange={(e) => onChange("tipo", e.target.value)}>
          <option value="">Seleccionar tipo...</option>
          {TIPOS_ESCRITO.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Input label="Nombre completo" value={nombre} onChange={(e) => onChange("nombre", e.target.value)} placeholder="Nombre del trabajador" />
        <Input label="Matrícula" value={matricula} onChange={(e) => onChange("matricula", e.target.value)} placeholder="Número de matrícula" />
        <Input label="Adscripción" value={adscripcion} onChange={(e) => onChange("adscripcion", e.target.value)} placeholder="Hospital / Unidad / Departamento" />
        <Input label="Categoría" value={categoria} onChange={(e) => onChange("categoria", e.target.value)} placeholder="Puesto / Categoría" />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Textarea
          label="Descripción detallada del caso"
          value={detalle}
          onChange={(e) => onChange("detalle", e.target.value)}
          placeholder="Describe a detalle los hechos, fechas, y todo lo relevante para generar el escrito..."
          rows={6}
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={onGenerate} disabled={loading || !tipo || !detalle.trim()} loading={loading}>
          {loading ? "Generando..." : "Generar Escrito"}
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={loading}>
          Limpiar
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, ArrowDown, CheckCircle, Info, Eye, CaretDown, CaretUp } from "@phosphor-icons/react"
import { Badge } from "@/shared/components/ui/Badge"

export type TarjetonSectionId =
  | "emisor"
  | "receptor"
  | "percepciones-deducciones"
  | "mensajes"
  | "observaciones"

export type ReceptorColumnId = "all" | "col1" | "col2" | "col3"

export interface ReceptorSampleRow {
  fieldId: number
  label: string
  sampleValue: string
  sensitive?: boolean
  highlight?: string
  keyField?: boolean
}

export const RECEPTOR_COLUMNS: ReadonlyArray<{
  id: Exclude<ReceptorColumnId, "all">
  title: string
  shortTitle: string
  compactTitle: string
  rangeLabel: string
  subtitle: string
  color: string
  bgTint: string
  fieldIds: number[]
  rows: ReceptorSampleRow[]
}> = [
  {
    id: "col1",
    title: "Columna Izquierda · Identidad, Adscripción y Plaza",
    shortTitle: "Col. 1 · Datos y Plaza (1–19)",
    compactTitle: "Datos y Plaza",
    rangeLabel: "Campos 1–19",
    subtitle: "Tus datos personales, unidad médica, categoría, jornada, antigüedad, plaza y banco.",
    color: "#1b5e20",
    bgTint: "#f0fdf4",
    fieldIds: Array.from({ length: 19 }, (_, i) => i + 1),
    rows: [
      { fieldId: 1, label: "Matrícula", sampleValue: "99001234", sensitive: true, keyField: true },
      { fieldId: 2, label: "Nombre", sampleValue: "TRABAJADOR(A) EJEMPLO IMSS", sensitive: true },
      { fieldId: 3, label: "RFC", sampleValue: "XXXX000000XX0", sensitive: true },
      { fieldId: 4, label: "CURP", sampleValue: "XXXX000000XXXXXX00", sensitive: true },
      { fieldId: 5, label: "No. Seguridad Social", sampleValue: "00000000000", sensitive: true },
      { fieldId: 6, label: "Tipo de contratación", sampleValue: "Base", highlight: "Base / Confianza / Sustituto", keyField: true },
      { fieldId: 7, label: "Clave de Adscripción", sampleValue: "170349342151273" },
      { fieldId: 8, label: "Nombre de Adscripción", sampleValue: "HOSPITAL GRAL. REGIONAL NO. 1", keyField: true },
      { fieldId: 9, label: "Ubicación", sampleValue: "MORELIA" },
      { fieldId: 10, label: "Clave Est. Org.", sampleValue: "17HA012F00" },
      { fieldId: 11, label: "Clave Categoría/Puesto", sampleValue: "20570080", highlight: "Últimos 2 dígitos = jornada (80 = 8.0 h)", keyField: true },
      { fieldId: 12, label: "Nombre Categoría/Puesto", sampleValue: "TECNICO RADIOLOGO 80", keyField: true },
      { fieldId: 13, label: "Antigüedad efectiva", sampleValue: "14 años 7 qnas 1 días", highlight: "Base de vacaciones y ayuda de renta", keyField: true },
      { fieldId: 14, label: "Plaza", sampleValue: "18422" },
      { fieldId: 15, label: "Marca de ocupación plaza", sampleValue: "00", highlight: "00 = Definitiva (titular)", keyField: true },
      { fieldId: 16, label: "Matrícula titular", sampleValue: "0" },
      { fieldId: 17, label: "Fecha Término", sampleValue: "—" },
      { fieldId: 18, label: "Banco", sampleValue: "BANCOMER" },
      { fieldId: 19, label: "No. Cuenta Bancaria", sampleValue: "000000******0000", sensitive: true },
    ],
  },
  {
    id: "col2",
    title: "Columna Central · Asistencia, Incidencias y 033",
    shortTitle: "Col. 2 · Incidencias (20–39)",
    compactTitle: "Incidencias y 033",
    rangeLabel: "Campos 20–39",
    subtitle: "Retardos, pases, faltas, incapacidades, quincena de incidencia y marcas para estímulo 033.",
    color: "#0369a1",
    bgTint: "#f0f9ff",
    fieldIds: Array.from({ length: 20 }, (_, i) => i + 20),
    rows: [
      { fieldId: 20, label: "Retardos", sampleValue: "0", keyField: true },
      { fieldId: 21, label: "Pases de salida", sampleValue: "3", keyField: true },
      { fieldId: 22, label: "Faltas", sampleValue: "0", keyField: true },
      { fieldId: 23, label: "Sin retardo", sampleValue: "6", highlight: "Cada 10 marcas = 2 días de 033", keyField: true },
      { fieldId: 24, label: "Asiduidad", sampleValue: "1", keyField: true },
      { fieldId: 25, label: "Incapacidad Enf. Gral.", sampleValue: "0" },
      { fieldId: 26, label: "Incapacidad Riesgo de Trab.", sampleValue: "0" },
      { fieldId: 27, label: "Incapacidad Maternidad", sampleValue: "0" },
      { fieldId: 28, label: "Notas de mérito (casos)", sampleValue: "0" },
      { fieldId: 29, label: "Notas de demérito (casos)", sampleValue: "0" },
      { fieldId: 30, label: "Quincena de incidencia", sampleValue: "16", highlight: "Quincena evaluada en estímulos (desfase ~1 mes)", keyField: true },
      { fieldId: 31, label: "Vale a cuenta de aguinaldo", sampleValue: "NO" },
      { fieldId: 32, label: "Comisiones", sampleValue: "0" },
      { fieldId: 33, label: "Comisiones p/ capacitación", sampleValue: "0" },
      { fieldId: 34, label: "Licencias con sueldo", sampleValue: "0" },
      { fieldId: 35, label: "Licencias sin sueldo", sampleValue: "0" },
      { fieldId: 36, label: "Licencias vigencia contrato", sampleValue: "0" },
      { fieldId: 37, label: "Beca sin sueldo", sampleValue: "0" },
      { fieldId: 38, label: "Beca con sueldo", sampleValue: "0" },
      { fieldId: 39, label: "Días concepto 033", sampleValue: "2", highlight: "Días pagados de puntualidad en la qna.", keyField: true },
    ],
  },
  {
    id: "col3",
    title: "Columna Derecha · Periodo, Vacaciones y Créditos",
    shortTitle: "Col. 3 · Vacaciones y SMI (40–59)",
    compactTitle: "Vacaciones y SMI",
    rangeLabel: "Campos 40–59",
    subtitle: "Quincena de pago, capacidad de crédito, vacaciones por vencer, SMI y fecha de ingreso.",
    color: "#6d28d9",
    bgTint: "#f5f3ff",
    fieldIds: Array.from({ length: 20 }, (_, i) => i + 40),
    rows: [
      { fieldId: 40, label: "Periodo de pago", sampleValue: "2A-SEP-2026", keyField: true },
      { fieldId: 41, label: "Método de pago", sampleValue: "Acreditamiento en cuenta" },
      { fieldId: 42, label: "Capacidad de crédito", sampleValue: "76.92", highlight: "Tope disponible para nuevos descuentos", keyField: true },
      { fieldId: 43, label: "Días Labs. en el año", sampleValue: "272" },
      { fieldId: 44, label: "Días pagados en la qna.", sampleValue: "15", keyField: true },
      { fieldId: 45, label: "Vacaciones disfrutadas", sampleValue: "43" },
      { fieldId: 46, label: "Vacs. de 20 años o más", sampleValue: "0" },
      { fieldId: 47, label: "No. de periodo vac. vencidos", sampleValue: "0" },
      { fieldId: 48, label: "Vacaciones en el año", sampleValue: "38" },
      { fieldId: 49, label: "Marca de continuidad", sampleValue: "1" },
      { fieldId: 50, label: "Por vencer", sampleValue: "14102026", highlight: "Formato DDMMAAAA (14/10/2026)", keyField: true },
      { fieldId: 51, label: "No. de periodo por disfrutar", sampleValue: "43", keyField: true },
      { fieldId: 52, label: "Días de Sust. y Temp. Vacs.", sampleValue: "—" },
      { fieldId: 53, label: "Días de vacs. Acum p/jubilación", sampleValue: "0" },
      { fieldId: 54, label: "Inicio (1er Periodo vac.)", sampleValue: "—" },
      { fieldId: 55, label: "Inicio (2o. Periodo vac.)", sampleValue: "—" },
      { fieldId: 56, label: "Crédito INFONAVIT", sampleValue: "1618000000" },
      { fieldId: 57, label: "Sueldo Mensual Integrado", sampleValue: "22,058.60", highlight: "Base de prima vacacional, guardias y 048", keyField: true },
      { fieldId: 58, label: "Fecha de Ingreso", sampleValue: "27/11/2011", keyField: true },
      { fieldId: 59, label: "Marca de crédito", sampleValue: "Credito Infonavit" },
    ],
  },
]

const SAMPLE_PERCEPTIONS = [
  { code: "002", desc: "Sueldo Base Fijo", amount: "3,937.64", note: "Sueldo tabular quincenal" },
  { code: "011", desc: "Ayuda Renta Cláusula 63 Bis Inc b", amount: "3,234.77", note: "Integra aguinaldo y fondo de ahorro" },
  { code: "020", desc: "Ayuda Renta Cláusula 63 Bis Inc a", amount: "250.00", note: "Cuota fija de ayuda de renta" },
  { code: "022", desc: "Ayuda Renta Cláusula 63 Bis Inc c", amount: "1,972.41", note: "Crece según antigüedad efectiva (campo 13)" },
  { code: "032", desc: "Estímulo por Asistencia", amount: "1,721.37", note: "Se detalla en Observaciones (Unidades + QI)" },
  { code: "033", desc: "Estímulo por Puntualidad", amount: "1,147.58", note: "Vinculado a Sin retardo (23) y Días 033 (39)" },
  { code: "050", desc: "Ayuda para Despensa", amount: "200.00", note: "Prestación fija quincenal" },
]

const SAMPLE_DEDUCTIONS = [
  { code: "111", desc: "Aport Complementaria Afore", amount: "2,030.95", note: "Esquema de retiro / generación AFORE" },
  { code: "112", desc: "Fondo Ayuda Sindical por Defunción", amount: "55.31", note: "Aportación mutualista sindical" },
  { code: "151", desc: "ISR", amount: "312.55", note: "Impuesto sobre la renta retenido" },
  { code: "154", desc: "Descuento Crédito INFONAVIT", amount: "2,647.42", note: "Se detalla abajo en Observaciones" },
  { code: "180", desc: "Cuota Sindical", amount: "143.45", note: "Aportación ordinaria SNTSS" },
  { code: "190", desc: "Caja de ahorro préstamo", amount: "1,430.19", note: "En Observaciones muestra pagado y saldo" },
  { code: "192", desc: "Caja de Ahorro Ahorro", amount: "3,720.00", note: "Ahorro voluntario descontado por nómina" },
]

const SAMPLE_OBSERVATIONS = [
  {
    code: "190",
    kind: "deduction" as const,
    title: "Caja de ahorro préstamo",
    importe: "1,430.19",
    vencimiento: "2036010",
    unidades: "240",
    numControl: "17",
    cargoInicial: "343,245.60",
    observaciones: "11,441.52   331,804.08",
    explain: "En préstamos (190, 365, 390), Cargo inicial (76) indica el monto original y en Observaciones (77) aparecen dos cifras: lo ya abonado y el saldo pendiente.",
  },
  {
    code: "154",
    kind: "deduction" as const,
    title: "Crédito INFONAVIT",
    importe: "2,647.42",
    vencimiento: "2065013",
    unidades: "—",
    numControl: "20260729",
    cargoInicial: "—",
    observaciones: "1618000000",
    explain: "Muestra la quincena/año de vencimiento (campo 73), número de control (75) y el número de crédito en Observaciones (77).",
  },
  {
    code: "192",
    kind: "deduction" as const,
    title: "Caja de Ahorro Ahorro",
    importe: "3,720.00",
    vencimiento: "2030012",
    unidades: "98",
    numControl: "17",
    cargoInicial: "—",
    observaciones: "—",
    explain: "Registra el descuento de ahorro vigente, el vencimiento registrado y las unidades o quincenas asociadas.",
  },
  {
    code: "032",
    kind: "perception" as const,
    title: "Estímulo por Asistencia",
    importe: "1,721.37",
    vencimiento: "2026018",
    unidades: "3",
    numControl: "—",
    cargoInicial: "—",
    observaciones: "QI 16",
    explain: "Unidades (74) indica los días pagados (ej. 3 días) y 'QI 16' confirma que corresponde a la Quincena de Incidencia 16 (campo 30).",
  },
]

const SECTION_SHORT_SUMMARIES: Record<TarjetonSectionId, { label: string; summary: string }> = {
  emisor: {
    label: "1. Emisor",
    summary: "Datos fiscales del IMSS como patrón (RFC, Registro Patronal y Folio del comprobante).",
  },
  receptor: {
    label: "2. Receptor (Campos 1–59)",
    summary: "Tus datos personales, adscripción, categoría, incidencias, vacaciones y Sueldo Mensual Integrado en 3 columnas.",
  },
  "percepciones-deducciones": {
    label: "3. Percepciones y Deducciones (Campos 60–70)",
    summary: "Tus pagos (+) a la izquierda, tus descuentos (−) a la derecha y el Líquido neto (70) abajo.",
  },
  mensajes: {
    label: "4. Mensajes",
    summary: "Avisos oficiales del IMSS, convocatorias y recordatorios de validación CFDI.",
  },
  observaciones: {
    label: "5. Observaciones (Campos 71–77)",
    summary: "Tabla de 7 columnas con saldos de préstamos, vencimientos, unidades pagadas y quincena de incidencia (QI).",
  },
}

/**
 * Brújula / Mini-Mapa ultra-compacto e interactivo del Tarjetón IMSS.
 * En móvil mantiene las 3 columnas de Receptor en una sola fila horizontal (como el recibo real)
 * para ocupar la mitad de altura y dejar visible el contenido.
 */
export function TarjetonMiniMap({
  activeSection,
  activeColumn = "all",
  onSelectSection,
  onSelectColumn,
  onJumpToDetail,
  compact = false,
  highlightTarget,
}: {
  activeSection: TarjetonSectionId
  activeColumn?: ReceptorColumnId
  onSelectSection?: (s: TarjetonSectionId) => void
  onSelectColumn?: (c: ReceptorColumnId) => void
  onJumpToDetail?: () => void
  compact?: boolean
  highlightTarget?: {
    section: TarjetonSectionId
    subZone?: "col1" | "col2" | "col3" | "percepciones" | "deducciones" | "liquido" | "obs-link"
    badgeLabel?: string
  }
}) {
  const interactive = !!onSelectSection
  const effectiveSection = highlightTarget?.section ?? activeSection
  const subZone = highlightTarget?.subZone ?? (activeColumn !== "all" ? activeColumn : undefined)

  const zoneStyle = (isSelected: boolean, accent = "#1b5e20", tint = "#dcfce7"): React.CSSProperties => ({
    border: isSelected ? `2px solid ${accent}` : "1px solid #cbd5e1",
    background: isSelected ? tint : "#ffffff",
    borderRadius: 6,
    padding: compact ? "0.3rem 0.45rem" : "0.4rem 0.55rem",
    cursor: interactive ? "pointer" : "default",
    transition: "all 0.15s ease",
    boxShadow: isSelected ? `0 0 0 2px color-mix(in srgb, ${accent} 16%, transparent)` : "none",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
  })

  const activeSummary = SECTION_SHORT_SUMMARIES[effectiveSection]
  const activeColObj =
    effectiveSection === "receptor" && subZone && subZone.startsWith("col")
      ? RECEPTOR_COLUMNS.find((c) => c.id === subZone)
      : null

  return (
    <div
      style={{
        border: "2px solid #1b5e20",
        borderRadius: "var(--radius-md)",
        background: "#f4f8f4",
        padding: compact ? "0.45rem" : "0.625rem",
        boxShadow: "0 2px 8px rgba(27, 94, 32, 0.08)",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Cabecera del Mini-Mapa (sin recortar la palabra IMSS) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.375rem",
          marginBottom: "0.375rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.125rem 0.4rem",
              borderRadius: 4,
              background: "#1b5e20",
              color: "#ffffff",
              fontSize: "0.625rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            IMSS
          </span>
          <span style={{ fontSize: "0.71875rem", fontWeight: 800, color: "#1b5e20", lineHeight: 1.2 }}>
            {interactive ? "Toca una zona del recibo para ver su explicación:" : "Ubicación en tu tarjetón:"}
          </span>
        </div>
        {highlightTarget?.badgeLabel && (
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              padding: "0.1rem 0.45rem",
              borderRadius: 9999,
              background: "#1b5e20",
              color: "#ffffff",
              whiteSpace: "nowrap",
            }}
          >
            {highlightTarget.badgeLabel}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.275rem" }}>
        {/* 1. EMISOR */}
        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onSelectSection?.("emisor")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onSelectSection?.("emisor")
            }
          }}
          style={zoneStyle(effectiveSection === "emisor")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "emisor" ? "#1b5e20" : "#334155" }}>
              1. EMISOR · Recibo de Pago
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 600 }}>RFC / Reg. Patronal / Folio</span>
          </div>
        </div>

        {/* 2. RECEPTOR (3 COLUMNAS EN FILA HORIZONTAL INCLUSO EN MÓVIL) */}
        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => {
            onSelectSection?.("receptor")
            onSelectColumn?.("all")
          }}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onSelectSection?.("receptor")
              onSelectColumn?.("all")
            }
          }}
          style={zoneStyle(effectiveSection === "receptor")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "receptor" ? "#1b5e20" : "#334155" }}>
              2. RECEPTOR · 3 Columnas
            </span>
            <span style={{ fontSize: "0.625rem", color: "#1b5e20", fontWeight: 800 }}>Campos 1–59</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.25rem" }}>
            {RECEPTOR_COLUMNS.map((col, idx) => {
              const colSelected =
                effectiveSection === "receptor" && (subZone === col.id || (!subZone && activeColumn === "all"))
              const isFocusedSingle = effectiveSection === "receptor" && subZone === col.id
              return (
                <div
                  key={col.id}
                  onClick={(e) => {
                    if (!interactive) return
                    e.stopPropagation()
                    onSelectSection?.("receptor")
                    onSelectColumn?.(col.id)
                  }}
                  style={{
                    borderRadius: 4,
                    padding: "0.25rem 0.3rem",
                    border: isFocusedSingle
                      ? `2px solid ${col.color}`
                      : colSelected
                        ? "1px solid #86efac"
                        : "1px dashed #cbd5e1",
                    background: isFocusedSingle ? col.bgTint : colSelected ? "#ffffff" : "#f8fafc",
                    cursor: interactive ? "pointer" : "default",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontSize: "0.625rem", fontWeight: 800, color: col.color, lineHeight: 1.15 }}>
                    Col. {idx + 1} ({col.fieldIds[0]}–{col.fieldIds[col.fieldIds.length - 1]})
                  </div>
                  <div
                    style={{
                      fontSize: "0.5625rem",
                      color: "#475569",
                      lineHeight: 1.2,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.compactTitle}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. PERCEPCIONES Y DEDUCCIONES + LÍQUIDO DEBAJO */}
        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onSelectSection?.("percepciones-deducciones")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onSelectSection?.("percepciones-deducciones")
            }
          }}
          style={zoneStyle(effectiveSection === "percepciones-deducciones")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "percepciones-deducciones" ? "#1b5e20" : "#334155" }}>
              3. PERCEPCIONES Y DEDUCCIONES
            </span>
            <span style={{ fontSize: "0.625rem", color: "#1b5e20", fontWeight: 800 }}>Campos 60–70</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem" }}>
            <div
              style={{
                borderRadius: 4,
                padding: "0.22rem 0.35rem",
                background:
                  effectiveSection === "percepciones-deducciones" && subZone !== "deducciones" && subZone !== "liquido"
                    ? "#ecfdf5"
                    : "#f8fafc",
                border: subZone === "percepciones" ? "2px solid #059669" : "1px solid #a7f3d0",
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: "0.625rem", fontWeight: 800, color: "#047857" }}>+ PERCEPCIONES</div>
              <div style={{ fontSize: "0.5625rem", color: "#475569" }}>60–64 · Pagos</div>
            </div>
            <div
              style={{
                borderRadius: 4,
                padding: "0.22rem 0.35rem",
                background:
                  effectiveSection === "percepciones-deducciones" && subZone !== "percepciones"
                    ? "#fff1f2"
                    : "#f8fafc",
                border: subZone === "deducciones" ? "2px solid #e11d48" : "1px solid #fecdd3",
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: "0.625rem", fontWeight: 800, color: "#be123c" }}>− DEDUCCIONES</div>
              <div style={{ fontSize: "0.5625rem", color: "#475569" }}>65–69 · Descuentos</div>
            </div>
          </div>
          <div
            style={{
              marginTop: "0.22rem",
              borderRadius: 4,
              padding: "0.18rem 0.45rem",
              background: subZone === "liquido" ? "#fef9c3" : "#dcfce7",
              border: subZone === "liquido" ? "2px solid #ca8a04" : "1px solid #16a34a",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: "#14532d" }}>70 · LÍQUIDO (Pago neto a recibir)</span>
            <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: "#14532d", fontFamily: "monospace" }}>64 − 69 = $ Neto</span>
          </div>
        </div>

        {/* 4 y 5 en fila o barras compactas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: "0.275rem" }}>
          <div
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={() => onSelectSection?.("mensajes")}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                onSelectSection?.("mensajes")
              }
            }}
            style={zoneStyle(effectiveSection === "mensajes")}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: effectiveSection === "mensajes" ? "#1b5e20" : "#334155" }}>
              4. MENSAJES
            </div>
            <div style={{ fontSize: "0.5625rem", color: "#64748b" }}>Avisos y CFDI</div>
          </div>

          <div
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={() => onSelectSection?.("observaciones")}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault()
                onSelectSection?.("observaciones")
              }
            }}
            style={zoneStyle(
              effectiveSection === "observaciones" || subZone === "obs-link",
              subZone === "obs-link" ? "#d97706" : "#1b5e20",
              subZone === "obs-link" ? "#fffbeb" : "#dcfce7"
            )}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 800, color: effectiveSection === "observaciones" ? "#1b5e20" : "#334155" }}>
              5. OBSERVACIONES (71–77)
            </div>
            <div style={{ fontSize: "0.5625rem", color: "#475569" }}>Saldos, vencimiento y QI</div>
          </div>
        </div>
      </div>

      {/* Respuesta In-Situ inmediata dentro del mismo mapa al seleccionar en modo interactivo */}
      {interactive && (
        <div
          style={{
            marginTop: "0.45rem",
            padding: "0.5rem 0.65rem",
            borderRadius: 6,
            background: "#1b5e20",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: "#bbf7d0" }}>
              ✓ Viendo: {activeColObj ? `Receptor · ${activeColObj.shortTitle}` : activeSummary.label}
            </div>
            <div style={{ fontSize: "0.71875rem", color: "#ffffff", lineHeight: 1.35, marginTop: 1 }}>
              {activeColObj ? activeColObj.subtitle : activeSummary.summary}
            </div>
          </div>
          {onJumpToDetail && (
            <button
              type="button"
              onClick={onJumpToDetail}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.35rem 0.65rem",
                borderRadius: 9999,
                border: "none",
                background: "#dcfce7",
                color: "#14532d",
                fontSize: "0.6875rem",
                fontWeight: 800,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Ver explicación abajo <ArrowDown size={12} weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Maqueta visual e interactiva de la sección seleccionada con la estética real del Tarjetón IMSS.
 * En PC muestra las 3 columnas reales del Receptor o la tabla partida de Percepciones/Deducciones.
 * En Móvil muestra primero los campos clave sin desbordar y permite expandir todos.
 */
export function TarjetonInteractiveSectionView({
  sectionId,
  receptorColumn,
  onChangeReceptorColumn,
}: {
  sectionId: TarjetonSectionId
  receptorColumn: ReceptorColumnId
  onChangeReceptorColumn: (col: ReceptorColumnId) => void
}) {
  const [mobilePayTab, setMobilePayTab] = useState<"ambos" | "percepciones" | "deducciones">("ambos")
  const [selectedObsCode, setSelectedObsCode] = useState<string>("190")
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({})

  if (sectionId === "emisor") {
    return (
      <div style={imssFrameStyle}>
        <div style={imssGreenHeaderStyle}>
          <span>1. EMISOR · ENCABEZADO DEL COMPROBANTE</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Datos fiscales del patrón</span>
        </div>
        <div className="tarjeton-emisor-grid" style={{ padding: "0.875rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: "2px solid #1b5e20",
                background: "#f0fdf4",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "#1b5e20",
                fontSize: "0.75rem",
                flexShrink: 0,
              }}
            >
              <span>IMSS</span>
            </div>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f172a" }}>Recibo de Pago de Nómina</div>
              <div style={{ fontSize: "0.75rem", color: "#475569" }}>Comprobante quincenal del trabajador</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
            <div><strong style={{ color: "#334155" }}>Nombre:</strong> Instituto Mexicano del Seguro Social</div>
            <div><strong style={{ color: "#334155" }}>RFC:</strong> IMS421231I45</div>
            <div><strong style={{ color: "#334155" }}>Registro Patronal:</strong> <span style={{ color: "#64748b", fontStyle: "italic" }}>▪ C89-00000-00-0 (ejemplo)</span></div>
            <div><strong style={{ color: "#334155" }}>Régimen Fiscal:</strong> Personas Morales con Fines no Lucrativos</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
            <div><strong style={{ color: "#334155" }}>Folio:</strong> <span style={{ fontFamily: "monospace" }}>0000</span></div>
            <div><strong style={{ color: "#334155" }}>No. de Serie CSD:</strong> <span style={{ fontFamily: "monospace", color: "#64748b", wordBreak: "break-all" }}>00001000000721293644</span></div>
          </div>
        </div>
        <div style={imssFooterHintStyle}>
          <Info size={14} color="#1b5e20" style={{ flexShrink: 0 }} />
          <span>
            Este bloque confirma que el recibo fue emitido oficialmente por el IMSS. Tus datos laborales y de pago comienzan justo debajo, en <strong>Receptor</strong>.
          </span>
        </div>
        <style>{`
          .tarjeton-emisor-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          @media (min-width: 680px) {
            .tarjeton-emisor-grid {
              grid-template-columns: 1.1fr 1.5fr 1fr;
              align-items: center;
            }
          }
        `}</style>
      </div>
    )
  }

  if (sectionId === "receptor") {
    const visibleCols =
      receptorColumn === "all"
        ? RECEPTOR_COLUMNS
        : RECEPTOR_COLUMNS.filter((c) => c.id === receptorColumn)

    return (
      <div style={imssFrameStyle}>
        <div style={imssGreenHeaderStyle}>
          <span>2. RECEPTOR · TUS 59 CAMPOS EN 3 COLUMNAS</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca cualquier fila para abrir su explicación</span>
        </div>

        {/* Selector de las 3 columnas reales del Receptor */}
        <div
          style={{
            padding: "0.5rem 0.65rem",
            background: "#f1f5f1",
            borderBottom: "1px solid #c8dcc8",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => onChangeReceptorColumn("all")}
            style={colPillStyle(receptorColumn === "all", "#1b5e20")}
          >
            Las 3 columnas (1–59)
          </button>
          {RECEPTOR_COLUMNS.map((col) => (
            <button
              key={col.id}
              type="button"
              onClick={() => onChangeReceptorColumn(col.id)}
              style={colPillStyle(receptorColumn === col.id, col.color)}
            >
              {col.shortTitle}
            </button>
          ))}
        </div>

        {/* Rejilla de columnas tipo Tarjetón IMSS */}
        <div
          className={receptorColumn === "all" ? "tarjeton-receptor-3col" : "tarjeton-receptor-1col"}
          style={{ padding: "0.625rem" }}
        >
          {visibleCols.map((col) => {
            const isExpanded = !!expandedCols[col.id] || receptorColumn === col.id
            const rowsToRender = isExpanded ? col.rows : col.rows.filter((r) => r.keyField)
            const hiddenCount = col.rows.length - rowsToRender.length

            return (
              <div
                key={col.id}
                style={{
                  border: `1.5px solid color-mix(in srgb, ${col.color} 32%, #cbd5e1)`,
                  borderRadius: 6,
                  background: "#ffffff",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    padding: "0.5rem 0.625rem",
                    background: col.bgTint,
                    borderBottom: `1px solid color-mix(in srgb, ${col.color} 22%, #cbd5e1)`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.25rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: col.color }}>{col.title}</span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.4rem",
                        borderRadius: 9999,
                        background: col.color,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {col.rangeLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#475569", marginTop: 2 }}>{col.subtitle}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {rowsToRender.map((row, idx) => (
                    <Link
                      key={row.fieldId}
                      href={`/guia/campos/${row.fieldId}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.15rem",
                        padding: "0.42rem 0.55rem",
                        textDecoration: "none",
                        background: row.highlight
                          ? "color-mix(in srgb, #fef08a 24%, #ffffff)"
                          : idx % 2 === 0
                            ? "#ffffff"
                            : "#f8fafc",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.375rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 24,
                              height: 18,
                              borderRadius: 4,
                              background: col.bgTint,
                              color: col.color,
                              fontWeight: 800,
                              fontSize: "0.625rem",
                              flexShrink: 0,
                            }}
                          >
                            #{row.fieldId}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: "0.75rem", color: "#0f172a", wordBreak: "break-word" }}>
                            {row.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              color: row.sensitive ? "#64748b" : "#1e293b",
                              background: "#f1f5f9",
                              padding: "0.05rem 0.35rem",
                              borderRadius: 4,
                            }}
                          >
                            {row.sampleValue}
                          </span>
                          <ArrowRight size={11} color="#64748b" />
                        </div>
                      </div>
                      {row.highlight && (
                        <div style={{ fontSize: "0.65rem", color: col.color, fontWeight: 700, paddingLeft: "1.85rem" }}>
                          ↳ {row.highlight}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>

                {receptorColumn === "all" && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCols((prev) => ({
                        ...prev,
                        [col.id]: !isExpanded,
                      }))
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                      width: "100%",
                      padding: "0.45rem",
                      border: "none",
                      borderTop: "1px solid #e2e8f0",
                      background: col.bgTint,
                      color: col.color,
                      fontSize: "0.71875rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {isExpanded ? (
                      <>
                        Mostrar solo campos clave <CaretUp size={13} weight="bold" />
                      </>
                    ) : (
                      <>
                        Ver los {col.rows.length} campos de esta columna (+{hiddenCount} más) <CaretDown size={13} weight="bold" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={imssFooterHintStyle}>
          <Eye size={14} color="#1b5e20" style={{ flexShrink: 0 }} />
          <span>
            <strong>Tip rápido:</strong> toca cualquiera de los botones de arriba (<strong>Col. 1</strong>, <strong>Col. 2</strong> o <strong>Col. 3</strong>) para enfocar una sola columna en tu pantalla.
          </span>
        </div>

        <style>{`
          .tarjeton-receptor-3col {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          @media (min-width: 860px) {
            .tarjeton-receptor-3col {
              grid-template-columns: repeat(3, minmax(0, 1fr));
              align-items: start;
            }
          }
          .tarjeton-receptor-1col {
            display: grid;
            grid-template-columns: 1fr;
          }
        `}</style>
      </div>
    )
  }

  if (sectionId === "percepciones-deducciones") {
    return (
      <div style={imssFrameStyle}>
        <div style={imssGreenHeaderStyle}>
          <span>3. PERCEPCIONES Y DEDUCCIONES · CAMPOS 60–70</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca cualquier concepto o total para ver su ficha</span>
        </div>

        {/* Conmutador rápido para móvil */}
        <div
          style={{
            padding: "0.5rem 0.65rem",
            background: "#f1f5f1",
            borderBottom: "1px solid #c8dcc8",
            display: "flex",
            gap: "0.35rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setMobilePayTab("ambos")}
            style={colPillStyle(mobilePayTab === "ambos", "#1b5e20")}
          >
            Ambos lados
          </button>
          <button
            type="button"
            onClick={() => setMobilePayTab("percepciones")}
            style={colPillStyle(mobilePayTab === "percepciones", "#047857")}
          >
            + Percepciones (60–64)
          </button>
          <button
            type="button"
            onClick={() => setMobilePayTab("deducciones")}
            style={colPillStyle(mobilePayTab === "deducciones", "#be123c")}
          >
            − Deducciones y Líquido (65–70)
          </button>
        </div>

        <div
          className={mobilePayTab === "ambos" ? "tarjeton-pay-split" : "tarjeton-pay-single"}
          style={{ padding: "0.625rem" }}
        >
          {/* Mitad Izquierda: Percepciones */}
          {(mobilePayTab === "ambos" || mobilePayTab === "percepciones") && (
            <div style={{ border: "1px solid #86efac", borderRadius: 6, overflow: "hidden", background: "#fff", minWidth: 0 }}>
              <Link
                href="/guia/campos/60"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.65rem",
                  background: "#dcfce7",
                  borderBottom: "1px solid #86efac",
                  textDecoration: "none",
                  color: "#14532d",
                  fontWeight: 800,
                  fontSize: "0.78125rem",
                  gap: "0.35rem",
                  flexWrap: "wrap",
                }}
              >
                <span>+ PERCEPCIONES (Tus pagos)</span>
                <span style={fieldPinBadge("#15803d")}>Campo 60</span>
              </Link>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.35rem",
                  padding: "0.35rem 0.625rem",
                  background: "#f0fdf4",
                  borderBottom: "1px solid #bbf7d0",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#166534",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/guia/campos/61" style={{ color: "inherit", textDecoration: "underline" }}>[61] Concepto</Link>
                <Link href="/guia/campos/62" style={{ color: "inherit", textDecoration: "underline" }}>[62] Descripción</Link>
                <Link href="/guia/campos/63" style={{ color: "inherit", textDecoration: "underline" }}>[63] Importe</Link>
              </div>

              {SAMPLE_PERCEPTIONS.map((row) => (
                <Link
                  key={row.code}
                  href={`/guia/conceptos/${row.code}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    padding: "0.45rem 0.625rem",
                    borderBottom: "1px solid #f1f5f9",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      color: "#047857",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: 4,
                      padding: "0.1rem 0.35rem",
                      flexShrink: 0,
                    }}
                  >
                    +{row.code}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>{row.desc}</div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>{row.note}</div>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#047857", flexShrink: 0 }}>
                    ${row.amount}
                  </span>
                </Link>
              ))}

              <Link
                href="/guia/campos/64"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.65rem",
                  background: "#f0fdf4",
                  borderTop: "2px solid #16a34a",
                  textDecoration: "none",
                  color: "#14532d",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>[64] Total Percepciones</span>
                <span style={{ fontFamily: "monospace" }}>$14,256.87</span>
              </Link>
            </div>
          )}

          {/* Mitad Derecha: Deducciones + Líquido */}
          {(mobilePayTab === "ambos" || mobilePayTab === "deducciones") && (
            <div style={{ border: "1px solid #fda4af", borderRadius: 6, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column", minWidth: 0 }}>
              <Link
                href="/guia/campos/65"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.65rem",
                  background: "#ffe4e6",
                  borderBottom: "1px solid #fda4af",
                  textDecoration: "none",
                  color: "#881337",
                  fontWeight: 800,
                  fontSize: "0.78125rem",
                  gap: "0.35rem",
                  flexWrap: "wrap",
                }}
              >
                <span>− DEDUCCIONES (Tus descuentos)</span>
                <span style={fieldPinBadge("#be123c")}>Campo 65</span>
              </Link>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "0.35rem",
                  padding: "0.35rem 0.625rem",
                  background: "#fff1f2",
                  borderBottom: "1px solid #fecdd3",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#9f1239",
                  flexWrap: "wrap",
                }}
              >
                <Link href="/guia/campos/66" style={{ color: "inherit", textDecoration: "underline" }}>[66] Concepto</Link>
                <Link href="/guia/campos/67" style={{ color: "inherit", textDecoration: "underline" }}>[67] Descripción</Link>
                <Link href="/guia/campos/68" style={{ color: "inherit", textDecoration: "underline" }}>[68] Importe</Link>
              </div>

              {SAMPLE_DEDUCTIONS.map((row) => (
                <Link
                  key={row.code}
                  href={`/guia/conceptos/${row.code}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    padding: "0.45rem 0.625rem",
                    borderBottom: "1px solid #f1f5f9",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      color: "#be123c",
                      background: "#fff1f2",
                      border: "1px solid #fecdd3",
                      borderRadius: 4,
                      padding: "0.1rem 0.35rem",
                      flexShrink: 0,
                    }}
                  >
                    −{row.code}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>{row.desc}</div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>{row.note}</div>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#be123c", flexShrink: 0 }}>
                    ${row.amount}
                  </span>
                </Link>
              ))}

              <Link
                href="/guia/campos/69"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.65rem",
                  background: "#fff1f2",
                  borderTop: "2px solid #e11d48",
                  textDecoration: "none",
                  color: "#881337",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>[69] Total Deducciones</span>
                <span style={{ fontFamily: "monospace" }}>$10,339.87</span>
              </Link>

              <Link
                href="/guia/campos/70"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.65rem 0.65rem",
                  background: "#1b5e20",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.84375rem",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <span>[70] LÍQUIDO (Lo que recibes neto)</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.9375rem" }}>$3,917.00</span>
              </Link>
            </div>
          )}
        </div>

        <div style={imssFooterHintStyle}>
          <CheckCircle size={14} color="#1b5e20" style={{ flexShrink: 0 }} />
          <span>
            <strong>Fórmula de oro del recibo:</strong> Total Percepciones (<strong>64</strong>) − Total Deducciones (<strong>69</strong>) = <strong>Líquido (70)</strong>.
          </span>
        </div>

        <style>{`
          .tarjeton-pay-split {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          @media (min-width: 760px) {
            .tarjeton-pay-split {
              grid-template-columns: 1fr 1fr;
              align-items: start;
            }
          }
          .tarjeton-pay-single {
            display: grid;
            grid-template-columns: 1fr;
          }
        `}</style>
      </div>
    )
  }

  if (sectionId === "mensajes") {
    return (
      <div style={imssFrameStyle}>
        <div style={imssGreenHeaderStyle}>
          <span>4. MENSAJES · COMUNICADOS INSTITUCIONALES Y AVISOS CFDI</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Franja central del recibo</span>
        </div>
        <div style={{ padding: "0.875rem 1rem", fontSize: "0.75rem", color: "#334155", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ padding: "0.625rem 0.75rem", background: "#f8faf8", border: "1px dashed #86efac", borderRadius: 6 }}>
            <div style={{ fontWeight: 700, color: "#1b5e20", marginBottom: "0.25rem" }}>Ejemplo de avisos en esta región:</div>
            <p style={{ margin: "0 0 0.375rem" }}>
              • <strong>Verificación de datos y CFDI:</strong> &ldquo;VERIFICA TU TARJETÓN DE PAGO. Si presentas algún mensaje de error o la leyenda sin validez fiscal, actualiza tus datos personales en tu Departamento de Personal.&rdquo;
            </p>
            <p style={{ margin: "0 0 0.375rem" }}>
              • <strong>Prestaciones y convenios:</strong> Avisos de Centros Vacacionales IMSS, Tiendas IMSS-SNTSS, Previsión Funeraria o campañas institucionales.
            </p>
            <p style={{ margin: 0 }}>
              • <strong>Jubilados / Pensionados:</strong> Recordatorios de supervivencia o avisos de préstamos a cuenta de pensión.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Sección 5: OBSERVACIONES (Campos 71 al 77)
  const activeObs = SAMPLE_OBSERVATIONS.find((o) => o.code === selectedObsCode) ?? SAMPLE_OBSERVATIONS[0]

  return (
    <div style={imssFrameStyle}>
      <div style={imssGreenHeaderStyle}>
        <span>5. OBSERVACIONES · DESGLOSE DE CRÉDITOS, SALDOS Y UNIDADES (71–77)</span>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca una columna o ejemplo</span>
      </div>

      {/* Columnas 71 a 77 como cabeceras clicables */}
      <div
        style={{
          padding: "0.5rem 0.65rem",
          background: "#f1f5f1",
          borderBottom: "1px solid #c8dcc8",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.3rem",
        }}
      >
        {[
          { id: 71, name: "Concepto" },
          { id: 72, name: "Importe" },
          { id: 73, name: "Vencimiento" },
          { id: 74, name: "Unidades" },
          { id: 75, name: "Núm. Control" },
          { id: 76, name: "Cargo inicial" },
          { id: 77, name: "Observaciones" },
        ].map((col) => (
          <Link
            key={col.id}
            href={`/guia/campos/${col.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.22rem 0.45rem",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px solid #86efac",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#1b5e20",
              textDecoration: "none",
            }}
          >
            <span style={{ background: "#1b5e20", color: "#fff", borderRadius: 4, padding: "0 0.28rem", fontSize: "0.625rem" }}>
              {col.id}
            </span>
            <span>{col.name}</span>
          </Link>
        ))}
      </div>

      {/* Selector de ejemplo real para explorar cómo leer cada caso */}
      <div style={{ padding: "0.65rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "0.45rem" }}>
          Toca un renglón de ejemplo para ver qué significa cada cifra:
        </div>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
          {SAMPLE_OBSERVATIONS.map((row) => {
            const isSel = row.code === activeObs.code
            const accent = row.kind === "perception" ? "#047857" : "#be123c"
            return (
              <button
                key={row.code}
                type="button"
                onClick={() => setSelectedObsCode(row.code)}
                style={colPillStyle(isSel, accent)}
              >
                {row.kind === "perception" ? `+${row.code}` : `−${row.code}`} · {row.title}
              </button>
            )
          })}
        </div>

        {/* Tarjeta responsiva de las 7 columnas de la fila seleccionada */}
        <div
          style={{
            border: "2px solid #1b5e20",
            borderRadius: 8,
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          <div className="tarjeton-obs-grid">
            <ObsCell fieldId={71} label="Concepto" value={activeObs.code} />
            <ObsCell fieldId={72} label="Importe" value={`$${activeObs.importe}`} />
            <ObsCell fieldId={73} label="Vencimiento" value={activeObs.vencimiento} />
            <ObsCell fieldId={74} label="Unidades" value={activeObs.unidades} />
            <ObsCell fieldId={75} label="Núm. Control" value={activeObs.numControl} />
            <ObsCell fieldId={76} label="Cargo inicial" value={activeObs.cargoInicial} />
            <ObsCell fieldId={77} label="Observaciones" value={activeObs.observaciones} wide />
          </div>
          <div
            style={{
              padding: "0.625rem 0.75rem",
              background: "#fffbeb",
              borderTop: "1px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.78125rem", color: "#92400e", lineHeight: 1.5, flex: "1 1 220px" }}>
              <strong>¿Cómo leer este renglón ({activeObs.code})?</strong> {activeObs.explain}
            </p>
            <Link
              href={`/guia/conceptos/${activeObs.code}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#1b5e20",
                textDecoration: "none",
                background: "#dcfce7",
                padding: "0.35rem 0.65rem",
                borderRadius: 6,
              }}
            >
              Ver ficha del {activeObs.code} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .tarjeton-obs-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: #cbd5e1;
        }
        @media (min-width: 720px) {
          .tarjeton-obs-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}

function ObsCell({
  fieldId,
  label,
  value,
  wide = false,
}: {
  fieldId: number
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <Link
      href={`/guia/campos/${fieldId}`}
      style={{
        background: "#ffffff",
        padding: "0.45rem 0.55rem",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        gridColumn: wide ? "span 2" : undefined,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#1b5e20" }}>
        [{fieldId}] {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>
        {value}
      </span>
    </Link>
  )
}

/**
 * Helper para obtener metadatos visuales de ubicación de un campo (1..77)
 */
export function getFieldVisualLocation(fieldId: number): {
  section: TarjetonSectionId
  subZone?: "col1" | "col2" | "col3" | "percepciones" | "deducciones" | "liquido" | "obs-link"
  columnTitle: string
  badgeLabel: string
  accentColor: string
} {
  if (fieldId >= 1 && fieldId <= 19) {
    return {
      section: "receptor",
      subZone: "col1",
      columnTitle: "Receptor · Columna Izquierda (Campos 1–19)",
      badgeLabel: `Campo #${fieldId} · Col. Izquierda`,
      accentColor: "#1b5e20",
    }
  }
  if (fieldId >= 20 && fieldId <= 39) {
    return {
      section: "receptor",
      subZone: "col2",
      columnTitle: "Receptor · Columna Central (Campos 20–39)",
      badgeLabel: `Campo #${fieldId} · Col. Central`,
      accentColor: "#0369a1",
    }
  }
  if (fieldId >= 40 && fieldId <= 59) {
    return {
      section: "receptor",
      subZone: "col3",
      columnTitle: "Receptor · Columna Derecha (Campos 40–59)",
      badgeLabel: `Campo #${fieldId} · Col. Derecha`,
      accentColor: "#6d28d9",
    }
  }
  if (fieldId >= 60 && fieldId <= 64) {
    return {
      section: "percepciones-deducciones",
      subZone: "percepciones",
      columnTitle: "Percepciones · Mitad Izquierda (Campos 60–64)",
      badgeLabel: `Campo #${fieldId} · Percepciones`,
      accentColor: "#047857",
    }
  }
  if (fieldId >= 65 && fieldId <= 69) {
    return {
      section: "percepciones-deducciones",
      subZone: "deducciones",
      columnTitle: "Deducciones · Mitad Derecha (Campos 65–69)",
      badgeLabel: `Campo #${fieldId} · Deducciones`,
      accentColor: "#be123c",
    }
  }
  if (fieldId === 70) {
    return {
      section: "percepciones-deducciones",
      subZone: "liquido",
      columnTitle: "Líquido / Neto a recibir (Campo 70)",
      badgeLabel: "Campo #70 · Líquido",
      accentColor: "#1b5e20",
    }
  }
  return {
    section: "observaciones",
    columnTitle: "Observaciones · Tabla inferior de 7 columnas (Campos 71–77)",
    badgeLabel: `Campo #${fieldId} · Observaciones`,
    accentColor: "#b45309",
  }
}

export function BadgeForConceptKind({ kind, code }: { kind: "perception" | "deduction"; code?: string }) {
  const isPerc = kind === "perception"
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.2rem 0.55rem",
        borderRadius: 6,
        fontFamily: "monospace",
        fontWeight: 800,
        fontSize: "0.75rem",
        background: isPerc ? "#ecfdf5" : "#fff1f2",
        color: isPerc ? "#047857" : "#be123c",
        border: `1px solid ${isPerc ? "#a7f3d0" : "#fecdd3"}`,
      }}
    >
      {isPerc ? "+" : "−"}
      {code ?? (isPerc ? "Percepción" : "Deducción")}
    </span>
  )
}

const imssFrameStyle: React.CSSProperties = {
  border: "2px solid #1b5e20",
  borderRadius: "var(--radius-md)",
  background: "#ffffff",
  overflow: "hidden",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
}

const imssGreenHeaderStyle: React.CSSProperties = {
  background: "#1b5e20",
  color: "#ffffff",
  padding: "0.5rem 0.75rem",
  fontSize: "0.75rem",
  fontWeight: 800,
  letterSpacing: "0.02em",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.375rem",
}

const imssFooterHintStyle: React.CSSProperties = {
  padding: "0.55rem 0.75rem",
  background: "#f0fdf4",
  borderTop: "1px solid #bbf7d0",
  fontSize: "0.75rem",
  color: "#14532d",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  lineHeight: 1.45,
}

function colPillStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: "0.3rem 0.6rem",
    borderRadius: 9999,
    border: active ? `1.5px solid ${color}` : "1px solid #cbd5e1",
    background: active ? color : "#ffffff",
    color: active ? "#ffffff" : "#334155",
    fontSize: "0.71875rem",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.15s ease",
  }
}

function fieldPinBadge(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#ffffff",
    padding: "0.1rem 0.45rem",
    borderRadius: 9999,
    fontSize: "0.6875rem",
    fontWeight: 700,
  }
}

export { Badge }

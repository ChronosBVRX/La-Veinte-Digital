"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle, Info, Eye } from "@phosphor-icons/react"
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
}

export const RECEPTOR_COLUMNS: ReadonlyArray<{
  id: Exclude<ReceptorColumnId, "all">
  title: string
  shortTitle: string
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
    shortTitle: "Col. Izquierda (1–19)",
    rangeLabel: "Campos 1 al 19",
    subtitle: "Tus datos personales, unidad médica, categoría, jornada, antigüedad, plaza y banco.",
    color: "#1b5e20",
    bgTint: "#f0fdf4",
    fieldIds: Array.from({ length: 19 }, (_, i) => i + 1),
    rows: [
      { fieldId: 1, label: "Matrícula:", sampleValue: "99001234", sensitive: true },
      { fieldId: 2, label: "Nombre:", sampleValue: "TRABAJADOR(A) EJEMPLO IMSS", sensitive: true },
      { fieldId: 3, label: "RFC:", sampleValue: "XXXX000000XX0", sensitive: true },
      { fieldId: 4, label: "CURP:", sampleValue: "XXXX000000XXXXXX00", sensitive: true },
      { fieldId: 5, label: "No. Seguridad Social:", sampleValue: "00000000000", sensitive: true },
      { fieldId: 6, label: "Tipo de contratación:", sampleValue: "Base", highlight: "Base / Confianza / Sustituto" },
      { fieldId: 7, label: "Clave de Adscripción:", sampleValue: "170349342151273" },
      { fieldId: 8, label: "Nombre de Adscripción:", sampleValue: "HOSPITAL GENERAL REGIONAL NO. 1" },
      { fieldId: 9, label: "Ubicación:", sampleValue: "MORELIA" },
      { fieldId: 10, label: "Clave Est. Org.:", sampleValue: "17HA012F00" },
      { fieldId: 11, label: "Clave Categoría/Puesto:", sampleValue: "20570080", highlight: "Últimos 2 dígitos = jornada (80 = 8.0 h)" },
      { fieldId: 12, label: "Nombre Categoría/Puesto:", sampleValue: "TECNICO RADIOLOGO   80" },
      { fieldId: 13, label: "Antigüedad efectiva:", sampleValue: "14 años 7 qnas 1 días", highlight: "Base de vacaciones y ayuda de renta" },
      { fieldId: 14, label: "Plaza:", sampleValue: "18422" },
      { fieldId: 15, label: "Marca de ocupación plaza:", sampleValue: "00", highlight: "00 = Definitiva (titular)" },
      { fieldId: 16, label: "Matrícula titular:", sampleValue: "0" },
      { fieldId: 17, label: "Fecha Término:", sampleValue: "—" },
      { fieldId: 18, label: "Banco:", sampleValue: "BANCOMER" },
      { fieldId: 19, label: "No. Cuenta Bancaria:", sampleValue: "000000******0000", sensitive: true },
    ],
  },
  {
    id: "col2",
    title: "Columna Central · Asistencia, Incidencias y 033",
    shortTitle: "Col. Central (20–39)",
    rangeLabel: "Campos 20 al 39",
    subtitle: "Retardos, pases, faltas, incapacidades, quincena de incidencia y marcas para estímulo 033.",
    color: "#0369a1",
    bgTint: "#f0f9ff",
    fieldIds: Array.from({ length: 20 }, (_, i) => i + 20),
    rows: [
      { fieldId: 20, label: "Retardos:", sampleValue: "0" },
      { fieldId: 21, label: "Pases de salida:", sampleValue: "3" },
      { fieldId: 22, label: "Faltas:", sampleValue: "0" },
      { fieldId: 23, label: "Sin retardo:", sampleValue: "6", highlight: "Cada 10 marcas = 2 días de 033" },
      { fieldId: 24, label: "Asiduidad:", sampleValue: "1" },
      { fieldId: 25, label: "Incapacidad Enf. Gral.:", sampleValue: "0" },
      { fieldId: 26, label: "Incapacidad Riesgo de Trab.:", sampleValue: "0" },
      { fieldId: 27, label: "Incapacidad Maternidad:", sampleValue: "0" },
      { fieldId: 28, label: "Notas de mérito (casos):", sampleValue: "0" },
      { fieldId: 29, label: "Notas de demérito (casos):", sampleValue: "0" },
      { fieldId: 30, label: "Quincena de incidencia:", sampleValue: "16", highlight: "Quincena evaluada en estímulos (desfase ~1 mes)" },
      { fieldId: 31, label: "Vale a cuenta de aguinaldo:", sampleValue: "NO" },
      { fieldId: 32, label: "Comisiones:", sampleValue: "0" },
      { fieldId: 33, label: "Comisiones p/ capacitación:", sampleValue: "0" },
      { fieldId: 34, label: "Licencias con sueldo:", sampleValue: "0" },
      { fieldId: 35, label: "Licencias sin sueldo:", sampleValue: "0" },
      { fieldId: 36, label: "Licencias vigencia contrato:", sampleValue: "0" },
      { fieldId: 37, label: "Beca sin sueldo:", sampleValue: "0" },
      { fieldId: 38, label: "Beca con sueldo:", sampleValue: "0" },
      { fieldId: 39, label: "Días concepto 033:", sampleValue: "2", highlight: "Días pagados de puntualidad en la qna." },
    ],
  },
  {
    id: "col3",
    title: "Columna Derecha · Periodo, Vacaciones y Créditos",
    shortTitle: "Col. Derecha (40–59)",
    rangeLabel: "Campos 40 al 59",
    subtitle: "Quincena de pago, capacidad de crédito, vacaciones por vencer, SMI y fecha de ingreso.",
    color: "#6d28d9",
    bgTint: "#f5f3ff",
    fieldIds: Array.from({ length: 20 }, (_, i) => i + 40),
    rows: [
      { fieldId: 40, label: "Periodo de pago:", sampleValue: "2A-SEP-2026" },
      { fieldId: 41, label: "Método de pago:", sampleValue: "Acreditamiento en cuenta" },
      { fieldId: 42, label: "Capacidad de crédito:", sampleValue: "76.92", highlight: "Tope disponible para nuevos descuentos" },
      { fieldId: 43, label: "Días Labs. en el año:", sampleValue: "272" },
      { fieldId: 44, label: "Días pagados en la qna.:", sampleValue: "15" },
      { fieldId: 45, label: "Vacaciones disfrutadas:", sampleValue: "43" },
      { fieldId: 46, label: "Vacs. de 20 años o más:", sampleValue: "0" },
      { fieldId: 47, label: "No. de periodo vac. vencidos:", sampleValue: "0" },
      { fieldId: 48, label: "Vacaciones en el año:", sampleValue: "38" },
      { fieldId: 49, label: "Marca de continuidad:", sampleValue: "1" },
      { fieldId: 50, label: "Por vencer:", sampleValue: "14102026", highlight: "Formato DDMMAAAA (14/10/2026)" },
      { fieldId: 51, label: "No. de periodo por disfrutar:", sampleValue: "43" },
      { fieldId: 52, label: "Días de Sust. y Temp. Vacs.:", sampleValue: "—" },
      { fieldId: 53, label: "Días de vacs. Acum p/jubilación:", sampleValue: "0" },
      { fieldId: 54, label: "Inicio (1er Periodo vac.):", sampleValue: "—" },
      { fieldId: 55, label: "Inicio (2o. Periodo vac.):", sampleValue: "—" },
      { fieldId: 56, label: "Crédito INFONAVIT:", sampleValue: "1618000000" },
      { fieldId: 57, label: "Sueldo Mensual Integrado:", sampleValue: "22,058.60", highlight: "Base de prima vacacional, guardias y 048" },
      { fieldId: 58, label: "Fecha de Ingreso:", sampleValue: "27/11/2011" },
      { fieldId: 59, label: "Marca de crédito:", sampleValue: "Credito Infonavit" },
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
    code: "154",
    kind: "deduction" as const,
    title: "Crédito INFONAVIT",
    importe: "2,647.42",
    vencimiento: "2065013",
    unidades: "—",
    numControl: "20260729",
    cargoInicial: "—",
    observaciones: "1618000000",
    explain: "Muestra la quincena/año de vencimiento (campo 73), número de control (75) y el número de crédito en el texto de Observaciones (77).",
  },
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
    explain: "En préstamos (como 190 o 365/390), Cargo inicial (76) indica el monto total y en Observaciones (77) suelen aparecer dos cifras: lo ya abonado y el saldo pendiente por pagar.",
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
    explain: "Registra el descuento de ahorro vigente, el plazo o vencimiento registrado y las unidades o quincenas asociadas.",
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
    explain: "Las percepciones también dejan rastro aquí: Unidades (74) indica los días pagados (ej. 3 días) y 'QI 16' confirma que corresponde a la Quincena de Incidencia 16 (campo 30).",
  },
]

/**
 * Brújula / Mini-Mapa interactivo del Tarjetón IMSS.
 * Muestra las 5 zonas anatómicas con la proporción real del recibo y resalta la sección activa.
 */
export function TarjetonMiniMap({
  activeSection,
  activeColumn = "all",
  onSelectSection,
  onSelectColumn,
  compact = false,
  highlightTarget,
}: {
  activeSection: TarjetonSectionId
  activeColumn?: ReceptorColumnId
  onSelectSection?: (s: TarjetonSectionId) => void
  onSelectColumn?: (c: ReceptorColumnId) => void
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
    border: isSelected ? `2px solid ${accent}` : "1px solid #94a3b8",
    background: isSelected ? tint : "#ffffff",
    borderRadius: 5,
    padding: compact ? "0.3rem 0.45rem" : "0.45rem 0.6rem",
    cursor: interactive ? "pointer" : "default",
    transition: "all 0.18s ease",
    boxShadow: isSelected ? `0 0 0 2px color-mix(in srgb, ${accent} 18%, transparent)` : "none",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
  })

  return (
    <div
      style={{
        border: "2px solid #1b5e20",
        borderRadius: "var(--radius-md)",
        background: "#f8faf8",
        padding: compact ? "0.5rem" : "0.75rem",
        boxShadow: "0 2px 8px rgba(27, 94, 32, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginBottom: compact ? "0.375rem" : "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "#1b5e20",
              color: "#fff",
              fontSize: "0.625rem",
              fontWeight: 800,
              letterSpacing: "0.02em",
            }}
          >
            IMSS
          </span>
          <span style={{ fontSize: compact ? "0.6875rem" : "0.75rem", fontWeight: 700, color: "#1b5e20" }}>
            {interactive ? "Mapa interactivo del recibo (toca una región)" : "Ubicación en tu tarjetón"}
          </span>
        </div>
        {highlightTarget?.badgeLabel && (
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "0.125rem 0.5rem",
              borderRadius: 9999,
              background: "#1b5e20",
              color: "#ffffff",
            }}
          >
            {highlightTarget.badgeLabel}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? "0.3rem" : "0.4rem" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "emisor" ? "#1b5e20" : "#334155" }}>
              1. EMISOR · Recibo de Pago de Nómina
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b", fontWeight: 600 }}>RFC / Registro Patronal / Folio</span>
          </div>
        </div>

        {/* 2. RECEPTOR (3 COLUMNAS) */}
        <div
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={() => onSelectSection?.("receptor")}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault()
              onSelectSection?.("receptor")
            }
          }}
          style={zoneStyle(effectiveSection === "receptor")}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "receptor" ? "#1b5e20" : "#334155" }}>
              2. RECEPTOR · 59 Campos en 3 Columnas
            </span>
            <span style={{ fontSize: "0.625rem", color: "#1b5e20", fontWeight: 700 }}>Campos 1–59</span>
          </div>
          <div className="tarjeton-minimap-receptor-grid">
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
                    padding: compact ? "0.25rem 0.35rem" : "0.35rem 0.45rem",
                    border: isFocusedSingle
                      ? `2px solid ${col.color}`
                      : colSelected
                        ? "1px solid #86efac"
                        : "1px dashed #cbd5e1",
                    background: isFocusedSingle ? col.bgTint : colSelected ? "#ffffff" : "#f8fafc",
                    cursor: interactive ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontSize: "0.625rem", fontWeight: 800, color: col.color }}>
                    Col. {idx + 1} ({col.fieldIds[0]}–{col.fieldIds[col.fieldIds.length - 1]})
                  </div>
                  <div style={{ fontSize: "0.5625rem", color: "#475569", lineHeight: 1.25, marginTop: 1 }}>
                    {idx === 0 ? "Datos, Categoría y Plaza" : idx === 1 ? "Incidencias, Retardos y 033" : "Pago, Vacaciones y SMI"}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. PERCEPCIONES Y DEDUCCIONES */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", flexWrap: "wrap", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "percepciones-deducciones" ? "#1b5e20" : "#334155" }}>
              3. PERCEPCIONES Y DEDUCCIONES
            </span>
            <span style={{ fontSize: "0.625rem", color: "#1b5e20", fontWeight: 700 }}>Campos 60–70</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" }}>
            <div
              style={{
                borderRadius: 4,
                padding: compact ? "0.25rem 0.35rem" : "0.35rem 0.45rem",
                background:
                  effectiveSection === "percepciones-deducciones" && subZone !== "deducciones" && subZone !== "liquido"
                    ? "#ecfdf5"
                    : "#f8fafc",
                border:
                  subZone === "percepciones"
                    ? "2px solid #059669"
                    : "1px solid #a7f3d0",
              }}
            >
              <div style={{ fontSize: "0.625rem", fontWeight: 800, color: "#047857" }}>+ PERCEPCIONES (60–64)</div>
              <div style={{ fontSize: "0.5625rem", color: "#475569" }}>Claves 001 a 084 · Ingresos</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <div
                style={{
                  borderRadius: 4,
                  padding: compact ? "0.2rem 0.35rem" : "0.25rem 0.45rem",
                  background:
                    effectiveSection === "percepciones-deducciones" && subZone !== "percepciones"
                      ? "#fff1f2"
                      : "#f8fafc",
                  border:
                    subZone === "deducciones"
                      ? "2px solid #e11d48"
                      : "1px solid #fecdd3",
                }}
              >
                <div style={{ fontSize: "0.625rem", fontWeight: 800, color: "#be123c" }}>− DEDUCCIONES (65–69)</div>
                <div style={{ fontSize: "0.5625rem", color: "#475569" }}>Claves 104 a 199 · Descuentos</div>
              </div>
              <div
                style={{
                  borderRadius: 4,
                  padding: "0.15rem 0.4rem",
                  background: subZone === "liquido" ? "#fef9c3" : "#dcfce7",
                  border: subZone === "liquido" ? "2px solid #ca8a04" : "1px solid #16a34a",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: "#14532d" }}>70 · LÍQUIDO (NETO)</span>
                <span style={{ fontSize: "0.5625rem", fontWeight: 800, color: "#14532d" }}>$ Neto</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. MENSAJES */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "mensajes" ? "#1b5e20" : "#334155" }}>
              4. MENSAJES · Avisos institucionales
            </span>
            <span style={{ fontSize: "0.625rem", color: "#64748b" }}>Comunicados y recordatorios CFDI</span>
          </div>
        </div>

        {/* 5. OBSERVACIONES */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 800, color: effectiveSection === "observaciones" ? "#1b5e20" : "#334155" }}>
              5. OBSERVACIONES · Desglose de préstamos, créditos y unidades
            </span>
            <span style={{ fontSize: "0.625rem", color: "#1b5e20", fontWeight: 700 }}>Campos 71–77 (7 columnas)</span>
          </div>
        </div>
      </div>

      <style>{`
        .tarjeton-minimap-receptor-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.3rem;
        }
        @media (min-width: 560px) {
          .tarjeton-minimap-receptor-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Maqueta visual e interactiva de la sección seleccionada con la estética real del Tarjetón IMSS.
 * En PC muestra las 3 columnas reales del Receptor o la tabla partida de Percepciones/Deducciones.
 * En Móvil permite alternar por columna o tipo sin desbordar la pantalla.
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

  if (sectionId === "emisor") {
    return (
      <div style={imssFrameStyle}>
        <div style={imssGreenHeaderStyle}>
          <span>EMISOR · ENCABEZADO DEL COMPROBANTE</span>
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
            <div><strong style={{ color: "#334155" }}>No. de Serie CSD:</strong> <span style={{ fontFamily: "monospace", color: "#64748b" }}>00001000000721293644</span></div>
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
          <span>RECEPTOR · DATOS DEL TRABAJADOR, INCIDENCIAS Y VACACIONES</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca cualquier fila para abrir su ficha</span>
        </div>

        {/* Selector de las 3 columnas reales del Receptor */}
        <div
          style={{
            padding: "0.625rem 0.75rem",
            background: "#f1f5f1",
            borderBottom: "1px solid #c8dcc8",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.375rem",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1b5e20", marginRight: "0.25rem" }}>
            Ver columna:
          </span>
          <button
            type="button"
            onClick={() => onChangeReceptorColumn("all")}
            style={colPillStyle(receptorColumn === "all", "#1b5e20")}
          >
            Vista 3 columnas (1–59)
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
          style={{ padding: "0.75rem" }}
        >
          {visibleCols.map((col) => (
            <div
              key={col.id}
              style={{
                border: `1px solid color-mix(in srgb, ${col.color} 28%, #cbd5e1)`,
                borderRadius: 6,
                background: "#ffffff",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 0.625rem",
                  background: col.bgTint,
                  borderBottom: `1px solid color-mix(in srgb, ${col.color} 22%, #cbd5e1)`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.25rem" }}>
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
                {col.rows.map((row, idx) => (
                  <Link
                    key={row.fieldId}
                    href={`/guia/campos/${row.fieldId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1.15fr) minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.35rem 0.5rem",
                      fontSize: "0.71875rem",
                      textDecoration: "none",
                      background: row.highlight
                        ? "color-mix(in srgb, #fef08a 22%, #ffffff)"
                        : idx % 2 === 0
                          ? "#ffffff"
                          : "#f8fafc",
                      borderBottom: idx === col.rows.length - 1 ? "none" : "1px solid #f1f5f9",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 22,
                        height: 18,
                        borderRadius: 4,
                        background: col.bgTint,
                        color: col.color,
                        fontWeight: 800,
                        fontSize: "0.625rem",
                      }}
                    >
                      {row.fieldId}
                    </span>
                    <span style={{ fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.6875rem",
                        color: row.sensitive ? "#64748b" : "#0f172a",
                        fontStyle: row.sensitive ? "italic" : "normal",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {row.sampleValue}
                    </span>
                    <ArrowRight size={11} color="#94a3b8" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={imssFooterHintStyle}>
          <Eye size={14} color="#1b5e20" style={{ flexShrink: 0 }} />
          <span>
            <strong>Datos de ejemplo anonimizados:</strong> las filas sombreadas en amarillo suave (como <strong>11 Categoría</strong>, <strong>13 Antigüedad</strong>, <strong>30 Quincena de incidencia</strong>, <strong>50 Por vencer</strong> y <strong>57 SMI</strong>) son las que más impactan tus pagos.
          </span>
        </div>

        <style>{`
          .tarjeton-receptor-3col {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          @media (min-width: 840px) {
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
          <span>PERCEPCIONES Y DEDUCCIONES · TABLA PARTIDA (CAMPOS 60–70)</span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca un concepto o columna para ver su detalle</span>
        </div>

        {/* Conmutador rápido para móvil */}
        <div
          style={{
            padding: "0.5rem 0.75rem",
            background: "#f1f5f1",
            borderBottom: "1px solid #c8dcc8",
            display: "flex",
            gap: "0.375rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setMobilePayTab("ambos")}
            style={colPillStyle(mobilePayTab === "ambos", "#1b5e20")}
          >
            Vista lado a lado
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
          style={{ padding: "0.75rem" }}
        >
          {/* Mitad Izquierda: Percepciones */}
          {(mobilePayTab === "ambos" || mobilePayTab === "percepciones") && (
            <div style={{ border: "1px solid #86efac", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
              <Link
                href="/guia/campos/60"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "#dcfce7",
                  borderBottom: "1px solid #86efac",
                  textDecoration: "none",
                  color: "#14532d",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>+ PERCEPCIONES (Tus pagos)</span>
                <span style={fieldPinBadge("#15803d")}>Campo 60</span>
              </Link>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "4.25rem 1fr 5.5rem",
                  padding: "0.35rem 0.625rem",
                  background: "#f0fdf4",
                  borderBottom: "1px solid #bbf7d0",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                <Link href="/guia/campos/61" style={{ color: "inherit", textDecoration: "underline" }}>61 Concepto</Link>
                <Link href="/guia/campos/62" style={{ color: "inherit", textDecoration: "underline" }}>62 Descripción</Link>
                <Link href="/guia/campos/63" style={{ color: "inherit", textDecoration: "underline", textAlign: "right" }}>63 Importe</Link>
              </div>

              {SAMPLE_PERCEPTIONS.map((row) => (
                <Link
                  key={row.code}
                  href={`/guia/conceptos/${row.code}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3.75rem 1fr auto",
                    gap: "0.375rem",
                    alignItems: "center",
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
                      textAlign: "center",
                    }}
                  >
                    +{row.code}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a" }}>{row.desc}</div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>{row.note}</div>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#047857" }}>
                    {row.amount}
                  </span>
                </Link>
              ))}

              <Link
                href="/guia/campos/64"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.75rem",
                  background: "#f0fdf4",
                  borderTop: "2px solid #16a34a",
                  textDecoration: "none",
                  color: "#14532d",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>64 · Total Percepciones</span>
                <span style={{ fontFamily: "monospace" }}>$14,256.87</span>
              </Link>
            </div>
          )}

          {/* Mitad Derecha: Deducciones + Líquido */}
          {(mobilePayTab === "ambos" || mobilePayTab === "deducciones") && (
            <div style={{ border: "1px solid #fda4af", borderRadius: 6, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
              <Link
                href="/guia/campos/65"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "#ffe4e6",
                  borderBottom: "1px solid #fda4af",
                  textDecoration: "none",
                  color: "#881337",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>− DEDUCCIONES (Tus descuentos)</span>
                <span style={fieldPinBadge("#be123c")}>Campo 65</span>
              </Link>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "4.25rem 1fr 5.5rem",
                  padding: "0.35rem 0.625rem",
                  background: "#fff1f2",
                  borderBottom: "1px solid #fecdd3",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#9f1239",
                }}
              >
                <Link href="/guia/campos/66" style={{ color: "inherit", textDecoration: "underline" }}>66 Concepto</Link>
                <Link href="/guia/campos/67" style={{ color: "inherit", textDecoration: "underline" }}>67 Descripción</Link>
                <Link href="/guia/campos/68" style={{ color: "inherit", textDecoration: "underline", textAlign: "right" }}>68 Importe</Link>
              </div>

              {SAMPLE_DEDUCTIONS.map((row) => (
                <Link
                  key={row.code}
                  href={`/guia/conceptos/${row.code}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3.75rem 1fr auto",
                    gap: "0.375rem",
                    alignItems: "center",
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
                      textAlign: "center",
                    }}
                  >
                    −{row.code}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a" }}>{row.desc}</div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>{row.note}</div>
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#be123c" }}>
                    {row.amount}
                  </span>
                </Link>
              ))}

              <Link
                href="/guia/campos/69"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.75rem",
                  background: "#fff1f2",
                  borderTop: "2px solid #e11d48",
                  textDecoration: "none",
                  color: "#881337",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                }}
              >
                <span>69 · Total Deducciones</span>
                <span style={{ fontFamily: "monospace" }}>$10,339.87</span>
              </Link>

              <Link
                href="/guia/campos/70"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.65rem 0.75rem",
                  background: "#1b5e20",
                  textDecoration: "none",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                }}
              >
                <span>70 · LÍQUIDO (Lo que recibes neto)</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.9375rem" }}>$3,917.00</span>
              </Link>
            </div>
          )}
        </div>

        <div style={imssFooterHintStyle}>
          <CheckCircle size={14} color="#1b5e20" style={{ flexShrink: 0 }} />
          <span>
            <strong>Fórmula de oro del recibo:</strong> Total Percepciones (<strong>64</strong>) − Total Deducciones (<strong>69</strong>) = <strong>Líquido (70)</strong>. Toca cualquier clave para abrir su explicación completa.
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
          <span>MENSAJES · COMUNICADOS INSTITUCIONALES Y AVISOS CFDI</span>
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
        <span>OBSERVACIONES · DESGLOSE DE CRÉDITOS, SALDOS Y UNIDADES (CAMPOS 71–77)</span>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600 }}>Toca una fila o encabezado</span>
      </div>

      {/* Columnas 71 a 77 como cabeceras clicables */}
      <div
        style={{
          padding: "0.625rem 0.75rem",
          background: "#f1f5f1",
          borderBottom: "1px solid #c8dcc8",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
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
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px solid #86efac",
              fontSize: "0.71875rem",
              fontWeight: 700,
              color: "#1b5e20",
              textDecoration: "none",
            }}
          >
            <span style={{ background: "#1b5e20", color: "#fff", borderRadius: 4, padding: "0 0.3rem", fontSize: "0.625rem" }}>
              {col.id}
            </span>
            <span>{col.name}</span>
          </Link>
        ))}
      </div>

      {/* Selector de ejemplo real para explorar cómo leer cada caso */}
      <div style={{ padding: "0.75rem" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "0.5rem" }}>
          Selecciona un renglón de ejemplo para ver cómo se lee en el tarjetón:
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
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
              padding: "0.625rem 0.875rem",
              background: "#fffbeb",
              borderTop: "1px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.78125rem", color: "#92400e", lineHeight: 1.5, flex: "1 1 240px" }}>
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
        padding: "0.5rem 0.625rem",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#1b5e20" }}>
        [{fieldId}] {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: "0.78125rem", fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>
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
  padding: "0.5rem 0.875rem",
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
  padding: "0.55rem 0.875rem",
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
    padding: "0.35rem 0.65rem",
    borderRadius: 9999,
    border: active ? `1.5px solid ${color}` : "1px solid #cbd5e1",
    background: active ? color : "#ffffff",
    color: active ? "#ffffff" : "#334155",
    fontSize: "0.75rem",
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

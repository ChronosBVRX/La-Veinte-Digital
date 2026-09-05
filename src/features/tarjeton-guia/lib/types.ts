/**
 * Tipos base de la Guía de mi Tarjetón.
 *
 * Los tipos de datos del tarjetón real (ParsedImssTarjeton, ImportedPayslip)
 * viven en sus módulos originales; aquí solo se definen los tipos del
 * módulo educativo y un adaptador desacoplado (GuidePayslip) que permite
 * consumir tarjetones de cualquier fuente sin importar lógica de otra feature.
 */

/** Referencia navegable dentro de la guía: concepto, campo o sección. */
export type GuideConceptRef = `concept:${string}` | `field:${string | number}` | `section:${string}`

/** Clasificación de un concepto educativo. */
export type GuideConceptCategory = "perception" | "deduction" | "field" | "section"

/** Estado de verificación normativa de una ficha o dato. */
export type VerificationState = "verified" | "partially_verified" | "pending_verification"

/**
 * Nivel de certeza documental de una entrada (clasificación de 4 niveles de la guía).
 *
 * - `officially_verified`: un documento oficial nombra/regula EXACTAMENTE este concepto.
 * - `historically_identified`: identificación histórica/contextual sólida (p. ej. el FOVI,
 *   desaparecido en 2002 cuando el fideicomiso pasó a la SHF); sin fórmula ni fundamento
 *   normativo vigente preciso.
 * - `contextually_explained`: se explica por contexto institucional, sin referenciación directa
 *   al documento.
 * - `pending_identification`: pendiente de identificar en documentación oficial.
 */
export type GuideVerificationLevel =
  | "officially_verified"
  | "historically_identified"
  | "contextually_explained"
  | "pending_identification"

/** Estado de verificación de una faceta concreta (significado, fórmula o marco legal). */
export type GuideAspectState =
  | "verified"
  | "partially_verified"
  | "contextually_explained"
  | "pending_verification"

/** Institución emisora de una fuente oficial. */
export type SourceInstitution = "IMSS" | "DOF" | "SAT" | "SCJN" | "INFONAVIT" | "FONACOT" | "SHF" | "CNBV"

/** Tipo de documento de una fuente oficial. */
export type SourceKind =
  | "CCT"
  | "RIT"
  | "NORMA_IMSS"
  | "PROCEDIMIENTO_IMSS"
  | "TABULADOR"
  | "LEY"
  | "JURISPRUDENCIA"
  | "PORTAL_IMSS"
  | "REGLAMENTO"
  | "INFORME"
  | "COMUNICADO"
  | "INFORMACION_INSTITUCIONAL"

/**
 * Fuente oficial que respalda un concepto o campo de la guía.
 * Solo se usa documentación institucional (imss.gob.mx y legislación oficial).
 */
export interface OfficialSource {
  /** Id estable para referencias desde concept-details/field-details. */
  id: string
  institution: SourceInstitution
  type: SourceKind
  /** Clave del documento (p. ej. "1000-001-020", "1A74-003-031"). */
  documentCode?: string
  title: string
  /** Cláusula contractual cuando aplica ("38"). */
  clause?: string
  /** Artículo cuando aplica ("93"). */
  article?: string
  /** Numeral cuando aplica ("7.7"). */
  numeral?: string
  annex?: string
  /** Vigencia declarada por la fuente ("16 oct 2025 – 15 oct 2027"). */
  validity?: string
  /** URL oficial del documento (imss.gob.mx u otra fuente primaria). */
  officialUrl?: string
  /** Fecha en que se verificó contra la fuente. */
  verifiedAt?: string
}

/**
 * Cita puntual de una fuente oficial dentro de una ficha
 * (documento + cláusula/artículo/numeral cuando se conoce).
 */
export interface SourceCitation {
  sourceId: string
  clause?: string
  article?: string
  numeral?: string
  note?: string
}

/** Línea de concepto de un tarjetón, tal como la consume la guía. */
export interface GuidePayslipLine {
  code: string | null
  description: string
  /** Importe en pesos (las deducciones pueden venir negativas o positivas; se conserva el signo de origen). */
  amount: number
  kind: "earning" | "deduction"
  confidence?: number
  confirmedByUser?: boolean
}

/** Observación extraída de un tarjetón, tal como la consume la guía. */
export interface GuideObservation {
  conceptCode: string
  amount?: number
  duePeriod?: string
  units?: number
  controlNumber?: string
  initialCharge?: number
  notes?: string
}

export type AnalysisStatus = "pending" | "analyzing" | "persisting" | "ready" | "partial" | "error"

/** Tarjetón simplificado que la guía puede explicar. */
export interface GuidePayslip {
  id: string
  periodRaw?: string
  periodLabel?: string
  createdAt?: string
  earnings: GuidePayslipLine[]
  deductions: GuidePayslipLine[]
  perceptions?: GuidePayslipLine[]
  observations: GuideObservation[]
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
  netAmount?: number
  source: "local" | "server"
  analysisStatus?: AnalysisStatus
}

/** Indicador de ocurrencia de un concepto en una quincena. */
export type GuideOccurrence =
  | "present"
  | "absent"
  | "unknown"

/** Resultado de una búsqueda en el catálogo de la guía. */
export interface GuideSearchResult {
  /** Código de concepto (`002`) o id de campo (`13`). */
  key: string
  code: string
  name: string
  shortDescription: string
  category: GuideConceptCategory
  href: string
  score: number
}
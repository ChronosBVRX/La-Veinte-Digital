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

/** Línea de concepto de un tarjetón, tal como la consume la guía. */
export interface GuidePayslipLine {
  code: string
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

/** Tarjetón simplificado que la guía puede explicar. */
export interface GuidePayslip {
  id: string
  periodRaw?: string
  periodLabel?: string
  createdAt?: string
  earnings: GuidePayslipLine[]
  deductions: GuidePayslipLine[]
  observations: GuideObservation[]
  totalEarnings?: number
  totalDeductions?: number
  netPay?: number
  source: "local" | "server"
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
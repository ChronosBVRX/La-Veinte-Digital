export interface BaseConceptosInput {
  concepto002: number
  concepto011: number
}

export type FormulaEvidenceStatus =
  | "contract_verified"
  | "regulation_verified"
  | "institutional_catalog_verified"
  | "empirically_verified"
  | "app_reconstructed"
  | "pending_validation"

export interface FormulaEvidence {
  status: FormulaEvidenceStatus
  /** Fuente documental o institucional de la fórmula. */
  source: string
  /** Referencia concreta (cláusula, artículo, procedimiento). */
  reference: string
  notes?: string
}

export interface AguinaldoResult {
  base: number
  factor: number
  total: number
  anticipoEnero047: number
  anticipoAgosto043: number
  restoDiciembre049: number
  /** Evidencia de trazabilidad del factor usado. */
  formulaEvidence: FormulaEvidence
  /**
   * Alternativa documental (Cláusula 107: 3 meses de sueldo nominal, factor 6)
   * pendiente de validación contra tarjetones reales.
   */
  documentedAlternative?: {
    label: string
    factor: number
    total: number
    reference: string
    pendingValidation: true
  }
}

/** Input del Fondo de Ahorro (segunda de julio): base = sueldo tabular (002). */
export interface SegundaJulioInput {
  concepto002: number
}

export interface SegundaJulioProporcionalInput extends SegundaJulioInput {
  /** Unidades computables del periodo anual (1 jul – 30 jun); 360 = año completo. */
  unidades: number
}

export interface SegundaJulioProporcionalResult {
  base: number
  importeCompleto: number
  proporcion: number
  resultado: number
}

export type JornadaHoras = 6 | 6.5 | 8 | 12

/** Excepción documentada que permite exceder el límite ordinario de 20 h. */
export type TiempoExtraExceptionType =
  | "clausula_100_cct"
  | "art_24_rit"
  | "manual_authorization"
  | null

export interface TiempoExtraConceptoBase {
  code: string
  amount: number
}

export interface TiempoExtraInput {
  concepto002: number
  concepto011: number
  concepto020: number
  conceptoAdicional1: number
  conceptoAdicional2: number
  concepto050: number
  jornada: JornadaHoras
  horasExtra: number
  /** Horas extra de la semana corriente (validación 9 h semanales). */
  horasSemana?: number
  /** Excepción expresamente seleccionada/documentada para exceder el límite. */
  exceptionType?: TiempoExtraExceptionType
  /**
   * Base normativa integrada (del motor de repercusiones, concepto 037).
   * Si se provee, sustituye la suma manual de conceptos.
   */
  baseNormativa?: {
    conceptos: TiempoExtraConceptoBase[]
    baseAmount: number
  } | null
}

export interface TiempoExtraResult {
  sumaConceptos: number
  horasOrdinariasPeriodo: number
  valorHora: number
  factor: number
  horasExtra: number
  pago: number
  /** Base normativa integrada desde el motor de repercusiones (037). */
  baseNormativaUsada: boolean
  /** Conceptos integrados a la base (repercusiones). */
  conceptosIntegrados: TiempoExtraConceptoBase[]
}

export interface HorasExtraValidation {
  valid: boolean
  error?: string
  warning?: string
  requiresConfirmation?: boolean
}

export interface Clausula97Result {
  baseQuincenal: number
  unMes: number
  dosMeses: number
  tresMeses: number
  cuatroMeses: number
}

export interface PrestamoCategoriaRecord {
  categoria: string
  descripcionTC?: string
  sueldoPlaza?: number
  sueldoQuincenal?: number
  concepto011?: number
  smtabMas011?: number
  smi?: number
  clausula97UnMes?: number
  clausula97DosMeses?: number
  clausula97TresMeses?: number
  concepto160?: number
  automovil?: number
  enganche?: number
  medianoPlazo?: number
  hipotecario?: number
}

export interface PrestamoCalculado {
  modalidad: string
  formula: string
  valor: number
  valorOriginal?: number
  diferencia?: number
}


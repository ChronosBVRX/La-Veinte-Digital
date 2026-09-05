/**
 * Núcleo normativo compartido del Fondo de Ahorro (concepto 055).
 *
 * Punto único de cálculo para el motor de nómina (rule055) y las
 * calculadoras independientes (segunda de julio). Cualquier cambio de la
 * fórmula debe hacerse aquí.
 *
 * Régimen ordinario (Cláusula 144 CCT, Cláusula 63 Bis inc. b y procedimiento 1A74-003-024):
 *   Base             = Sueldo Tabular (002) + Ayuda de Renta Cl. 63 Bis b (011)
 *   Valor diario     = Base ÷ 15
 *   Importe completo = Valor diario × 46 días (Cláusula 144)
 *   Importe real     = Importe completo × (unidades computables ÷ 360)
 *
 * Las `unidades computables` son la base anual de 360 días (1 jul – 30 jun):
 * año completo = 360; medio año = 180. Sin unidades confirmadas se presenta
 * el escenario de año completo como SUPUESTO (requires_confirmation), con
 * la proporcionalidad debidamente señalada en la UI.
 *
 * El concepto 022 (ayuda de renta anual) es una prestación anual SEPARADA y
 * nunca integra la base de 055.
 */
export const FONDO_AHORRO_CONSTANTS = {
  DAILY_BASE_DIVISOR: 15,
  DAYS_FULL_ANNUAL: 46,
  ANNUAL_BASE_DAYS: 360,
  MONTH_PAYMENT: 7, // julio
  HALF_PAYMENT: 2,  // segunda quincena
} as const

export type FondoAhorroRegime = "ordinario" | "confianza_a"

export type FondoAhorroUnitsSource =
  | "confirmed"               // unidades confirmadas por el usuario/tarjetón
  | "derived_from_seniority"  // derivadas del periodo anual (360, 180, etc.)
  | "assumed_360"             // supuesto de año completo sin confirmar

export interface FondoAhorroUnitsResult {
  unidades: number
  source: FondoAhorroUnitsSource
  requiresConfirmation: boolean
  warnings: string[]
}

/** Base legal estructuralmente compatible con `LegalBasis` del motor de nómina. */
export interface FondoAhorroLegalBasis {
  source: "CCT" | "regulation" | "salary_table" | "institutional_catalog" | "reconstructed_application" | "user_confirmation"
  title: string
  reference: string
  version?: string
  effectiveFrom?: string
  effectiveTo?: string
  notes?: string
}

export interface FondoAhorroDerivationInput {
  /** Sueldo tabular quincenal (002). */
  sueldoTabular: number
  /** Ayuda de renta quincenal (011, Cl. 63 Bis inc. b). */
  concepto011?: number
  /** Unidades computables confirmadas (p. ej. 360, 180). */
  unidades?: number
  /** Días del periodo anual (1 jul – 30 jun) como evidencia de proporcionalidad. */
  annualPeriodDays?: number
  /** Régimen: ordinario (base 002 + 011). Confianza A se documenta aparte. */
  regime?: FondoAhorroRegime
}

export interface FondoAhorroDerivation {
  regime: FondoAhorroRegime
  base: number
  dailyValue: number
  fullAmount: number
  unidades: number
  proporcion: number
  importeReal: number
  unitsSource: FondoAhorroUnitsSource
  requiresConfirmation: boolean
  warnings: string[]
  legalBasis: FondoAhorroLegalBasis
}

export function deriveFondoAhorroUnits(input: {
  confirmedUnits?: number
  annualPeriodDays?: number
}): FondoAhorroUnitsResult {
  if (input.confirmedUnits !== undefined && input.confirmedUnits > 0) {
    return {
      unidades: Math.min(input.confirmedUnits, FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS),
      source: "confirmed",
      requiresConfirmation: false,
      warnings: [],
    }
  }

  if (input.annualPeriodDays !== undefined && input.annualPeriodDays > 0) {
    // Proporcionalidad al tiempo laborado (1 jul – 30 jun).
    const days = Math.min(input.annualPeriodDays, FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS)
    if (days >= 350) {
      return {
        unidades: FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS,
        source: "derived_from_seniority",
        requiresConfirmation: false,
        warnings: ["Se asume año completo (360 unidades) por periodo laborado ≥ 350 días."],
      }
    }
    if (days >= 170) {
      return {
        unidades: 180,
        source: "derived_from_seniority",
        requiresConfirmation: true,
        warnings: ["Se usa un periodo semi-anual (180 unidades) derivado del tiempo laborado; confirma el cómputo real del IMSS."],
      }
    }
    return {
      unidades: days,
      source: "derived_from_seniority",
      requiresConfirmation: true,
      warnings: [`Proporcionalidad derivada del periodo laborado (${days} días); confirma el cómputo real del IMSS.`],
    }
  }

  // Sin evidencia: se presenta el escenario de año completo como SUPUESTO.
  return {
    unidades: FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS,
    source: "assumed_360",
    requiresConfirmation: true,
    warnings: [
      "Supuesto de año completo (360 unidades): no hay unidades confirmadas. Confirma el cómputo real del IMSS.",
    ],
  }
}

export function calculateFondoAhorro(input: FondoAhorroDerivationInput): FondoAhorroDerivation {
  const regime = input.regime ?? "ordinario"

  const warnings: string[] = []
  if (regime === "confianza_a") {
    warnings.push(
      "El Estatuto de Confianza A se documenta aparte; no aplica la base de 46 días del régimen ordinario sin confirmar."
    )
  }

  const base = input.sueldoTabular + (input.concepto011 ?? 0)
  const dailyValue = base / FONDO_AHORRO_CONSTANTS.DAILY_BASE_DIVISOR
  const fullAmount = dailyValue * FONDO_AHORRO_CONSTANTS.DAYS_FULL_ANNUAL

  const unitsResult = deriveFondoAhorroUnits({
    confirmedUnits: input.unidades,
    annualPeriodDays: input.annualPeriodDays,
  })
  warnings.push(...unitsResult.warnings)

  if (unitsResult.unidades !== FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS) {
    warnings.push(
      "El importe presentado es proporcional al tiempo laborado (unidades ÷ 360), no el importe completo."
    )
  }

  const proporcion = unitsResult.unidades / FONDO_AHORRO_CONSTANTS.ANNUAL_BASE_DAYS
  const importeReal = fullAmount * proporcion

  return {
    regime,
    base,
    dailyValue,
    fullAmount,
    unidades: unitsResult.unidades,
    proporcion,
    importeReal,
    unitsSource: unitsResult.source,
    requiresConfirmation: unitsResult.requiresConfirmation,
    warnings,
    legalBasis: {
      source: "regulation",
      title: "Fondo de Ahorro (régimen ordinario)",
      reference: "Cláusula 144 CCT + Cláusula 63 Bis inc. b + Procedimiento 1A74-003-024",
      notes:
        "Base = sueldo tabular (002) + ayuda renta (011) por repercusión de la Cláusula 63 Bis inc. b CCT; 46 días anuales conforme a la Cláusula 144 CCT.",
    },
  }
}

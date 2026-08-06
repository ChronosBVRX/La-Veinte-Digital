/**
 * Orquestador del parsing del tarjetón IMSS.
 *
 * Entrada: texto posicionado del PDF (extracción nativa u OCR), ya
 * normalizado a `PositionedPdfText`. Salida: `ParsedImssTarjeton`
 * listo para revisión en la UI. El parsing es puro (sin IO) salvo el
 * hash opcional del folio fiscal, que se delega a `hashText`.
 */
import type { ParsedImssTarjeton, PositionedPdfText, TarjetonExtractionMethod } from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { detectImssTemplate, TEMPLATE_NOT_DETECTED_MESSAGE } from "./imss-template-detector"
import { parseImssProfile, extractSeniorityRaw } from "./imss-profile-parser"
import { parseImssConceptTables } from "./imss-concept-table-parser"
import { parseImssObservations } from "./imss-observations-parser"
import { parseImssPeriod, parseImssDate, imssPeriodEndDate } from "./imss-date-parser"
import { parseImssPayslipSeniority, buildTarjetonSeniority } from "./imss-seniority-parser"
import { globalTarjetonConfidence, baseFieldConfidence, clampConfidence, requiresReviewForConfidence, structuralConfidence } from "./confidence"
import { validateTarjetonTotals, validateConcept011Sanity } from "./validations"
import { parseImssMoney } from "./money-parser"
import { buildImssLayoutRegions } from "./imss-layout-regions"
import { normalizeWithIndexMap } from "./positioned-text"
import type { NumericFieldKind } from "./numeric-parsers"
import { parseIntegerCount, parseDecimalCount, parseDays, parseHours } from "./numeric-parsers"

export interface TarjetonParseInput {
  items: PositionedPdfText[]
  pageCount: number
  /** Hash del texto sensible (p. ej. folio fiscal); si no se provee, se omite la huella. */
  hashText?: (text: string) => string | Promise<string>
}

export type TarjetonParseOutcome =
  | { ok: true; status: "complete" | "requires_review"; parsed: ParsedImssTarjeton }
  | {
      ok: false
      status: "rejected"
      reason: "no_text" | "template_not_detected" | "critical_sections_missing" | "invalid_totals"
      partial?: ParsedImssTarjeton
      message: string
    }

function detectMethod(items: PositionedPdfText[]): TarjetonExtractionMethod {
  const methods = new Set(items.map((i) => i.method))
  if (methods.size === 1) return items[0].method
  return "hybrid"
}

function cleanValue(raw: string): string {
  return raw
    .replace(/^[\s:;.–—]+/, "")
    .replace(/[\s:;.–—]+$/, "")
    .replace(/\s+/g, " ")
}

interface LabelRead {
  value: string
  line: ReconstructedLine
  lineIndex: number
}

/** Normaliza una etiqueta igual que `line.norm` (sin acentos, mayúsculas). */
function normLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

/** Lee el valor que sigue a la etiqueta más específica (por longitud). */
function readValueAfterLabel(
  lines: ReconstructedLine[],
  labels: string[],
  excludeNorm?: string,
): LabelRead | null {
  const sorted = [...labels].map(normLabel).sort((a, b) => b.length - a.length)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    if (excludeNorm && line.norm.includes(excludeNorm)) continue
    const { normalized, normToRaw } = normalizeWithIndexMap(line.text)
    for (const label of sorted) {
      const idx = normalized.indexOf(label)
      if (idx < 0) continue
      const normalizedEnd = idx + label.length
      const rawEnd = normToRaw[normalizedEnd] ?? line.text.length
      const value = cleanValue(line.text.slice(rawEnd))
      if (value) return { value, line, lineIndex }
    }
  }
  return null
}

/**
 * Lee un campo numérico (0 válido) y devuelve el valor con metadatos.
 * Usa el parser adecuado para el tipo de campo (días, conteos, dinero...).
 */
function readNumberField(
  lines: ReconstructedLine[],
  labels: string[],
  kind: NumericFieldKind,
): { value: number; page: number; confidence: number; requiresReview: boolean; rawValue: string } | null {
  const read = readValueAfterLabel(lines, labels)
  if (!read) return null

  const parser =
    kind === "money"
      ? parseImssMoney
      : kind === "integer_count"
        ? parseIntegerCount
        : kind === "decimal_count"
          ? parseDecimalCount
          : kind === "days"
            ? parseDays
            : kind === "hours"
              ? parseHours
              : parseImssMoney

  const amount = parser(read.value)
  if (amount === undefined) return null
  const confidence = clampConfidence(baseFieldConfidence(read.line.method, read.line.confidence))
  return {
    value: amount,
    page: read.line.page,
    confidence,
    requiresReview: requiresReviewForConfidence(confidence, false),
    rawValue: read.value,
  }
}

function findDateAroundIndex(
  lines: ReconstructedLine[],
  lineIndex: number,
  window: { before: number; after: number },
): string | undefined {
  const start = Math.max(0, lineIndex - window.before)
  const end = Math.min(lines.length - 1, lineIndex + window.after)
  for (let j = start; j <= end; j++) {
    for (const token of lines[j].text.split(/\s+/)) {
      const date = parseImssDate(token)
      if (date) return date
    }
  }
  return undefined
}

export async function parseImssTarjeton(input: TarjetonParseInput): Promise<TarjetonParseOutcome> {
  const { items, pageCount, hashText } = input
  const warnings: string[] = []

  if (items.length === 0) {
    return {
      ok: false,
      status: "rejected",
      reason: "no_text",
      message: "No se pudo extraer texto del archivo. Es posible que esté vacío o que el lector no lo soporte.",
    }
  }

  const layout = buildImssLayoutRegions(items)
  const { lines, receptorLines, receptorColumns, earningsLines, deductionLines, observationLines } = layout
  const template = detectImssTemplate(lines)
  if (!template.detected) {
    warnings.push(TEMPLATE_NOT_DETECTED_MESSAGE)
    return {
      ok: false,
      status: "rejected",
      reason: "template_not_detected",
      message: TEMPLATE_NOT_DETECTED_MESSAGE,
    }
  }

  const method = detectMethod(items)

  // ---- Periodo ----------------------------------------------------------
  let periodRaw = ""
  let year: number | undefined
  let month: number | undefined
  let half: 1 | 2 | undefined
  let periodEndDate: string | undefined
  for (const line of lines) {
    const period = parseImssPeriod(line.text)
    if (period) {
      periodRaw = period.normalized
      year = period.year
      month = period.month
      half = period.half
      periodEndDate = imssPeriodEndDate(period)
      break
    }
  }
  if (!periodRaw) warnings.push("No se encontró el periodo de pago (1A/2A-MES-AÑO).")

  // ---- Folios -----------------------------------------------------------
  const folioRead = readValueAfterLabel(lines, ["FOLIO"], "FISCAL")
  let folio: string | undefined
  if (folioRead) {
    folio = folioRead.value.replace(/\s+/g, " ").trim()
  }

  let fiscalFolioHash: string | undefined
  const fiscalRead = readValueAfterLabel(lines, ["FOLIO FISCAL", "FOLIO DE FISCAL", "FOLIO FISCALIZADO"])
  if (fiscalRead && hashText) {
    fiscalFolioHash = await hashText(fiscalRead.value)
  }

  const certLineIndex = lines.findIndex((line) => line.norm.includes("CERTIFICACION"))
  const certificationDate =
    certLineIndex >= 0
      ? findDateAroundIndex(lines, certLineIndex, { before: 0, after: 2 })
      : undefined

  // ---- Perfil -----------------------------------------------------------
  const profile = parseImssProfile(layout.receptorScoped ? receptorLines : [], method)
  warnings.push(...profile.warnings)

  const employee = { ...profile.employee }

  // ---- Antigüedad (con quincenas, nunca conjeturas) ----------------------
  const seniorityRaw = extractSeniorityRaw(layout.receptorScoped ? receptorLines : [])
  if (seniorityRaw) {
    const parsedSeniority = parseImssPayslipSeniority(seniorityRaw)
    if (parsedSeniority) {
      if (periodEndDate) {
        employee.seniority = buildTarjetonSeniority(seniorityRaw, parsedSeniority, periodEndDate)
      } else {
        // Se conserva la antigüedad extraída aunque falte la fecha de referencia;
        // la UI decide si solicita el periodo al usuario.
        employee.seniority = {
          raw: seniorityRaw,
          years: parsedSeniority.years,
          fortnights: parsedSeniority.fortnights,
          days: parsedSeniority.days,
          parsed: parsedSeniority,
          status: "missing_reference_date",
        }
        warnings.push("Se detectó antigüedad pero no el periodo de pago; la fecha efectiva requiere confirmación.")
      }
    } else {
      employee.seniority = {
        raw: seniorityRaw,
        years: 0,
        fortnights: 0,
        days: 0,
        status: "unparsed",
      }
      warnings.push(`La antigüedad no pudo interpretarse: "${seniorityRaw}". Revisa el dato manualmente.`)
    }
  }

  // ---- Asistencia, vacaciones y nómina -----------------------------------
  const attendance: ParsedImssTarjeton["attendance"] = {}
  const vacations: ParsedImssTarjeton["vacations"] = {}
  const payroll: ParsedImssTarjeton["payroll"] = {
    earnings: [],
    deductions: [],
    observations: [],
  }

  const attendanceSpecs: Array<{ key: keyof typeof attendance; labels: string[]; kind: NumericFieldKind }> = [
    { key: "delays", labels: ["RETARDOS"], kind: "integer_count" },
    { key: "exitPasses", labels: ["PASES DE SALIDA"], kind: "integer_count" },
    { key: "absences", labels: ["FALTAS"], kind: "integer_count" },
    { key: "noDelayDays", labels: ["SIN RETARDO"], kind: "integer_count" },
    { key: "attendanceScore", labels: ["ASIDUIDAD"], kind: "integer_count" },
    { key: "incidentFortnight", labels: ["QNA DE INCIDENCIA"], kind: "integer_count" },
    { key: "generalIllnessLeave", labels: ["INC. GENERAL", "INCAPACIDAD GENERAL"], kind: "decimal_count" },
    { key: "occupationalRiskLeave", labels: ["RIESGO DE TRABAJO"], kind: "decimal_count" },
    { key: "maternityLeave", labels: ["MATERNIDAD"], kind: "decimal_count" },
    { key: "license140Bis", labels: ["LICENCIA 140 BIS"], kind: "decimal_count" },
    { key: "paidLicenses", labels: ["LICENCIAS CON SUELDO"], kind: "decimal_count" },
    { key: "unpaidLicenses", labels: ["LICENCIAS SIN SUELDO"], kind: "decimal_count" },
    { key: "trainingCommissions", labels: ["COMISIONES DE CAPACITACION", "COMISIONES DE CAPACITACIÓN"], kind: "integer_count" },
    { key: "commissions", labels: ["COMISIONES"], kind: "integer_count" },
    { key: "scholarshipWithPay", labels: ["BECAS CON SUELDO"], kind: "integer_count" },
    { key: "scholarshipWithoutPay", labels: ["BECAS SIN SUELDO"], kind: "integer_count" },
    { key: "concept033Days", labels: ["DIAS DEL CONCEPTO 033"], kind: "days" },
  ]
  const attendanceLines = layout.receptorScoped ? receptorColumns[1] : []
  const vacationAndPayrollLines = layout.receptorScoped ? receptorColumns[2] : []
  for (const spec of attendanceSpecs) {
    const field = readNumberField(attendanceLines, spec.labels, spec.kind)
    if (field) attendance[spec.key] = field.value
  }

  const vacationsSpecs: Array<{
    key: Exclude<keyof typeof vacations, "firstPeriodStartRaw" | "secondPeriodStartRaw">
    labels: string[]
    kind: NumericFieldKind
  }> = [
    { key: "enjoyedDays", labels: ["VACACIONES DISFRUTADAS"], kind: "days" },
    { key: "daysInYear", labels: ["VACACIONES EN EL AÑO", "DIAS DE VACACIONES"], kind: "days" },
    { key: "twentyYearsOrMoreDays", labels: ["VACACIONES DE 20 AÑOS O MAS", "VACACIONES DE 20 AÑOS O MÁS"], kind: "days" },
    { key: "expiredPeriods", labels: ["PERIODOS VENCIDOS"], kind: "integer_count" },
    { key: "continuityMark", labels: ["MARCA DE CONTINUIDAD"], kind: "integer_count" },
    { key: "periodNumberToEnjoy", labels: ["N. DE PERIODO POR DISFRUTAR", "PERIODO POR DISFRUTAR"], kind: "integer_count" },
    { key: "accumulatedRetirementDays", labels: ["DIAS ACUMULADOS PARA JUBILACION", "DIAS ACUMULADOS PARA JUBILACIÓN"], kind: "days" },
  ]
  for (const spec of vacationsSpecs) {
    const field = readNumberField(vacationAndPayrollLines, spec.labels, spec.kind)
    if (field) vacations[spec.key] = field.value
  }

  const firstPeriodRead = readValueAfterLabel(vacationAndPayrollLines, [
    "INICIO DE 1ER PERIODO",
    "INICIO 1ER PERIODO",
    "INICIO DE 1er PERIODO",
  ])
  if (firstPeriodRead) {
    const date = findDateAroundIndex(vacationAndPayrollLines, firstPeriodRead.lineIndex, { before: 0, after: 2 })
    vacations.firstPeriodStartRaw = date ?? firstPeriodRead.value
  }
  const secondPeriodRead = readValueAfterLabel(vacationAndPayrollLines, [
    "INICIO DE 2DO PERIODO",
    "INICIO 2DO PERIODO",
    "INICIO DE 2do PERIODO",
  ])
  if (secondPeriodRead) {
    const date = findDateAroundIndex(vacationAndPayrollLines, secondPeriodRead.lineIndex, { before: 0, after: 2 })
    vacations.secondPeriodStartRaw = date ?? secondPeriodRead.value
  }

  const payrollSpecs: Array<{
    key: "daysWorkedInYear" | "daysPaidInFortnight" | "integratedMonthlySalary" | "creditCapacity"
    labels: string[]
    kind: NumericFieldKind
  }> = [
    { key: "daysWorkedInYear", labels: ["DIAS LABORADOS EN EL AÑO"], kind: "days" },
    { key: "daysPaidInFortnight", labels: ["DIAS PAGADOS EN LA QUINCENA", "DIAS PAGADOS"], kind: "days" },
    { key: "integratedMonthlySalary", labels: ["SUELDO MENSUAL INTEGRADO"], kind: "money" },
    { key: "creditCapacity", labels: ["CAPACIDAD DE CREDITO", "CAPACIDAD DE CRÉDITO"], kind: "money" },
  ]
  for (const spec of payrollSpecs) {
    const field = readNumberField(vacationAndPayrollLines, spec.labels, spec.kind)
    if (field) payroll[spec.key] = field.value
  }

  // ---- Conceptos, totales y observaciones --------------------------------
  const concepts = parseImssConceptTables(earningsLines, deductionLines)
  warnings.push(...concepts.warnings)
  payroll.earnings = concepts.earnings
  payroll.deductions = concepts.deductions
  payroll.totalEarnings = concepts.totalEarnings
  payroll.totalDeductions = concepts.totalDeductions
  payroll.netPay = concepts.netPay
  payroll.observations = parseImssObservations(observationLines)

  // ---- Validaciones --------------------------------------------------------
  const totals = validateTarjetonTotals({
    schemaVersion: "1.0",
    document: { type: "imss_payroll_receipt", pageCount, periodRaw },
    employee,
    attendance,
    vacations,
    payroll,
    extraction: {
      method,
      globalConfidence: 0,
      warnings: [],
      validations: {
        templateDetected: true,
        earningsTotalMatches: null,
        deductionsTotalMatches: null,
        netPayMatches: null,
        employeeMatchesProfile: null,
        categoryResolved: null,
      },
    },
  } satisfies ParsedImssTarjeton)
  warnings.push(...totals.messages)

  const concept002 = payroll.earnings.find((l) => l.code === "002")?.amount
  const concept011 = payroll.earnings.find((l) => l.code === "011")?.amount
  const sanity = validateConcept011Sanity(concept002, concept011)
  if (sanity.plausible === false) {
    warnings.push(
      `La relación entre los conceptos 011 y 002 no es la esperada (011 = ${(concept011 ?? 0).toFixed(2)}, 002 = ${(concept002 ?? 0).toFixed(2)}). Revisa los importes.`,
    )
  }

  // ---- Confianza y decisiones de aceptación --------------------------------
  const confidenceLines = [
    ...Object.values(profile.fields).map((field) => ({ confidence: field.confidence })),
    ...payroll.earnings.map((l) => ({ confidence: l.confidence, kind: "earning" as const })),
    ...payroll.deductions.map((l) => ({ confidence: l.confidence, kind: "deduction" as const })),
  ]
  const earningCodes = new Set(payroll.earnings.map((line) => line.code))
  const duplicateCodes = payroll.deductions.filter((line) => earningCodes.has(line.code))
  const contaminatedConcepts = [...payroll.earnings, ...payroll.deductions].filter((line) =>
    /\b\d{3}\b/.test(line.description) || /TOTAL (?:PERCEPCIONES|DEDUCCIONES)/.test(line.description.toUpperCase()),
  )
  let structuralIssues = 0
  if (!layout.receptorScoped) {
    structuralIssues++
    warnings.push("No se pudo aislar la sección Receptor; revisa manualmente los datos laborales.")
  }
  if (!layout.tablesScoped) {
    structuralIssues++
    warnings.push("No se pudieron separar las tablas por coordenadas; revisa percepciones y deducciones.")
  }
  if (profile.warnings.length > 0) structuralIssues++
  if (contaminatedConcepts.length > 0) {
    structuralIssues++
    warnings.push("Una o más descripciones de conceptos contienen otro código o un total; revisa la separación de columnas.")
  }
  if (duplicateCodes.length > 0) {
    structuralIssues++
    warnings.push("Hay códigos repetidos entre percepciones y deducciones; revisa la clasificación de conceptos.")
  }
  if (payroll.earnings.length > 0 && payroll.earnings.length === payroll.deductions.length && !layout.tablesScoped) structuralIssues++
  const missingCriticalProfile = [employee.employeeNumber, employee.fullName, employee.categoryCode, employee.categoryName]
    .filter((value) => !value).length
  if (missingCriticalProfile > 0) {
    structuralIssues += missingCriticalProfile
    warnings.push("Faltan datos laborales críticos; revisa matrícula, nombre y categoría.")
  }
  if (!layout.observationsScoped) {
    structuralIssues++
    warnings.push("No se pudo aislar la sección de observaciones.")
  }
  if (payroll.totalEarnings === undefined || payroll.totalDeductions === undefined || payroll.netPay === undefined) {
    structuralIssues++
    warnings.push("Falta uno o más totales de nómina; la extracción requiere revisión.")
  }
  if (totals.earningsTotalMatches === false) structuralIssues++
  if (totals.deductionsTotalMatches === false) structuralIssues++
  if (totals.netPayMatches === false) structuralIssues++
  const globalConfidence = structuralConfidence(globalTarjetonConfidence(confidenceLines), structuralIssues)

  const criticalFieldConfidence = computeCriticalFieldConfidence({
    employeeNumber: profile.fields.employeeNumber?.confidence,
    categoryCode: profile.fields.categoryCode?.confidence,
    categoryName: profile.fields.categoryName?.confidence,
    periodDetected: Boolean(periodRaw),
    totalEarnings: payroll.totalEarnings,
    totalDeductions: payroll.totalDeductions,
    netPay: payroll.netPay,
  })

  const totalsValid =
    totals.earningsTotalMatches !== false &&
    totals.deductionsTotalMatches !== false &&
    totals.netPayMatches !== false

  const autoConfirmable =
    template.score >= 0.95 &&
    criticalFieldConfidence >= 0.95 &&
    totalsValid &&
    duplicateCodes.length === 0 &&
    contaminatedConcepts.length === 0 &&
    structuralIssues === 0

  const hasCriticalSections = payroll.earnings.length > 0 && payroll.deductions.length > 0
  const hasTotals = payroll.totalEarnings !== undefined && payroll.totalDeductions !== undefined && payroll.netPay !== undefined

  let reviewMode: ParsedImssTarjeton["extraction"]["reviewMode"]
  if (!hasCriticalSections) {
    reviewMode = "rejected"
  } else if (!hasTotals || !totalsValid || criticalFieldConfidence < 0.95 || structuralIssues > 0) {
    reviewMode = "full"
  } else if (criticalFieldConfidence < 1 || globalConfidence < 0.95) {
    reviewMode = "critical_fields"
  } else {
    reviewMode = "minimal"
  }

  const parsed: ParsedImssTarjeton = {
    schemaVersion: "1.0",
    document: {
      type: "imss_payroll_receipt",
      pageCount,
      periodRaw,
      year,
      month,
      half,
      folio,
      fiscalFolioHash,
      certificationDate,
    },
    employee,
    attendance,
    vacations,
    payroll,
    extraction: {
      method,
      globalConfidence,
      criticalFieldConfidence,
      autoConfirmable,
      reviewMode,
      fieldConfidences: {
        employeeNumber: profile.fields.employeeNumber?.confidence,
        fullName: profile.fields.fullName?.confidence,
        categoryCode: profile.fields.categoryCode?.confidence,
        categoryName: profile.fields.categoryName?.confidence,
        entryDate: profile.fields.entryDate?.confidence,
        seniority: profile.fields.seniority?.confidence,
      },
      warnings,
      validations: {
        templateDetected: true,
        earningsTotalMatches: totals.earningsTotalMatches,
        deductionsTotalMatches: totals.deductionsTotalMatches,
        netPayMatches: totals.netPayMatches,
        employeeMatchesProfile: null,
        categoryResolved: null,
      },
    },
  }

  if (!hasCriticalSections) {
    return {
      ok: false,
      status: "rejected",
      reason: "critical_sections_missing",
      partial: parsed,
      message: "No se detectó completa la nómina (percepciones y deducciones). Revisa el archivo.",
    }
  }

  if (!hasTotals) {
    // Totales faltantes: no se permite auto-confirmación, pero se muestra el
    // resultado parcial para revisión manual.
    return {
      ok: true,
      status: "requires_review",
      parsed,
    }
  }

  const status = reviewMode === "minimal" ? "complete" : "requires_review"

  return { ok: true, status, parsed }
}

interface CriticalFieldInputs {
  employeeNumber: number | undefined
  categoryCode: number | undefined
  categoryName: number | undefined
  periodDetected: boolean
  totalEarnings: number | undefined
  totalDeductions: number | undefined
  netPay: number | undefined
}

function computeCriticalFieldConfidence(inputs: CriticalFieldInputs): number {
  const confidences = [
    inputs.employeeNumber ?? 0,
    inputs.categoryCode ?? 0,
    inputs.categoryName ?? 0,
    inputs.periodDetected ? 1 : 0,
    inputs.totalEarnings !== undefined ? 1 : 0,
    inputs.totalDeductions !== undefined ? 1 : 0,
    inputs.netPay !== undefined ? 1 : 0,
  ]
  return clampConfidence(Math.min(...confidences))
}

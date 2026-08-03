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

export interface TarjetonParseInput {
  items: PositionedPdfText[]
  pageCount: number
  /** Hash del texto sensible (p. ej. folio fiscal); si no se provee, se omite la huella. */
  hashText?: (text: string) => string | Promise<string>
}

export type TarjetonParseOutcome =
  | { ok: true; parsed: ParsedImssTarjeton }
  | { ok: false; reason: "no_text" | "template_not_detected"; message: string }

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

/** Normaliza una etiqueta igual que `line.norm` (sin acentos, mayúsculas). */
function normLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function isCombiningMark(code: number): boolean {
  return code >= 0x0300 && code <= 0x036f
}

/** Convierte un índice del texto normalizado a su posición en el texto crudo. */
function rawIndexFromNorm(raw: string, normIdx: number): number {
  let rawIdx = 0
  let consumed = 0
  while (consumed < normIdx && rawIdx < raw.length) {
    rawIdx++
    if (!isCombiningMark(raw.charCodeAt(rawIdx - 1))) consumed++
  }
  return rawIdx
}

interface LabelRead {
  value: string
  line: ReconstructedLine
}

/** Lee el valor que sigue a la etiqueta más específica (por longitud). */
function readValueAfterLabel(lines: ReconstructedLine[], labels: string[], excludeNorm?: string): LabelRead | null {
  const sorted = [...labels].map(normLabel).sort((a, b) => b.length - a.length)
  for (const line of lines) {
    if (excludeNorm && line.norm.includes(excludeNorm)) continue
    for (const label of sorted) {
      const idx = line.norm.indexOf(label)
      if (idx < 0) continue
      // Las etiquetas normalizadas no tienen acentos: su longitud coincide
      // en ambos espacios salvo marcas combinantes del texto crudo.
      const rawIdx = rawIndexFromNorm(line.text, idx) + label.length
      const value = cleanValue(line.text.slice(rawIdx))
      if (value) return { value, line }
    }
  }
  return null
}

/** Lee un campo numérico (0 válido) y devuelve el valor con metadatos. */
function readNumberField(
  lines: ReconstructedLine[],
  labels: string[],
): { value: number; page: number; confidence: number; requiresReview: boolean } | null {
  const read = readValueAfterLabel(lines, labels)
  if (!read) return null
  const amount = parseImssMoney(read.value)
  if (amount === undefined) return null
  const confidence = clampConfidence(baseFieldConfidence(read.line.method, read.line.confidence))
  return {
    value: amount,
    page: read.line.page,
    confidence,
    requiresReview: requiresReviewForConfidence(confidence, false),
  }
}

function findFirstDateNear(lines: ReconstructedLine[], anchor: string, window = 2): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].norm.includes(anchor)) continue
    const end = Math.min(lines.length - 1, i + window)
    for (let j = i; j <= end; j++) {
      for (const token of lines[j].text.split(/\s+/)) {
        const date = parseImssDate(token)
        if (date) return date
      }
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

  const certificationDate = findFirstDateNear(lines, "CERTIFICACION")

  // ---- Perfil -----------------------------------------------------------
  const profile = parseImssProfile(layout.receptorScoped ? receptorLines : [], method)
  warnings.push(...profile.warnings)

  const employee = { ...profile.employee }

  // ---- Antigüedad (con quincenas, nunca conjeturas) ----------------------
  const seniorityRaw = extractSeniorityRaw(layout.receptorScoped ? receptorLines : [])
  if (seniorityRaw && periodEndDate) {
    const parsedSeniority = parseImssPayslipSeniority(seniorityRaw)
    if (parsedSeniority) {
      employee.seniority = buildTarjetonSeniority(seniorityRaw, parsedSeniority, periodEndDate)
    } else {
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

  const attendanceSpecs: Array<{ key: keyof typeof attendance; labels: string[] }> = [
    { key: "delays", labels: ["RETARDOS"] },
    { key: "exitPasses", labels: ["PASES DE SALIDA"] },
    { key: "absences", labels: ["FALTAS"] },
    { key: "noDelayDays", labels: ["SIN RETARDO"] },
    { key: "attendanceScore", labels: ["ASIDUIDAD"] },
    { key: "incidentFortnight", labels: ["QNA DE INCIDENCIA"] },
    { key: "generalIllnessLeave", labels: ["INC. GENERAL", "INCAPACIDAD GENERAL"] },
    { key: "occupationalRiskLeave", labels: ["RIESGO DE TRABAJO"] },
    { key: "maternityLeave", labels: ["MATERNIDAD"] },
    { key: "license140Bis", labels: ["LICENCIA 140 BIS"] },
    { key: "paidLicenses", labels: ["LICENCIAS CON SUELDO"] },
    { key: "unpaidLicenses", labels: ["LICENCIAS SIN SUELDO"] },
    { key: "trainingCommissions", labels: ["COMISIONES DE CAPACITACION", "COMISIONES DE CAPACITACIÓN"] },
    { key: "commissions", labels: ["COMISIONES"] },
    { key: "scholarshipWithPay", labels: ["BECAS CON SUELDO"] },
    { key: "scholarshipWithoutPay", labels: ["BECAS SIN SUELDO"] },
    { key: "concept033Days", labels: ["DIAS DEL CONCEPTO 033"] },
  ]
  const attendanceLines = layout.receptorScoped ? receptorColumns[1] : []
  const vacationAndPayrollLines = layout.receptorScoped ? receptorColumns[2] : []
  for (const spec of attendanceSpecs) {
    const field = readNumberField(attendanceLines, spec.labels)
    if (field) attendance[spec.key] = field.value
  }

  const vacationsSpecs: Array<{ key: Exclude<keyof typeof vacations, "firstPeriodStartRaw" | "secondPeriodStartRaw">; labels: string[] }> = [
    { key: "enjoyedDays", labels: ["VACACIONES DISFRUTADAS"] },
    { key: "daysInYear", labels: ["VACACIONES EN EL AÑO", "DIAS DE VACACIONES"] },
    { key: "twentyYearsOrMoreDays", labels: ["VACACIONES DE 20 AÑOS O MAS", "VACACIONES DE 20 AÑOS O MÁS"] },
    { key: "expiredPeriods", labels: ["PERIODOS VENCIDOS"] },
    { key: "continuityMark", labels: ["MARCA DE CONTINUIDAD"] },
    { key: "periodNumberToEnjoy", labels: ["N. DE PERIODO POR DISFRUTAR", "PERIODO POR DISFRUTAR"] },
    { key: "accumulatedRetirementDays", labels: ["DIAS ACUMULADOS PARA JUBILACION", "DIAS ACUMULADOS PARA JUBILACIÓN"] },
  ]
  for (const spec of vacationsSpecs) {
    const field = readNumberField(vacationAndPayrollLines, spec.labels)
    if (field) vacations[spec.key] = field.value
  }

  const firstPeriodRead = readValueAfterLabel(vacationAndPayrollLines, ["INICIO DE 1ER PERIODO", "INICIO 1ER PERIODO", "INICIO DE 1er PERIODO"])
  if (firstPeriodRead) {
    const date = findFirstDateNear([firstPeriodRead.line], firstPeriodRead.line.norm.slice(0, 10))
    vacations.firstPeriodStartRaw = date ?? firstPeriodRead.value
  }
  const secondPeriodRead = readValueAfterLabel(vacationAndPayrollLines, ["INICIO DE 2DO PERIODO", "INICIO 2DO PERIODO", "INICIO DE 2do PERIODO"])
  if (secondPeriodRead) {
    const date = findFirstDateNear([secondPeriodRead.line], secondPeriodRead.line.norm.slice(0, 10))
    vacations.secondPeriodStartRaw = date ?? secondPeriodRead.value
  }

  const payrollSpecs: Array<{ key: "daysWorkedInYear" | "daysPaidInFortnight" | "integratedMonthlySalary" | "creditCapacity"; labels: string[] }> = [
    { key: "daysWorkedInYear", labels: ["DIAS LABORADOS EN EL AÑO"] },
    { key: "daysPaidInFortnight", labels: ["DIAS PAGADOS EN LA QUINCENA", "DIAS PAGADOS"] },
    { key: "integratedMonthlySalary", labels: ["SUELDO MENSUAL INTEGRADO"] },
    { key: "creditCapacity", labels: ["CAPACIDAD DE CREDITO", "CAPACIDAD DE CRÉDITO"] },
  ]
  for (const spec of payrollSpecs) {
    const field = readNumberField(vacationAndPayrollLines, spec.labels)
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

  // ---- Confianza global -----------------------------------------------------
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
  if (payroll.earnings.length === 0 || payroll.deductions.length === 0) {
    structuralIssues++
    warnings.push("No se detectaron conceptos en una o ambas tablas de nómina.")
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

  return { ok: true, parsed }
}

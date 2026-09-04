/**
 * Constructor PURO del contexto de nómina para el simulador.
 *
 * Sin directivas "use server" ni acceso a red: testeable directamente.
 *
 * HISTORIA (bug $200.00): el RPC `confirm_imported_payslip` solo persiste un
 * subconjunto histórico (050/023/063) en `payroll_contexts.recurring_concepts`;
 * hidratar la portada con ese subconjunto sumaba una sola percepción en lugar
 * del total comprobado ($14,256.87 en el tarjetón real 2A-AGO-2026). Aquí se
 * reconstruye la lista COMPLETA desde `imported_payslip_lines`.
 */
import type { RecurringConceptEvidence, ConceptOccurrenceType, EligibilityPersistence } from "@/features/nomina/lib/types"
import { classifyOccurrence, classifyPersistence } from "@/shared/lib/recurring-concept-classifier"
import { parsePorVencerDate } from "@/features/tarjeton/lib/imss-date-parser"
import type { VacationEntitlement } from "@/features/vacations/domain/types"

export interface WorkerContext {
  profile: {
    fullName: string | null
    matricula: string | null
    categoria: string | null
    antiguedad: string | null
    adscripcion: string | null
  } | null
  employment: {
    categoryName: string | null
    categoryCode: string | null
    workdayHours: number | null
    employmentType: string | null
    entryDate: string | null
    effectiveSeniorityDate: string | null
    seniorityRaw: string | null
    shift: string | null
    adscripcion: string | null
    weeklyRestDays: number[] | null
    radiologicalExposure: boolean | "UNSURE" | null
    contractEndDate: string | null
  } | null
  payroll: {
    latestPeriod: string | null
    totalEarnings: number | null
    totalDeductions: number | null
    netPay: number | null
    integratedMonthlySalary: number | null
    integratedSalaryMeta?: {
      sourcePeriod: string | null
      origin: "EXTRACTED" | "RECONSTRUCTED" | "INCOMPLETE"
      isDirectlyExtracted: boolean
      isReconstructed: boolean
      isConfirmedByUser: boolean
      amount: number | null
    }
    recurringConcepts: unknown[]
    payrollFacts: unknown[]
  } | null
  vacations: {
    enjoyedDays?: number | null
    daysInYear?: number | null
    twentyYearsOrMoreDays?: number | null
    expiredPeriods?: number | null
    continuityMark?: number | null
    periodNumberToEnjoy?: number | null
    firstPeriodStartRaw?: string | null
    secondPeriodStartRaw?: string | null
    accumulatedRetirementDays?: number | null
    porVencer?: string | null
    porVencerRaw?: string | null
    dueDate?: string | null
    entitlements?: VacationEntitlement[]
  } | null
  vacationProfile: {
    contractType: string | null
    category: string | null
    categoryCode: string | null
    workScheduleType: string | null
    shift: string | null
    adscription: string | null
    unit: string | null
    service: string | null
    entryDate: string | null
    effectiveSeniorityYears: number | null
    effectiveSeniorityFortnights: number | null
    effectiveSeniorityDays: number | null
    radiologicalExposure: string | null
    weeklyRestDays: number[] | null
    contractEndDate: string | null
  } | null
}

/** Línea de percepción/deducción tal como vive en `imported_payslip_lines`. */
export interface PayslipLineRow {
  concept_code: string
  description: string
  amount: number
  kind: "earning" | "deduction"
  confirmed_by_user: boolean
}

/**
 * Reconstruye la lista COMPLETA de recurrentes desde las líneas confirmadas
 * del último tarjetón real.
 *
 * HISTORIA: el RPC `confirm_imported_payslip` solo persiste un subconjunto
 * histórico (050/023/063) en `payroll_contexts.recurring_concepts`; hidratar
 * el simulador con ese subconjunto hacía que la portada sumara $200 (una sola
 * percepción) en lugar del total comprobado ($14,256.87). Esta función usa la
 * verdad de terreno (`imported_payslip_lines`) y preserva entradas previas
 * para códigos ausentes en el tarjetón más reciente.
 */
export function buildRecurringConceptsFromPayslipLines(
  lines: PayslipLineRow[],
  periodRaw: string | null,
  existing: unknown[],
): RecurringConceptEvidence[] {
  // Normalizar entradas existentes válidas (defensa ante JSONB legacy).
  const merged = new Map<string, RecurringConceptEvidence>()
  for (const raw of existing) {
    if (!raw || typeof raw !== "object") continue
    const e = raw as Partial<RecurringConceptEvidence>
    if (typeof e.conceptCode !== "string" || !e.conceptCode) continue
    merged.set(e.conceptCode, {
      conceptCode: e.conceptCode,
      appearsNormally: typeof e.appearsNormally === "boolean" ? e.appearsNormally : null,
      lastAmount: typeof e.lastAmount === "number" ? e.lastAmount : undefined,
      source: e.source ?? "last_payslip",
      firstSeenAt: e.firstSeenAt,
      lastSeenAt: e.lastSeenAt,
      confirmed: e.confirmed === true,
      occurrenceType: (e.occurrenceType ?? "unknown") as ConceptOccurrenceType,
      eligibilityPersistence: (e.eligibilityPersistence ?? "until_changed") as EligibilityPersistence,
    })
  }

  // Las líneas del tarjetón real son la fuente más fresca: ganan por código.
  for (const line of lines) {
    if (line.kind !== "earning") continue
    if (!line.confirmed_by_user) continue
    if (!(line.amount > 0)) continue
    const code = line.concept_code
    const occurrenceType = classifyOccurrence(code)
    const prev = merged.get(code)
    merged.set(code, {
      conceptCode: code,
      appearsNormally: occurrenceType === "recurring" || occurrenceType === "variable",
      lastAmount: line.amount,
      source: "last_payslip",
      firstSeenAt: prev?.firstSeenAt ?? periodRaw ?? undefined,
      lastSeenAt: periodRaw ?? prev?.lastSeenAt,
      confirmed: true,
      occurrenceType,
      eligibilityPersistence: classifyPersistence(code),
    })
  }

  return Array.from(merged.values())
}

export function resolveIntegratedMonthlySalary(
  latestPayrollTotals: Record<string, number> | null,
  payslipLines: PayslipLineRow[],
  periodRaw: string | null
): {
  amount: number | null
  meta: NonNullable<NonNullable<WorkerContext["payroll"]>["integratedSalaryMeta"]>
} {
  const extractedSmi = latestPayrollTotals?.integratedMonthlySalary
  if (typeof extractedSmi === "number" && Number.isFinite(extractedSmi) && extractedSmi > 0) {
    const rounded = Math.round(extractedSmi * 100) / 100
    return {
      amount: rounded,
      meta: {
        sourcePeriod: periodRaw,
        origin: "EXTRACTED",
        isDirectlyExtracted: true,
        isReconstructed: false,
        isConfirmedByUser: true,
        amount: rounded,
      },
    }
  }

  // Reconstrucción normativa oficial (Suma quincenal de 002 + 011 + 016 + 022 + 023 + 057 + 058 + 061 + 063 + 020 + 050 * 2)
  const SMI_INTEGRATING_CONCEPTS = new Set(["002", "011", "016", "022", "023", "057", "058", "061", "063", "020", "050"])
  const baseSalaryLine = payslipLines.find((l) => l.concept_code === "002" && l.kind === "earning" && l.amount > 0)

  if (baseSalaryLine) {
    let fortnightSum = 0
    let anyConfirmed = false
    for (const line of payslipLines) {
      if (line.kind === "earning" && SMI_INTEGRATING_CONCEPTS.has(line.concept_code) && line.amount > 0) {
        fortnightSum += line.amount
        if (line.confirmed_by_user) anyConfirmed = true
      }
    }
    const reconstructedMonthly = Math.round(fortnightSum * 2 * 100) / 100
    if (reconstructedMonthly > 0) {
      return {
        amount: reconstructedMonthly,
        meta: {
          sourcePeriod: periodRaw,
          origin: "RECONSTRUCTED",
          isDirectlyExtracted: false,
          isReconstructed: true,
          isConfirmedByUser: anyConfirmed,
          amount: reconstructedMonthly,
        },
      }
    }
  }

  return {
    amount: null,
    meta: {
      sourcePeriod: periodRaw,
      origin: "INCOMPLETE",
      isDirectlyExtracted: false,
      isReconstructed: false,
      isConfirmedByUser: false,
      amount: null,
    },
  }
}

/**
 * Helper puro para pruebas y reutilización: arma `payroll` a partir de las
 * filas ya consultadas. Mantiene el contrato `WorkerContext` intacto.
 */
export function buildWorkerContextPayroll(
  latest: {
    period_raw: string | null
    payroll_totals: Record<string, number> | null
  } | null,
  ctxRecurring: unknown[],
  ctxFacts: unknown[],
  payslipLines: PayslipLineRow[],
): WorkerContext["payroll"] {
  const smiResolved = resolveIntegratedMonthlySalary(
    latest?.payroll_totals ?? null,
    payslipLines,
    latest?.period_raw ?? null
  )

  return {
    latestPeriod: latest?.period_raw ?? null,
    totalEarnings: latest?.payroll_totals?.totalEarnings ?? null,
    totalDeductions: latest?.payroll_totals?.totalDeductions ?? null,
    netPay: latest?.payroll_totals?.netPay ?? null,
    integratedMonthlySalary: smiResolved.amount,
    integratedSalaryMeta: smiResolved.meta,
    recurringConcepts: buildRecurringConceptsFromPayslipLines(
      payslipLines,
      latest?.period_raw ?? null,
      ctxRecurring,
    ),
    payrollFacts: ctxFacts,
  }
}

export function parseJsonIfString<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  if (typeof value === "object") {
    return value as T
  }
  return null
}

export interface BuildWorkerContextParams {
  profileRow?: {
    full_name?: string | null
    matricula?: string | null
    categoria?: string | null
    antiguedad?: string | null
    adscripcion?: string | null
  } | null
  payrollContextRow?: Record<string, unknown> | null
  latestPayslipRow?: {
    id?: string
    period_raw?: string | null
    payroll_totals?: unknown
    employee_data?: unknown
    vacations?: unknown
  } | null
  payslipLines?: PayslipLineRow[]
  vacationProfileRow?: Record<string, unknown> | null
}

export function buildWorkerContext(params: BuildWorkerContextParams): WorkerContext {
  const profileRow = params.profileRow ?? null
  const ctx = params.payrollContextRow ?? null
  const latest = params.latestPayslipRow ?? null
  const payslipLines = params.payslipLines ?? []
  const vacProfile = params.vacationProfileRow ?? null

  const employeeData = parseJsonIfString<Record<string, unknown>>(latest?.employee_data)
  const vacationsData = parseJsonIfString<Record<string, unknown>>(latest?.vacations)

  const profile = profileRow
    ? {
        fullName: profileRow.full_name ?? null,
        matricula: profileRow.matricula ?? null,
        categoria: profileRow.categoria ?? null,
        antiguedad: profileRow.antiguedad ?? null,
        adscripcion: profileRow.adscripcion ?? (ctx?.adscripcion as string | undefined) ?? null,
      }
    : null

  let seniorityRaw: string | null = null
  if (employeeData?.seniority) {
    if (typeof employeeData.seniority === "object") {
      seniorityRaw = (employeeData.seniority as { raw?: string }).raw ?? null
    } else if (typeof employeeData.seniority === "string") {
      seniorityRaw = employeeData.seniority
    }
  }
  if (!seniorityRaw && profileRow?.antiguedad) {
    seniorityRaw = profileRow.antiguedad
  }

  // Radiación: vacationProfileRow -> concepto 054 en payslipLines -> facts
  let radiologicalExposure: boolean | "UNSURE" | null = null
  if (vacProfile?.radiological_exposure === "YES") {
    radiologicalExposure = true
  } else if (vacProfile?.radiological_exposure === "NO") {
    radiologicalExposure = false
  } else if (vacProfile?.radiological_exposure === "UNSURE") {
    radiologicalExposure = "UNSURE"
  } else {
    const has054 = payslipLines.some((l) => l.concept_code === "054" && l.confirmed_by_user && l.amount > 0)
    if (has054) {
      radiologicalExposure = true
    } else if (Array.isArray(ctx?.payroll_facts)) {
      const fact = ctx.payroll_facts.find((f: unknown) => (f as { key?: string })?.key === "concept_054_on_payslip")
      if ((fact as { value?: unknown })?.value === true) {
        radiologicalExposure = true
      }
    }
  }

  const employment = (ctx || employeeData || profileRow || vacProfile)
    ? {
        categoryName:
          (employeeData?.categoryName as string) ??
          (ctx?.category_name as string) ??
          (vacProfile?.category as string) ??
          profileRow?.categoria ??
          null,
        categoryCode:
          (employeeData?.categoryCode as string) ??
          (ctx?.category_code as string) ??
          (vacProfile?.category_code as string) ??
          null,
        workdayHours:
          (employeeData?.workdayHours as number) ??
          (ctx?.workday_hours as number) ??
          null,
        employmentType:
          (employeeData?.employmentType as string) ??
          (ctx?.employment_type as string) ??
          (vacProfile?.contract_type as string) ??
          null,
        entryDate:
          (employeeData?.entryDate as string) ??
          (vacProfile?.entry_date as string) ??
          null,
        effectiveSeniorityDate: (ctx?.effective_seniority_date as string) ?? null,
        seniorityRaw,
        shift:
          (employeeData?.shift as string) ??
          (ctx?.shift as string) ??
          (vacProfile?.shift as string) ??
          null,
        adscripcion:
          (employeeData?.location as string) ??
          (ctx?.adscripcion as string) ??
          (vacProfile?.adscription as string) ??
          profileRow?.adscripcion ??
          null,
        weeklyRestDays: (vacProfile?.weekly_rest_days as number[]) ?? null,
        radiologicalExposure,
        contractEndDate: (vacProfile?.contract_end_date as string) ?? null,
      }
    : null

  const payrollTotals = parseJsonIfString<Record<string, number>>(latest?.payroll_totals)
  const payroll = buildWorkerContextPayroll(
    latest
      ? {
          period_raw: latest.period_raw ?? null,
          payroll_totals: payrollTotals,
        }
      : null,
    (ctx?.recurring_concepts as unknown[]) ?? [],
    (ctx?.payroll_facts as unknown[]) ?? [],
    payslipLines,
  )

  let porVencerVal = typeof vacationsData?.porVencer === "string" ? vacationsData.porVencer : null
  let dueDateVal = typeof vacationsData?.dueDate === "string" ? vacationsData.dueDate : null

  // Si registros anteriores no tenían dueDate / porVencer pero sí conservan porVencerRaw (ej. 14102026),
  // recuperar de forma idempotente con el nuevo parser:
  if (!porVencerVal && !dueDateVal && typeof vacationsData?.porVencerRaw === "string") {
    const recovered = parsePorVencerDate(vacationsData.porVencerRaw)
    if (recovered) {
      porVencerVal = recovered
      dueDateVal = recovered
    }
  }
  if (!dueDateVal && porVencerVal) dueDateVal = porVencerVal
  if (!porVencerVal && dueDateVal) porVencerVal = dueDateVal

  const periodRaw = latest?.period_raw ?? ""
  const entitlements: VacationEntitlement[] = []

  if (vacationsData) {
    // 1er periodo ordinario
    entitlements.push({
      id: "ord-1",
      kind: "ORDINARY",
      periodNumber: 1,
      dueDate: dueDateVal ?? undefined,
      sourceRaw: typeof vacationsData.porVencerRaw === "string" ? vacationsData.porVencerRaw : undefined,
      sourcePayslipPeriod: periodRaw,
      confirmed: Boolean(dueDateVal),
    })

    // 2do periodo ordinario
    const secondRaw = typeof vacationsData.secondPeriodStartRaw === "string" ? vacationsData.secondPeriodStartRaw : undefined
    entitlements.push({
      id: "ord-2",
      kind: "ORDINARY",
      periodNumber: 2,
      dueDate: secondRaw,
      sourceRaw: secondRaw,
      sourcePayslipPeriod: periodRaw,
      confirmed: Boolean(secondRaw),
    })

    // 3er periodo ordinario (si es cuatrimestral por radiación)
    if (radiologicalExposure === true) {
      entitlements.push({
        id: "ord-3",
        kind: "ORDINARY",
        periodNumber: 3,
        sourcePayslipPeriod: periodRaw,
        confirmed: false,
      })
    }

    // Periodo extraordinario V20
    const v20Days = typeof vacationsData.twentyYearsOrMoreDays === "number" ? vacationsData.twentyYearsOrMoreDays : 0
    const seniorityYears = typeof vacProfile?.effective_seniority_years === "number" ? vacProfile.effective_seniority_years : 0
    if (v20Days > 0 || seniorityYears >= 20) {
      entitlements.push({
        id: "v20",
        kind: "V20",
        sourcePayslipPeriod: periodRaw,
        confirmed: v20Days > 0,
      })
    }
  }

  const vacations = vacationsData
    ? {
        enjoyedDays: typeof vacationsData.enjoyedDays === "number" ? vacationsData.enjoyedDays : null,
        daysInYear: typeof vacationsData.daysInYear === "number" ? vacationsData.daysInYear : null,
        twentyYearsOrMoreDays: typeof vacationsData.twentyYearsOrMoreDays === "number" ? vacationsData.twentyYearsOrMoreDays : null,
        expiredPeriods: typeof vacationsData.expiredPeriods === "number" ? vacationsData.expiredPeriods : null,
        continuityMark: typeof vacationsData.continuityMark === "number" ? vacationsData.continuityMark : null,
        periodNumberToEnjoy: typeof vacationsData.periodNumberToEnjoy === "number" ? vacationsData.periodNumberToEnjoy : null,
        firstPeriodStartRaw: typeof vacationsData.firstPeriodStartRaw === "string" ? vacationsData.firstPeriodStartRaw : null,
        secondPeriodStartRaw: typeof vacationsData.secondPeriodStartRaw === "string" ? vacationsData.secondPeriodStartRaw : null,
        accumulatedRetirementDays: typeof vacationsData.accumulatedRetirementDays === "number" ? vacationsData.accumulatedRetirementDays : null,
        porVencer: porVencerVal,
        porVencerRaw: typeof vacationsData.porVencerRaw === "string" ? vacationsData.porVencerRaw : null,
        dueDate: dueDateVal,
        entitlements,
      }
    : null

  const vacationProfile = vacProfile
    ? {
        contractType: (vacProfile.contract_type as string) ?? null,
        category: (vacProfile.category as string) ?? null,
        categoryCode: (vacProfile.category_code as string) ?? null,
        workScheduleType: (vacProfile.work_schedule_type as string) ?? null,
        shift: (vacProfile.shift as string) ?? null,
        adscription: (vacProfile.adscription as string) ?? null,
        unit: (vacProfile.unit as string) ?? null,
        service: (vacProfile.service as string) ?? null,
        entryDate: (vacProfile.entry_date as string) ?? null,
        effectiveSeniorityYears: typeof vacProfile.effective_seniority_years === "number" ? vacProfile.effective_seniority_years : null,
        effectiveSeniorityFortnights: typeof vacProfile.effective_seniority_fortnights === "number" ? vacProfile.effective_seniority_fortnights : null,
        effectiveSeniorityDays: typeof vacProfile.effective_seniority_days === "number" ? vacProfile.effective_seniority_days : null,
        radiologicalExposure: (vacProfile.radiological_exposure as string) ?? null,
        weeklyRestDays: (vacProfile.weekly_rest_days as number[]) ?? null,
        contractEndDate: (vacProfile.contract_end_date as string) ?? null,
      }
    : null

  return {
    profile,
    employment,
    payroll,
    vacations,
    vacationProfile,
  }
}

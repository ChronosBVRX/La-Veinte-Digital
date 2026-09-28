/**
 * Servicio de sincronización del snapshot laboral hacia el almacenamiento nativo
 * de Android (`OfflineSnapshotStore.kt`) mediante `laVeintePdfBridge`.
 *
 * Reglas de gobernanza:
 * - Solo lectura en modo offline: jamás sustituye datos en vivo cuando hay red.
 * - Aislado por `ownerId` (user.id de Supabase).
 * - Preserva el Golden Behavior de 2ª de Julio (Fondo de Ahorro): integra
 *   explícitamente Concepto 002 (Sueldo Base) + Concepto 011 (Ayuda Renta).
 * - En navegadores web normales o SSR es un no-op seguro.
 */

import { isNativePdfShareSupported } from "@/shared/services/pdfShareBridge"

export interface OfflineConceptLinePayload {
  code: string
  description: string
  amount: number
  kind: "earning" | "deduction"
}

export interface OfflinePayslipSummaryPayload {
  periodLabel: string
  totalEarnings: number
  totalDeductions: number
  netPay: number
  vacationDueDate: string | null
  lines: OfflineConceptLinePayload[]
}

export interface OfflineProfileSummaryPayload {
  fullName: string | null
  matricula: string | null
  categoria: string | null
  antiguedad: string | null
  adscripcion: string | null
  workdayHours: number | null
  shift: string | null
}

export interface OfflineCommitmentItemPayload {
  id: string
  title: string
  type: string
  typeLabel: string
  startAt: string
  status: string
  notes: string | null
}

export interface OfflineCalculatorBasePayload {
  sueldoBaseQuincenal002: number
  ayudaRentaQuincenal011: number
  sueldoMensualIntegrado: number
  workdayHours: number
}

export interface OfflineWorkerSnapshotPayload {
  ownerId: string
  syncedAtMs: number
  contextRevision: string | null
  profile: OfflineProfileSummaryPayload
  latestPayslip: OfflinePayslipSummaryPayload | null
  commitments: OfflineCommitmentItemPayload[]
  calculatorBase: OfflineCalculatorBasePayload
}

export interface WorkerContextSnapshotInput {
  userId?: string | null
  meta?: {
    contextRevision?: string | null
    activePayslipPeriod?: string | null
  } | null
  profile?: {
    fullName?: string | null
    matricula?: string | null
    categoria?: string | null
    antiguedad?: string | null
    adscripcion?: string | null
  } | null
  employment?: {
    categoryName?: string | null
    workdayHours?: number | null
    seniorityRaw?: string | null
    shift?: string | null
    adscripcion?: string | null
  } | null
  payroll?: {
    latestPeriod?: string | null
    totalEarnings?: number | null
    totalDeductions?: number | null
    netPay?: number | null
    integratedMonthlySalary?: number | null
    recurringConcepts?: unknown[] | null
  } | null
  vacations?: {
    dueDate?: string | null
    porVencer?: string | null
  } | null
}

export interface LocalPayslipSnapshotInput {
  period?: string | { id?: string; label?: string } | null
  periodRaw?: string | null
  totalPerceptions?: number | null
  totalEarnings?: number | null
  totalDeductions?: number | null
  netPay?: number | null
  netAmount?: number | null
  earnings?: Array<{
    code?: string
    conceptCode?: string
    name?: string
    description?: string
    amount?: number
  }> | null
  perceptions?: Array<{
    code?: string
    conceptCode?: string
    name?: string
    description?: string
    amount?: number
  }> | null
  deductions?: Array<{
    code?: string
    conceptCode?: string
    name?: string
    description?: string
    amount?: number
  }> | null
}

export interface CommitmentSnapshotInput {
  id: string
  title: string
  type?: string | null
  startAt: string
  status?: string | null
  notes?: string | null
}

const COMMITMENT_TYPE_LABELS: Record<string, string> = {
  shift_swap: "Cambio de turno",
  guard_coverage: "Guardia / Cobertura",
  vacation_period: "Periodo vacacional",
  license_permit: "Licencia / Permiso",
  union_deadline: "Trámite sindical",
  training_course: "Capacitación",
  medical_appointment: "Cita médica",
  general_reminder: "Recordatorio",
}

const DEFAULT_CONCEPT_NAMES: Record<string, string> = {
  "002": "Sueldo Base Tabular",
  "011": "Ayuda para Pago de Renta (Cláusula 63 Bis B)",
  "020": "Ayuda para Renta (Cláusula 63 Bis A)",
  "022": "Tiempo Extraordinario",
  "029": "Prima Vacacional",
  "032": "Estímulo de Asistencia",
  "033": "Estímulo de Puntualidad",
  "048": "Ayuda para Actividades Culturales y Recreativas",
  "049": "Aguinaldo",
  "050": "Ayuda de Despensa",
  "055": "Fondo de Ahorro (2ª de Julio)",
  "151": "Impuesto Sobre la Renta (ISR)",
  "152": "Fondo de Jubilaciones y Pensiones",
  "180": "Cuota Sindical Ordinaria",
}

function normalizeConceptCode(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return ""
  if (/^\d{1,2}$/.test(trimmed)) {
    return trimmed.padStart(3, "0")
  }
  return trimmed
}

function safeFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function formatCommitmentTypeLabel(type?: string | null): string {
  const key = (type ?? "").trim()
  return COMMITMENT_TYPE_LABELS[key] ?? "Compromiso laboral"
}

/**
 * Construye de forma pura y determinista el payload de snapshot offline a partir
 * del contexto laboral del servidor, el último tarjetón local (opcional) y los
 * compromisos de la agenda.
 */
export function buildOfflineWorkerSnapshot(params: {
  ownerId: string
  workerContext?: WorkerContextSnapshotInput | null
  localPayslip?: LocalPayslipSnapshotInput | null
  commitments?: CommitmentSnapshotInput[] | null
  nowMs?: number
}): OfflineWorkerSnapshotPayload | null {
  const ownerId = (params.ownerId ?? "").trim()
  if (!ownerId || ownerId.length > 128 || ownerId.includes("..") || ownerId.includes("/")) {
    return null
  }

  const wc = params.workerContext ?? null
  const localSlip = params.localPayslip ?? null

  const profile: OfflineProfileSummaryPayload = {
    fullName: wc?.profile?.fullName?.trim() || null,
    matricula: wc?.profile?.matricula?.trim() || null,
    categoria:
      wc?.employment?.categoryName?.trim() ||
      wc?.profile?.categoria?.trim() ||
      null,
    antiguedad:
      wc?.employment?.seniorityRaw?.trim() ||
      wc?.profile?.antiguedad?.trim() ||
      null,
    adscripcion:
      wc?.employment?.adscripcion?.trim() ||
      wc?.profile?.adscripcion?.trim() ||
      null,
    workdayHours:
      typeof wc?.employment?.workdayHours === "number" &&
      Number.isFinite(wc.employment.workdayHours) &&
      wc.employment.workdayHours > 0
        ? wc.employment.workdayHours
        : null,
    shift: wc?.employment?.shift?.trim() || null,
  }

  // Construcción de líneas del último tarjetón
  const lines: OfflineConceptLinePayload[] = []
  const localEarnings = localSlip?.earnings ?? localSlip?.perceptions ?? []
  const localDeductions = localSlip?.deductions ?? []

  if (Array.isArray(localEarnings) && localEarnings.length > 0) {
    for (const item of localEarnings) {
      const code = normalizeConceptCode(item.conceptCode ?? item.code)
      const amount = safeFiniteNumber(item.amount, 0)
      if (!code && amount <= 0) continue
      const desc =
        (item.description ?? item.name ?? "").trim() ||
        DEFAULT_CONCEPT_NAMES[code] ||
        `Concepto ${code}`
      lines.push({
        code,
        description: desc,
        amount,
        kind: "earning",
      })
    }
  } else if (Array.isArray(wc?.payroll?.recurringConcepts)) {
    for (const raw of wc.payroll.recurringConcepts) {
      if (!raw || typeof raw !== "object") continue
      const rec = raw as {
        conceptCode?: unknown
        conceptName?: unknown
        lastAmount?: unknown
      }
      const code = normalizeConceptCode(
        typeof rec.conceptCode === "string" ? rec.conceptCode : "",
      )
      const amount = safeFiniteNumber(rec.lastAmount, 0)
      if (!code || amount <= 0) continue
      const desc =
        (typeof rec.conceptName === "string" ? rec.conceptName.trim() : "") ||
        DEFAULT_CONCEPT_NAMES[code] ||
        `Percepción ${code}`
      lines.push({
        code,
        description: desc,
        amount,
        kind: "earning",
      })
    }
  }

  if (Array.isArray(localDeductions) && localDeductions.length > 0) {
    for (const item of localDeductions) {
      const code = normalizeConceptCode(item.conceptCode ?? item.code)
      const amount = safeFiniteNumber(item.amount, 0)
      if (!code && amount <= 0) continue
      const desc =
        (item.description ?? item.name ?? "").trim() ||
        DEFAULT_CONCEPT_NAMES[code] ||
        `Deducción ${code}`
      lines.push({
        code,
        description: desc,
        amount,
        kind: "deduction",
      })
    }
  }

  const localPeriodLabel =
    typeof localSlip?.period === "string"
      ? localSlip.period
      : localSlip?.period?.label ||
        localSlip?.period?.id ||
        localSlip?.periodRaw ||
        null

  const periodLabel =
    wc?.payroll?.latestPeriod?.trim() ||
    wc?.meta?.activePayslipPeriod?.trim() ||
    localPeriodLabel?.trim() ||
    null

  const totalEarnings = safeFiniteNumber(
    wc?.payroll?.totalEarnings ??
      localSlip?.totalEarnings ??
      localSlip?.totalPerceptions,
    0,
  )
  const totalDeductions = safeFiniteNumber(
    wc?.payroll?.totalDeductions ?? localSlip?.totalDeductions,
    0,
  )
  const netPay = safeFiniteNumber(
    wc?.payroll?.netPay ?? localSlip?.netPay ?? localSlip?.netAmount,
    0,
  )
  const vacationDueDate =
    wc?.vacations?.dueDate?.trim() || wc?.vacations?.porVencer?.trim() || null

  const hasPayslipData =
    Boolean(periodLabel) ||
    totalEarnings > 0 ||
    netPay > 0 ||
    lines.length > 0

  const latestPayslip: OfflinePayslipSummaryPayload | null = hasPayslipData
    ? {
        periodLabel: periodLabel || "Última quincena confirmada",
        totalEarnings,
        totalDeductions,
        netPay,
        vacationDueDate,
        lines: lines.slice(0, 80),
      }
    : null

  // Extracción explícita de Concepto 002 + Concepto 011 (Golden Behavior 2ª de Julio)
  const base002 = lines
    .filter((l) => l.kind === "earning" && l.code === "002")
    .reduce((acc, l) => acc + l.amount, 0)
  const base011 = lines
    .filter((l) => l.kind === "earning" && l.code === "011")
    .reduce((acc, l) => acc + l.amount, 0)

  const integratedMonthly =
    safeFiniteNumber(wc?.payroll?.integratedMonthlySalary, 0) > 0
      ? safeFiniteNumber(wc?.payroll?.integratedMonthlySalary, 0)
      : Math.round((base002 + base011) * 2 * 100) / 100

  const workdayHours = profile.workdayHours ?? 8

  const commitments: OfflineCommitmentItemPayload[] = (params.commitments ?? [])
    .filter((c) => Boolean(c && c.id && c.title && c.startAt))
    .slice(0, 50)
    .map((c) => ({
      id: c.id.trim(),
      title: c.title.trim(),
      type: (c.type ?? "general_reminder").trim() || "general_reminder",
      typeLabel: formatCommitmentTypeLabel(c.type),
      startAt: c.startAt.trim(),
      status: (c.status ?? "pending").trim() || "pending",
      notes: c.notes?.trim() || null,
    }))

  return {
    ownerId,
    syncedAtMs: params.nowMs ?? Date.now(),
    contextRevision: wc?.meta?.contextRevision?.trim() || null,
    profile,
    latestPayslip,
    commitments,
    calculatorBase: {
      sueldoBaseQuincenal002: Math.round(base002 * 100) / 100,
      ayudaRentaQuincenal011: Math.round(base011 * 100) / 100,
      sueldoMensualIntegrado: integratedMonthly,
      workdayHours,
    },
  }
}

/**
 * Envía el snapshot laboral al puente nativo de Android (`laVeintePdfBridge`).
 * Devuelve `true` si el mensaje fue entregado al bridge nativo, o `false` en web/SSR.
 */
export function syncOfflineSnapshotToNative(
  snapshot: OfflineWorkerSnapshotPayload | null,
): boolean {
  if (!snapshot || typeof window === "undefined") return false
  if (!isNativePdfShareSupported()) return false

  const message = {
    action: "syncOfflineSnapshot",
    userId: snapshot.ownerId,
    snapshot,
  }

  try {
    if (
      window.laVeintePdfBridge &&
      typeof window.laVeintePdfBridge.postMessage === "function"
    ) {
      window.laVeintePdfBridge.postMessage(JSON.stringify(message))
      return true
    }
    if (
      window.LaVeinteApp &&
      typeof window.LaVeinteApp.sendPdfShareMessage === "function"
    ) {
      return window.LaVeinteApp.sendPdfShareMessage(message)
    }
  } catch {
    // Best-effort: nunca interrumpir la sesión del usuario
  }
  return false
}

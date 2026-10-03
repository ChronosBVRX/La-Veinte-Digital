export type CommitmentType =
  | "txt_substitution"
  | "overtime"
  | "shift_change"
  | "sport"
  | "guardia_festiva"
  | "falta_injustificada"
  | "incapacidad"
  | "pase_salida"
  | "vacaciones"
  | "no_pagado"
  | "other"
  | "general_reminder"

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  txt_substitution: "TxT",
  overtime: "Tiempo extra",
  shift_change: "Cambio de turno",
  sport: "Deporte",
  guardia_festiva: "Guardia festiva",
  falta_injustificada: "Falta injustificada",
  incapacidad: "Incapacidad",
  pase_salida: "Pase de salida/entrada",
  vacaciones: "Vacaciones",
  no_pagado: "Reclamación pendiente",
  other: "Otro compromiso",
  general_reminder: "Recordatorio general",
}

export const COMMITMENT_TYPE_ICONS: Record<CommitmentType, string> = {
  txt_substitution: "🔄",
  overtime: "⏱",
  shift_change: "🔀",
  sport: "🏃",
  guardia_festiva: "🎉",
  falta_injustificada: "🚫",
  incapacidad: "🏥",
  pase_salida: "🚪",
  vacaciones: "🏖",
  no_pagado: "📋",
  other: "📌",
  general_reminder: "🔔",
}

export const COMMITMENT_TYPES: CommitmentType[] = [
  "txt_substitution",
  "overtime",
  "shift_change",
  "sport",
  "guardia_festiva",
  "falta_injustificada",
  "incapacidad",
  "pase_salida",
  "vacaciones",
  "no_pagado",
  "other",
  "general_reminder",
]

/** Tipos que se pueden registrar desde la agenda actual (tipos autorizados para nuevas altas).
 * Los demás se conservan únicamente para leer compromisos históricos sin perder compatibilidad. */
export const PRIMARY_COMMITMENT_TYPES: CommitmentType[] = [
  "vacaciones",
  "overtime",
  "falta_injustificada",
  "no_pagado",
  "txt_substitution",
  "general_reminder",
]

export type SportModality =
  | "late_arrival"
  | "early_departure"
  | "during_shift"
  | "scheduled_activity"

export const SPORT_MODALITY_LABELS: Record<SportModality, string> = {
  late_arrival: "Entrada posterior",
  early_departure: "Salida anticipada",
  during_shift: "Dentro de la jornada",
  scheduled_activity: "Actividad programada",
}

export type AffectedShift =
  | "morning"
  | "afternoon"
  | "night"
  | "accumulated"
  | "other"

export const AFFECTED_SHIFT_LABELS: Record<AffectedShift, string> = {
  morning: "Matutino",
  afternoon: "Vespertino",
  night: "Nocturno",
  accumulated: "Jornada acumulada",
  other: "Otro",
}

export type ClaimStatus = "pendiente" | "en_seguimiento" | "resuelta"

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pendiente: "Pendiente",
  en_seguimiento: "En seguimiento",
  resuelta: "Resuelta",
}

export type TxtPaidStatus = "si" | "no" | "pendiente"

export const TXT_PAID_STATUS_LABELS: Record<TxtPaidStatus, string> = {
  si: "Sí (pagado)",
  no: "No (no pagado)",
  pendiente: "Pendiente",
}

export type ReminderPriority = "normal" | "importante" | "urgente"

export const REMINDER_PRIORITY_LABELS: Record<ReminderPriority, string> = {
  normal: "Normal",
  importante: "Importante",
  urgente: "Urgente",
}

export type ReminderRecurrence = "none" | "daily" | "weekly" | "monthly"

export const REMINDER_RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  none: "Ninguna",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
}

export const CLAIMABLE_CONCEPTS = [
  { code: "037", label: "Tiempo extraordinario (Concepto 037)" },
  { code: "033", label: "Estímulo de puntualidad (Concepto 033)" },
  { code: "032", label: "Estímulo de asistencia (Concepto 032)" },
  { code: "172", label: "Falta injustificada indebida (Descuento 172)" },
  { code: "003", label: "Guardia festiva / descanso laborado" },
  { code: "otro", label: "Otro concepto o ajuste salarial" },
] as const

/** Datos propios de cada tipo de registro. Se persisten en worker_commitments.details. */
export interface CommitmentDetails {
  allDay?: boolean
  shift?: AffectedShift
  affectedShift?: AffectedShift
  authorizedBy?: string
  // Fechas y quincena de aplicación contractual / pago
  incidenceFortnightKey?: string
  incidenceFortnightLabel?: string
  expectedPaymentFortnightKey?: string
  expectedPaymentFortnightLabel?: string
  expectedPaymentDate?: string
  paydayReminderEnabled?: boolean
  // Tiempo extra (overtime)
  estimatedEarnings?: number
  hoursCalculated?: number
  hourlyRate?: number
  earningsFormula?: string
  isHolidayOrRestDay?: boolean
  overtimeFactor?: number
  jornadaUsed?: number
  // Falta injustificada
  affectedFortnight?: string
  fortnightLabel?: string
  baseSalaryUsed?: number
  dailySalary?: number
  estimatedDeduction?: number
  deductionFormula?: string
  calculationStatus?: "calculated" | "pending"
  missingDataReason?: string
  // Vacaciones (vacaciones)
  vacationPeriodIndex?: number
  vacationRoleLabel?: string
  vacationMark?: number | string
  vacationUnits?: number
  premium029?: number
  culturalHelp048?: number
  grossVacationExtra?: number
  // Reclamación pendiente
  claimFiledDate?: string
  claimReference?: string
  responsibleArea?: string
  claimStatus?: ClaimStatus
  claimedConcepts?: string[]
  claimedConceptsLabels?: string[]
  estimatedClaimAmount?: number
  clausula8Deadline?: string
  targetPaymentFortnightKey?: string
  targetPaymentFortnightLabel?: string
  targetPaymentDate?: string
  // TxT
  paidStatus?: TxtPaidStatus
  // Recordatorio general
  reminderAt?: string
  priority?: ReminderPriority
  recurrence?: ReminderRecurrence
  notificationsEnabled?: boolean
  location?: string
  // Históricos
  activity?: string
  sportModality?: SportModality
}

export interface Reminder {
  dayBefore: boolean
  hoursBefore: boolean
  atStart: boolean
}

export interface WorkerCommitment {
  id: string
  userId: string
  type: CommitmentType
  title: string
  startAt: string
  endAt: string
  workplace: string
  service: string
  substituteWorkerName: string
  notes: string
  details?: CommitmentDetails
  reminder: Reminder
  status: "active" | "completed" | "cancelled"
  createdAt: string
}

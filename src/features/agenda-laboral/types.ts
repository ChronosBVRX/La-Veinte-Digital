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

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  txt_substitution: "Sustitución TxT",
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
]

/** Tipos que se pueden registrar desde la agenda actual. Los demás se conservan
 * únicamente para leer compromisos históricos sin perder compatibilidad. */
export const PRIMARY_COMMITMENT_TYPES: CommitmentType[] = [
  "overtime",
  "sport",
  "falta_injustificada",
  "no_pagado",
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

/** Datos propios de cada tipo de registro. Se persisten en worker_commitments.details. */
export interface CommitmentDetails {
  allDay?: boolean
  authorizedBy?: string
  activity?: string
  sportModality?: SportModality
  affectedShift?: AffectedShift
  claimFiledDate?: string
  claimReference?: string
  responsibleArea?: string
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

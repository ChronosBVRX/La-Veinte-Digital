export type CommitmentType =
  | "txt_substitution"
  | "overtime"
  | "shift_change"
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
  guardia_festiva: "Guardia festiva",
  falta_injustificada: "Falta injustificada",
  incapacidad: "Incapacidad",
  pase_salida: "Pase de salida/entrada",
  vacaciones: "Vacaciones",
  no_pagado: "No pagado",
  other: "Otro compromiso",
}

export const COMMITMENT_TYPE_ICONS: Record<CommitmentType, string> = {
  txt_substitution: "🔄",
  overtime: "⏱",
  shift_change: "🔀",
  guardia_festiva: "🎉",
  falta_injustificada: "🚫",
  incapacidad: "🏥",
  pase_salida: "🚪",
  vacaciones: "🏖",
  no_pagado: "⚠️",
  other: "📌",
}

export const COMMITMENT_TYPES: CommitmentType[] = [
  "txt_substitution",
  "overtime",
  "shift_change",
  "guardia_festiva",
  "falta_injustificada",
  "incapacidad",
  "pase_salida",
  "vacaciones",
  "no_pagado",
  "other",
]

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
  reminder: Reminder
  status: "active" | "completed" | "cancelled"
  createdAt: string
}

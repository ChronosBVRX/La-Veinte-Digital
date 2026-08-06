export type CommitmentType = "txt_substitution" | "overtime" | "shift_change" | "other"

export const COMMITMENT_TYPE_LABELS: Record<CommitmentType, string> = {
  txt_substitution: "Sustitución TxT",
  overtime: "Tiempo extra",
  shift_change: "Cambio de turno",
  other: "Otro compromiso",
}

export const COMMITMENT_TYPE_ICONS: Record<CommitmentType, string> = {
  txt_substitution: "🔄",
  overtime: "⏱",
  shift_change: "🔀",
  other: "📌",
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
  reminder: Reminder
  status: "active" | "completed" | "cancelled"
  createdAt: string
}

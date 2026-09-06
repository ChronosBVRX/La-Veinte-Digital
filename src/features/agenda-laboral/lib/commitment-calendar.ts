import type { WorkerCommitment, CommitmentType } from "../types"
import {
  AFFECTED_SHIFT_LABELS,
  COMMITMENT_TYPE_LABELS,
  COMMITMENT_TYPE_ICONS,
  SPORT_MODALITY_LABELS,
} from "../types"

export const DEFAULT_AGENDA_TIMEZONE = "America/Mexico_City"

/**
 * Returns the IANA timezone of the runtime or fallback to Mexico City.
 */
export function getRuntimeTimezone(fallback = DEFAULT_AGENDA_TIMEZONE): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz && tz.length > 0 ? tz : fallback
  } catch {
    return fallback
  }
}

/**
 * Formats a Date or ISO string into YYYY-MM-DD in the target timezone without relying on UTC getDate().
 */
export function getLocalDateString(
  dateInput: Date | string | number,
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return ""

  // Format parts in target timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return formatter.format(d) // "en-CA" formats as YYYY-MM-DD
}

/**
 * Formats today's date in YYYY-MM-DD in the target timezone.
 */
export function getTodayLocalDateString(
  timeZone = DEFAULT_AGENDA_TIMEZONE,
  now = new Date(),
): string {
  return getLocalDateString(now, timeZone)
}

/**
 * Formats tomorrow's date in YYYY-MM-DD in the target timezone.
 */
export function getTomorrowLocalDateString(
  timeZone = DEFAULT_AGENDA_TIMEZONE,
  now = new Date(),
): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return getLocalDateString(tomorrow, timeZone)
}

/**
 * Formats a Date or ISO string into 24-hour time HH:MM in the target timezone.
 */
export function formatLocalTime(
  dateInput: Date | string | number,
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return ""

  return d.toLocaleTimeString("es-MX", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/**
 * Checks whether a commitment spans into or belongs to targetDateStr ("YYYY-MM-DD").
 * A commitment belongs to targetDateStr if:
 * 1. Its local start date is targetDateStr, OR
 * 2. It is an overnight commitment that started the day before and ends on or after targetDateStr start.
 */
export function isCommitmentOnLocalDate(
  commitment: { startAt: string; endAt: string; status?: string },
  targetDateStr: string,
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): boolean {
  if (commitment.status && commitment.status !== "active") return false

  const startDay = getLocalDateString(commitment.startAt, timeZone)
  if (startDay === targetDateStr) return true

  const endDay = getLocalDateString(commitment.endAt, timeZone)
  if (startDay < targetDateStr && endDay === targetDateStr) {
    // If it ends on targetDateStr, check if it actually covers any hours of targetDateStr
    const end = new Date(commitment.endAt)
    const endTimeStr = formatLocalTime(end, timeZone)
    // If it ends after 00:00 on that day, it spans into targetDateStr
    if (endTimeStr > "00:00") {
      return true
    }
  }

  return false
}

/**
 * Returns all active commitments belonging to targetDateStr, sorted chronologically.
 */
export function getCommitmentsForLocalDate(
  commitments: WorkerCommitment[],
  targetDateStr: string,
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): WorkerCommitment[] {
  return commitments
    .filter((c) => isCommitmentOnLocalDate(c, targetDateStr, timeZone))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

/**
 * Returns all active commitments for today, sorted chronologically.
 */
export function getTodayCommitments(
  commitments: WorkerCommitment[],
  now = new Date(),
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): WorkerCommitment[] {
  const todayStr = getTodayLocalDateString(timeZone, now)
  return getCommitmentsForLocalDate(commitments, todayStr, timeZone)
}

/**
 * Checks whether an active commitment is currently in progress.
 */
export function isCommitmentInProgress(
  commitment: { startAt: string; endAt: string; status?: string },
  now = new Date(),
): boolean {
  if (commitment.status && commitment.status !== "active") return false
  const nowMs = now.getTime()
  const startMs = new Date(commitment.startAt).getTime()
  const endMs = new Date(commitment.endAt).getTime()
  return startMs <= nowMs && nowMs < endMs
}

/**
 * Returns the relation of a commitment's start date relative to today in the target timezone.
 */
export function getCommitmentDayRelation(
  commitment: { startAt: string },
  now = new Date(),
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): "today" | "tomorrow" | "past" | "future" {
  const commitmentDate = getLocalDateString(commitment.startAt, timeZone)
  const todayStr = getTodayLocalDateString(timeZone, now)
  const tomorrowStr = getTomorrowLocalDateString(timeZone, now)

  if (commitmentDate === todayStr) return "today"
  if (commitmentDate === tomorrowStr) return "tomorrow"
  if (commitmentDate < todayStr) return "past"
  return "future"
}

export interface NextCommitmentResult {
  commitment: WorkerCommitment
  inProgress: boolean
}

/**
 * Finds the single next commitment for the worker:
 * 1. If any active commitment is IN PROGRESS right now, it takes highest priority.
 * 2. Otherwise, finds the earliest active commitment whose startAt is strictly in the future.
 * 3. Returns null if none exist.
 */
export function getNextCommitment(
  commitments: WorkerCommitment[],
  now = new Date(),
): NextCommitmentResult | null {
  const active = commitments.filter((c) => c.status === "active")
  const nowMs = now.getTime()

  // 1. In progress
  const inProgressList = active
    .filter((c) => isCommitmentInProgress(c, now))
    .sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime())

  if (inProgressList.length > 0) {
    return { commitment: inProgressList[0], inProgress: true }
  }

  // 2. Future commitments
  const futureList = active
    .filter((c) => new Date(c.startAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

  if (futureList.length > 0) {
    return { commitment: futureList[0], inProgress: false }
  }

  return null
}

/**
 * Formats a human date label for a commitment: "Hoy", "Mañana", or "Lunes 7 sep".
 */
export function formatHumanCommitmentDate(
  dateInput: Date | string | number,
  now = new Date(),
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): string {
  const d = typeof dateInput === "object" ? dateInput : new Date(dateInput)
  const dateStr = getLocalDateString(d, timeZone)
  const todayStr = getTodayLocalDateString(timeZone, now)
  const tomorrowStr = getTomorrowLocalDateString(timeZone, now)

  if (dateStr === todayStr) return "Hoy"
  if (dateStr === tomorrowStr) return "Mañana"

  const dayOfWeek = d.toLocaleDateString("es-MX", { timeZone, weekday: "long" })
  const dayNum = d.toLocaleDateString("es-MX", { timeZone, day: "numeric" })
  const month = d.toLocaleDateString("es-MX", { timeZone, month: "short" })

  const capitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
  return `${capitalized} ${dayNum} ${month}`
}

/**
 * Returns the effective user-facing title of a commitment.
 * Uses the custom title if present, otherwise falls back to COMMITMENT_TYPE_LABELS.
 */
export function getCommitmentDisplayTitle(commitment: {
  type: CommitmentType
  title?: string | null
}): string {
  const fallback = COMMITMENT_TYPE_LABELS[commitment.type] ?? "Compromiso"
  if (!commitment.title || commitment.title.trim().length === 0) {
    return fallback
  }
  return commitment.title.trim()
}

/**
 * Returns the icon for a commitment type.
 */
export function getCommitmentDisplayIcon(type: CommitmentType): string {
  return COMMITMENT_TYPE_ICONS[type] ?? "📌"
}

/** Indicates that a register represents a whole day instead of a timed appointment. */
export function isAllDayCommitment(commitment: Pick<WorkerCommitment, "details">): boolean {
  return commitment.details?.allDay === true
}

/** Returns the schedule text shared by Home and the agenda manager. */
export function getCommitmentScheduleLabel(
  commitment: Pick<WorkerCommitment, "startAt" | "endAt" | "details">,
  timeZone = DEFAULT_AGENDA_TIMEZONE,
): string {
  if (isAllDayCommitment(commitment)) return "Todo el día"
  return `${formatLocalTime(commitment.startAt, timeZone)}–${formatLocalTime(commitment.endAt, timeZone)}`
}

/** Builds short, human-readable details without exposing the storage schema in the UI. */
export function getCommitmentDetailLines(
  commitment: Pick<WorkerCommitment, "type" | "details">,
): string[] {
  const details = commitment.details
  if (!details) return []

  const lines: string[] = []

  if (commitment.type === "overtime" && details.authorizedBy) {
    lines.push(`Autorizó: ${details.authorizedBy}`)
  }

  if (commitment.type === "sport") {
    if (details.sportModality) {
      lines.push(SPORT_MODALITY_LABELS[details.sportModality])
    }
    if (details.activity) {
      lines.push(`Actividad: ${details.activity}`)
    }
  }

  if (commitment.type === "falta_injustificada" && details.affectedShift) {
    lines.push(`Turno afectado: ${AFFECTED_SHIFT_LABELS[details.affectedShift]}`)
  }

  if (commitment.type === "no_pagado") {
    if (details.claimFiledDate) {
      const [year, month, day] = details.claimFiledDate.split("-")
      lines.push(`Presentada: ${day}/${month}/${year}`)
    }
    if (details.claimReference) {
      lines.push(`Folio: ${details.claimReference}`)
    }
    if (details.responsibleArea) {
      lines.push(`Seguimiento con: ${details.responsibleArea}`)
    }
  }

  return lines
}

import { createClient as createServiceRoleClient } from "@supabase/supabase-js"
import { sendToUser } from "@/features/push/services/push-admin"
import {
  getLocalDateString,
  getTomorrowLocalDateString,
  formatLocalTime,
  getCommitmentDisplayTitle,
  DEFAULT_AGENDA_TIMEZONE,
} from "../lib/commitment-calendar"
import type { WorkerCommitment } from "../types"
import { rowToCommitment, type CommitmentRow } from "./commitments-supabase"

export interface ReminderJobSummary {
  dayBeforeSent: number
  hoursBeforeSent: number
  atStartSent: number
  scheduledSent: number
  totalProcessed: number
  errors: string[]
}

function getServiceRoleSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) {
    throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED")
  }
  return createServiceRoleClient(url, key)
}

/**
 * Builds the internal destination URL for a push notification deep link.
 */
export function buildAgendaDeepLink(dateStr: string, commitmentId?: string): string {
  const base = "https://la-veinte-digital.vercel.app/bitacora"
  const params = new URLSearchParams()
  if (dateStr) params.set("date", dateStr)
  if (commitmentId) params.set("commitment", commitmentId)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Checks if the current local time in target timezone is at or after 19:00.
 */
export function isEveningReminderWindow(now = new Date(), timeZone = DEFAULT_AGENDA_TIMEZONE): boolean {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now)
  const hour = Number(hourStr)
  return hour >= 19
}

/**
 * Evaluates and delivers all pending commitment reminders in an idempotent fashion.
 * Safe to be executed repeatedly by cron jobs or on-demand triggers.
 */
export async function processPendingCommitmentReminders(options?: {
  now?: Date
  dryRun?: boolean
  supabaseClient?: ReturnType<typeof createServiceRoleClient>
}): Promise<ReminderJobSummary> {
  const now = options?.now ?? new Date()
  const dryRun = options?.dryRun ?? false
  const supabase = options?.supabaseClient ?? getServiceRoleSupabase()

  const summary: ReminderJobSummary = {
    dayBeforeSent: 0,
    hoursBeforeSent: 0,
    atStartSent: 0,
    scheduledSent: 0,
    totalProcessed: 0,
    errors: [],
  }

  // 1. Query active commitments with at least one reminder enabled
  // Window: commitments whose start_at is within the next 48 hours or recently started (last 35 mins)
  const pastWindow = new Date(now.getTime() - 35 * 60 * 1000).toISOString()
  const futureWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

  let rows: CommitmentRow[] = []

  const { data: startRows, error: startErr } = await supabase
    .from("worker_commitments")
    .select("*")
    .eq("status", "active")
    .gte("start_at", pastWindow)
    .lte("start_at", futureWindow)

  if (startErr) {
    summary.errors.push(`Error al consultar compromisos: ${startErr.message}`)
    return summary
  }

  const rowMap = new Map<string, CommitmentRow>()
  for (const r of (startRows || []) as CommitmentRow[]) {
    rowMap.set(r.id, r)
  }

  // Also query active commitments that have a specific reminderAt defined in details
  try {
    const { data: reminderRows } = await supabase
      .from("worker_commitments")
      .select("*")
      .eq("status", "active")
      .not("details->>reminderAt", "is", null)

    for (const r of (reminderRows || []) as CommitmentRow[]) {
      rowMap.set(r.id, r)
    }
  } catch {
    // If not query is not supported in mock client, proceed with startRows
  }

  rows = Array.from(rowMap.values())

  if (rows.length === 0) {
    return summary
  }

  const commitments: WorkerCommitment[] = (rows as CommitmentRow[]).map(rowToCommitment)
  summary.totalProcessed = commitments.length

  const commitmentIds = commitments.map((c) => c.id)

  // 2. Query already delivered reminders for these commitments
  const { data: deliveredRows, error: delError } = await supabase
    .from("commitment_reminder_deliveries")
    .select("commitment_id, reminder_type")
    .in("commitment_id", commitmentIds)

  if (delError) {
    summary.errors.push(`Error al consultar entregas previas: ${delError.message}`)
    return summary
  }

  // Build a Set of "commitmentId:reminderType" for O(1) idempotency check
  const deliveredSet = new Set<string>()
  for (const d of deliveredRows || []) {
    deliveredSet.add(`${d.commitment_id}:${d.reminder_type}`)
  }

  // =========================================================================
  // TYPE 1: DAY_BEFORE (19:00 del día anterior)
  // =========================================================================
  const inEvening = isEveningReminderWindow(now)
  if (inEvening) {
    const tomorrowStr = getTomorrowLocalDateString(DEFAULT_AGENDA_TIMEZONE, now)

    // Filter commitments starting tomorrow with reminder_day_before = true that haven't been delivered
    const dueDayBefore = commitments.filter((c) => {
      if (c.details?.notificationsEnabled === false) return false
      if (!c.reminder.dayBefore) return false
      const cDate = getLocalDateString(c.startAt)
      if (cDate !== tomorrowStr) return false
      return !deliveredSet.has(`${c.id}:DAY_BEFORE`)
    })

    // Group by user_id to avoid notification floods (Section 10)
    const userGroups = new Map<string, WorkerCommitment[]>()
    for (const c of dueDayBefore) {
      if (!userGroups.has(c.userId)) {
        userGroups.set(c.userId, [])
      }
      userGroups.get(c.userId)!.push(c)
    }

    for (const [userId, userCommitments] of userGroups.entries()) {
      try {
        let title: string
        let body: string
        const destination = buildAgendaDeepLink(tomorrowStr)

        if (userCommitments.length === 1) {
          const single = userCommitments[0]
          const displayTitle = getCommitmentDisplayTitle(single)
          title = "La Veinte Digital"
          const timeDesc = single.details?.allDay
            ? "Todo el día"
            : `De ${formatLocalTime(single.startAt)} a ${formatLocalTime(single.endAt)}`
          const placeDesc = single.service || single.workplace ? ` · ${single.service || single.workplace}` : ""
          body = `Mañana tienes ${displayTitle}\n${timeDesc}${placeDesc}`
        } else {
          // Multiple commitments tomorrow: group them cleanly
          title = `Mañana tienes ${userCommitments.length} compromisos`
          const lines = userCommitments
            .map((c) => `${getCommitmentDisplayTitle(c)} ${c.details?.allDay ? "(todo el día)" : formatLocalTime(c.startAt)}`)
            .join(" · ")
          body = lines
        }

        if (!dryRun) {
          await sendToUser(userId, {
            type: "AGENDA",
            title,
            body,
            destination,
          })

          // Record delivery for every commitment in the group
          const inserts = userCommitments.map((c) => ({
            commitment_id: c.id,
            user_id: userId,
            reminder_type: "DAY_BEFORE",
            scheduled_for: now.toISOString(),
            status: "sent",
          }))

          const { error: insErr } = await supabase
            .from("commitment_reminder_deliveries")
            .insert(inserts)

          if (insErr) {
            console.error("[commitment-reminders] Insert delivery error:", insErr.message)
          }
        }

        userCommitments.forEach((c) => deliveredSet.add(`${c.id}:DAY_BEFORE`))
        summary.dayBeforeSent += userCommitments.length
      } catch (e) {
        summary.errors.push(`Error enviando DAY_BEFORE a ${userId}: ${e instanceof Error ? e.message : "Desconocido"}`)
      }
    }
  }

  // =========================================================================
  // TYPE 2: HOURS_BEFORE (Aprox 2 horas antes de start_at)
  // =========================================================================
  const nowMs = now.getTime()
  const dueHoursBefore = commitments.filter((c) => {
    if (c.details?.notificationsEnabled === false) return false
    if (!c.reminder.hoursBefore) return false
    if (deliveredSet.has(`${c.id}:HOURS_BEFORE`)) return false

    const startMs = new Date(c.startAt).getTime()
    const diffMs = startMs - nowMs

    // Trigger if between 0 and 2.25 hours before start
    // (covers a 15-minute cron running every 15 mins)
    return diffMs > 0 && diffMs <= 2.25 * 60 * 60 * 1000
  })

  for (const c of dueHoursBefore) {
    try {
      const displayTitle = getCommitmentDisplayTitle(c)
      const title = `Tu ${displayTitle.toLowerCase()} comienza en 2 horas`
      const placeDesc = c.service || c.workplace ? ` · ${c.service || c.workplace}` : ""
      const body = `Hoy a las ${formatLocalTime(c.startAt)}${placeDesc}`
      const destination = buildAgendaDeepLink(getLocalDateString(c.startAt), c.id)

      if (!dryRun) {
        await sendToUser(c.userId, {
          type: "AGENDA",
          title,
          body,
          destination,
        })

        await supabase.from("commitment_reminder_deliveries").insert({
          commitment_id: c.id,
          user_id: c.userId,
          reminder_type: "HOURS_BEFORE",
          scheduled_for: now.toISOString(),
          status: "sent",
        })
      }

      deliveredSet.add(`${c.id}:HOURS_BEFORE`)
      summary.hoursBeforeSent++
    } catch (e) {
      summary.errors.push(`Error enviando HOURS_BEFORE para ${c.id}: ${e instanceof Error ? e.message : "Desconocido"}`)
    }
  }

  // =========================================================================
  // TYPE 3: AT_START (Al comenzar el evento o en hora de seguimiento)
  // =========================================================================
  const dueAtStart = commitments.filter((c) => {
    if (c.details?.notificationsEnabled === false) return false
    if (!c.reminder.atStart) return false
    if (deliveredSet.has(`${c.id}:AT_START`)) return false

    const startMs = new Date(c.startAt).getTime()
    const endMs = new Date(c.endAt).getTime()

    // Trigger if startMs <= nowMs and nowMs is within 25 minutes of starting and before endMs
    return nowMs >= startMs && nowMs <= startMs + 25 * 60 * 1000 && nowMs < endMs
  })

  for (const c of dueAtStart) {
    try {
      const displayTitle = getCommitmentDisplayTitle(c)
      const title = c.type === "general_reminder" ? c.title : `Es hora de tu ${displayTitle.toLowerCase()}`
      const placeDesc = c.service || c.workplace ? ` · ${c.service || c.workplace}` : ""
      const body = c.notes?.trim()
        ? `${c.notes.trim()}${placeDesc}`
        : `Programada para las ${formatLocalTime(c.startAt)}${placeDesc}`
      const destination = buildAgendaDeepLink(getLocalDateString(c.startAt), c.id)

      if (!dryRun) {
        await sendToUser(c.userId, {
          type: "AGENDA",
          title,
          body,
          destination,
        })

        await supabase.from("commitment_reminder_deliveries").insert({
          commitment_id: c.id,
          user_id: c.userId,
          reminder_type: "AT_START",
          scheduled_for: now.toISOString(),
          status: "sent",
        })
      }

      deliveredSet.add(`${c.id}:AT_START`)
      summary.atStartSent++
    } catch (e) {
      summary.errors.push(`Error enviando AT_START para ${c.id}: ${e instanceof Error ? e.message : "Desconocido"}`)
    }
  }

  // =========================================================================
  // TYPE 4: SCHEDULED_TIME (Fecha y hora programada específica en details.reminderAt)
  // =========================================================================
  const dueScheduled = commitments.filter((c) => {
    if (c.details?.notificationsEnabled === false) return false
    if (!c.details?.reminderAt) return false
    if (deliveredSet.has(`${c.id}:SCHEDULED_TIME`)) return false

    const schedMs = new Date(c.details.reminderAt).getTime()
    return nowMs >= schedMs && nowMs <= schedMs + 25 * 60 * 1000
  })

  for (const c of dueScheduled) {
    try {
      const displayTitle = getCommitmentDisplayTitle(c)
      const title = c.type === "general_reminder" ? c.title : `Recordatorio: ${displayTitle}`
      const placeDesc = c.details?.location || c.workplace ? ` · ${c.details?.location || c.workplace}` : ""
      const body = c.notes?.trim()
        ? `${c.notes.trim()}${placeDesc}`
        : `Recordatorio programado para hoy${placeDesc}`
      const destination = buildAgendaDeepLink(getLocalDateString(c.startAt), c.id)

      if (!dryRun) {
        await sendToUser(c.userId, {
          type: "AGENDA",
          title,
          body,
          destination,
        })

        await supabase.from("commitment_reminder_deliveries").insert({
          commitment_id: c.id,
          user_id: c.userId,
          reminder_type: "SCHEDULED_TIME",
          scheduled_for: now.toISOString(),
          status: "sent",
        })
      }

      deliveredSet.add(`${c.id}:SCHEDULED_TIME`)
      summary.scheduledSent++
    } catch (e) {
      summary.errors.push(`Error enviando SCHEDULED_TIME para ${c.id}: ${e instanceof Error ? e.message : "Desconocido"}`)
    }
  }

  return summary
}

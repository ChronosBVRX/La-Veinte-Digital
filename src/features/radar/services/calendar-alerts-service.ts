import {
  getMonthData,
  getImssMandatoryRestDaysForMonth,
} from "@/shared/data/calendario"
import type { CalendarAlertItem, CalendarDayEvaluation } from "../types"
import { createPushCampaign, processCampaignBatch } from "@/features/push/services/campaign-worker"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

export const MEXICO_TIMEZONE = "America/Mexico_City"

/**
 * Obtiene la fecha desglosada en la zona horaria canónica de México.
 */
export function getMexicoCityDate(now = new Date()): {
  year: number
  monthIndex: number
  day: number
  dateStr: string
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MEXICO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const y = Number(parts.find((p) => p.type === "year")?.value ?? now.getFullYear())
  const m = Number(parts.find((p) => p.type === "month")?.value ?? now.getMonth() + 1)
  const d = Number(parts.find((p) => p.type === "day")?.value ?? now.getDate())

  const monthIndex = m - 1
  const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

  return { year: y, monthIndex, day: d, dateStr }
}

/**
 * Evalúa los eventos laborales para un día específico (pago por banco, vacaciones, interactivo).
 */
export function evaluateCalendarDate(year: number, monthIndex: number, day: number): CalendarDayEvaluation {
  const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const monthData = getMonthData(year, monthIndex)
  const alerts: CalendarAlertItem[] = []

  if (monthData?.events) {
    const { santander, otros, cheque, jubilados, vacacional, interactivo } = monthData.events

    // 1. Pago Santander y Scotiabank
    if (santander && santander.includes(day)) {
      alerts.push({
        kind: "pago_santander",
        title: "Hoy pagan en Santander y Scotiabank",
        message: "Hoy se dispersa la quincena para trabajadores con cuenta en Santander y Scotiabank.",
        date: dateStr,
        badge: "PAGO SANTANDER",
      })
    }

    // 2. Pago Banamex, Banorte, BBVA y demás
    if (otros && otros.includes(day)) {
      alerts.push({
        kind: "pago_otros_bancos",
        title: "Hoy pagan en Banamex, Banorte, BBVA y demás bancos",
        message: "Hoy se dispersa la quincena en Banamex, Banorte, BBVA y el resto de los bancos.",
        date: dateStr,
        badge: "PAGO BANCOS",
      })
    }

    // 3. Pago con cheque
    if (cheque && cheque.includes(day)) {
      alerts.push({
        kind: "pago_cheque",
        title: "Hoy es el día de pago con cheque",
        message: "Hoy se efectúa el pago de nómina con cheque para el personal correspondiente.",
        date: dateStr,
        badge: "PAGO CHEQUE",
      })
    }

    // 4. Pago a jubilados
    if (jubilados && jubilados.includes(day)) {
      alerts.push({
        kind: "pago_jubilados",
        title: "Hoy pagan a jubilados y pensionados",
        message: "Hoy se realiza la dispersión de pensión y nómina para compañeros jubilados del IMSS.",
        date: dateStr,
        badge: "JUBILADOS",
      })
    }

    // 5. Inicio de periodo vacacional
    if (vacacional && vacacional.includes(day)) {
      alerts.push({
        kind: "inicio_vacaciones",
        title: "Hoy inicia periodo vacacional",
        message: "Hoy inicia el periodo vacacional programado conforme al rol oficial del CCT.",
        date: dateStr,
        badge: "VACACIONES",
      })
    }

    // 6. Periodo interactivo (detección de inicio y fin)
    if (interactivo && interactivo.includes(day)) {
      const prevDayInInteractive = interactivo.includes(day - 1)
      const nextDayInInteractive = interactivo.includes(day + 1)

      // Inicio: el día anterior no estaba en el bloque
      if (!prevDayInInteractive) {
        alerts.push({
          kind: "inicio_interactivo",
          title: "Hoy inicia periodo de interactivo",
          message: "Compañeros: hoy inicia el periodo de rol interactivo de coberturas y descansos.",
          date: dateStr,
          badge: "INICIO INTERACTIVO",
        })
      }

      // Fin: el día posterior no está en el bloque
      if (!nextDayInInteractive) {
        alerts.push({
          kind: "fin_interactivo",
          title: "Hoy termina periodo de interactivo",
          message: "Aviso: hoy es el último día del periodo de rol interactivo. Toma tus previsiones.",
          date: dateStr,
          badge: "FIN INTERACTIVO",
        })
      }
    }
  }

  // 7. Descanso obligatorio CCT
  const restDays = getImssMandatoryRestDaysForMonth(year, monthIndex)
  const matchingRest = restDays.find((rd) => rd.day === day)
  if (matchingRest) {
    alerts.push({
      kind: "descanso_cct",
      title: `Descanso CCT: ${matchingRest.title}`,
      message: `Hoy es día de descanso obligatorio estipulado en la Cláusula 46-III del CCT (${matchingRest.title}).`,
      date: dateStr,
      badge: "DESCANSO CCT",
    })
  }

  const hasEvents = alerts.length > 0

  let pushPayload: CalendarDayEvaluation["pushPayload"] | undefined = undefined
  if (hasEvents) {
    if (alerts.length === 1) {
      pushPayload = {
        title: alerts[0].title,
        body: alerts[0].message,
        destination: "/calendario",
      }
    } else {
      const title = "Avisos de Nómina y Calendario Laboral"
      const body = alerts.map((a) => `• ${a.title}`).join("\n")
      pushPayload = {
        title,
        body,
        destination: "/calendario",
      }
    }
  }

  return {
    date: dateStr,
    hasEvents,
    alerts,
    pushPayload,
  }
}

/**
 * Evalúa los eventos laborales del día actual de hoy en México.
 */
export function evaluateTodayCalendar(): CalendarDayEvaluation {
  const { year, monthIndex, day } = getMexicoCityDate()
  return evaluateCalendarDate(year, monthIndex, day)
}

/**
 * Obtiene los próximos eventos del calendario laboral para los siguientes N días.
 */
export function getUpcomingCalendarAlerts(daysCount = 14, fromDate = new Date()): CalendarDayEvaluation[] {
  const result: CalendarDayEvaluation[] = []
  const current = new Date(fromDate)

  for (let i = 1; i <= daysCount; i++) {
    const nextDate = new Date(current)
    nextDate.setDate(current.getDate() + i)

    const { year, monthIndex, day } = getMexicoCityDate(nextDate)
    const evalResult = evaluateCalendarDate(year, monthIndex, day)
    if (evalResult.hasEvents) {
      result.push(evalResult)
    }
  }

  return result
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceRoleClient(url, key)
}

/**
 * Comprueba de forma idempotente si ya se envió la notificación de calendario para una fecha dada.
 */
export async function isCalendarNotificationDispatched(dateStr: string): Promise<boolean> {
  const supabase = serviceClient()
  if (!supabase) return false

  try {
    const { data } = await supabase
      .from("push_campaigns")
      .select("id")
      .eq("idempotency_key", `calendar_push_${dateStr}`)
      .single()

    return !!data
  } catch {
    return false
  }
}

/**
 * Despacha la notificación de calendario del día a todos los dispositivos activos.
 */
export async function dispatchCalendarPushForDate(
  dateEvaluation: CalendarDayEvaluation,
  options?: { creatorId?: string; isTest?: boolean }
): Promise<{ ok: boolean; campaignId?: string; error?: string; noRecipients?: boolean }> {
  if (!dateEvaluation.hasEvents || !dateEvaluation.pushPayload) {
    return { ok: false, error: "No hay eventos programados para esta fecha." }
  }

  const { title, body, destination } = dateEvaluation.pushPayload
  const isTest = options?.isTest ?? false
  const idempotencyKey = isTest
    ? `calendar_test_${dateEvaluation.date}_${Date.now()}`
    : `calendar_push_${dateEvaluation.date}`

  try {
    const { campaign, noRecipients } = await createPushCampaign({
      purpose: isTest ? "TEST" : "LIVE",
      audience: isTest ? "SELF" : "ALL",
      title,
      body,
      destination,
      type: "AGENDA",
      creatorId: options?.creatorId ?? "00000000-0000-0000-0000-000000000000",
      idempotencyKey,
    })

    if (!campaign) {
      return { ok: false, error: "No se pudo registrar la campaña de notificación." }
    }

    // Procesar lote inmediatamente si hay destinatarios
    if (!noRecipients) {
      await processCampaignBatch(campaign.id, 500)
    }

    return { ok: true, campaignId: campaign.id, noRecipients }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido al despachar push"
    return { ok: false, error: msg }
  }
}

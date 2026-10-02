"use server"

import { revalidatePath } from "next/cache"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { runRadarScan } from "../services/radar-scanner"
import { saveTopics, updateTopicStatus } from "../services/radar-store"
import {
  evaluateTodayCalendar,
  evaluateCalendarDate,
  dispatchCalendarPushForDate,
} from "../services/calendar-alerts-service"
import type { RadarStatus } from "../types"

export interface RadarActionResult {
  ok: boolean
  message?: string
  error?: string
  added?: number
  total?: number
  campaignId?: string
}

/**
 * Server Action: Dispara escaneo del radar sobre fuentes públicas y clasifica con IA.
 */
export async function scanRadarAction(): Promise<RadarActionResult> {
  const { capabilities } = await getAdminCapabilities()
  if (!capabilities.isAdmin) {
    return { ok: false, error: "No autorizado. Se requieren permisos de administrador." }
  }

  try {
    const scanned = await runRadarScan()
    const { added, total } = await saveTopics(scanned)

    revalidatePath("/admin/radar")
    return {
      ok: true,
      added,
      total,
      message: `Escaneo completado. Se detectaron ${added} temas nuevos (${total} en catálogo).`,
    }
  } catch (error) {
    console.error("[radar-actions] Error in scanRadarAction:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al escanear fuentes del radar",
    }
  }
}

/**
 * Server Action: Actualiza el estado de un tema (Aprobar / Descartar).
 */
export async function updateTopicStatusAction(
  topicId: string,
  newStatus: RadarStatus
): Promise<RadarActionResult> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!capabilities.isAdmin) {
    return { ok: false, error: "No autorizado. Se requieren permisos de administrador." }
  }

  try {
    const updated = await updateTopicStatus(topicId, newStatus, user?.id)
    if (!updated) {
      return { ok: false, error: "Tema no encontrado." }
    }

    revalidatePath("/admin/radar")
    return {
      ok: true,
      message: newStatus === "APPROVED" ? "Tema aprobado para difusión." : "Tema descartado.",
    }
  } catch (error) {
    console.error("[radar-actions] Error in updateTopicStatusAction:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al actualizar tema",
    }
  }
}

/**
 * Server Action: Despacha la notificación de calendario laboral (hoy o fecha simulada).
 */
export async function dispatchCalendarPushAction(
  _prevState: unknown,
  formData: FormData
): Promise<RadarActionResult> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!capabilities.isAdmin) {
    return { ok: false, error: "No autorizado. Se requieren permisos de administrador." }
  }

  const isTest = formData.get("isTest") === "true"
  const targetDateStr = formData.get("targetDate") ? String(formData.get("targetDate")) : null

  let evaluation = evaluateTodayCalendar()

  if (targetDateStr) {
    const [y, m, d] = targetDateStr.split("-").map(Number)
    if (y && m && d) {
      evaluation = evaluateCalendarDate(y, m - 1, d)
    }
  }

  if (!evaluation.hasEvents || !evaluation.pushPayload) {
    return {
      ok: false,
      error: "No existen eventos de nómina, vacaciones o interactivo registrados para esta fecha.",
    }
  }

  try {
    const result = await dispatchCalendarPushForDate(evaluation, {
      creatorId: user?.id,
      isTest,
    })

    if (!result.ok) {
      return { ok: false, error: result.error || "No se pudo despachar la notificación push." }
    }

    revalidatePath("/admin/radar")
    return {
      ok: true,
      campaignId: result.campaignId,
      message: isTest
        ? "Notificación de prueba enviada exitosamente a tu dispositivo."
        : "Notificación oficial despachada a todos los trabajadores registrados.",
    }
  } catch (error) {
    console.error("[radar-actions] Error in dispatchCalendarPushAction:", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al despachar push de calendario",
    }
  }
}

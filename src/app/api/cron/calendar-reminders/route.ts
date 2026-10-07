import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  evaluateTodayCalendar,
  isCalendarNotificationDispatched,
  dispatchCalendarPushForDate,
} from "@/features/radar/services/calendar-alerts-service"

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const adminKey = process.env.PUSH_ADMIN_KEY

  const authHeader = request.headers.get("authorization")
  const adminHeader = request.headers.get("x-push-admin-key") || request.headers.get("x-cron-key")

  if (cronSecret && safeCompare(authHeader, `Bearer ${cronSecret}`)) return true
  if (adminKey && safeCompare(adminHeader, adminKey)) return true
  if (!cronSecret && !adminKey && process.env.NODE_ENV !== "production") return true

  return false
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "No autorizado", code: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  try {
    const evaluation = evaluateTodayCalendar()

    // 1. Si no hay eventos de pago, vacaciones o interactivo hoy, terminar
    if (!evaluation.hasEvents || !evaluation.pushPayload) {
      return NextResponse.json(
        {
          ok: true,
          status: "NO_EVENTS_TODAY",
          date: evaluation.date,
          message: "Hoy no hay eventos de nómina ni vacaciones programados.",
        },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    // 2. Comprobar si ya se despachó hoy (idempotencia estricta)
    const alreadySent = await isCalendarNotificationDispatched(evaluation.date)
    if (alreadySent) {
      return NextResponse.json(
        {
          ok: true,
          status: "ALREADY_DISPATCHED",
          date: evaluation.date,
          message: "La notificación de calendario para la fecha de hoy ya fue enviada previamente.",
        },
        { headers: { "Cache-Control": "no-store" } }
      )
    }

    // 3. Despachar notificación a todos los dispositivos registrados
    const result = await dispatchCalendarPushForDate(evaluation)

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: "DISPATCH_FAILED",
          date: evaluation.date,
          error: result.error,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        status: "DISPATCHED",
        date: evaluation.date,
        campaignId: result.campaignId,
        alerts: evaluation.alerts.map((a) => a.title),
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[cron/calendar-reminders] Execution error:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

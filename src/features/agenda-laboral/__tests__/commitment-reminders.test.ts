/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  processPendingCommitmentReminders,
  buildAgendaDeepLink,
  isEveningReminderWindow,
} from "../services/commitment-reminders"

// Mock push-admin sendToUser
const mockSendToUser = vi.fn()
vi.mock("@/features/push/services/push-admin", () => ({
  sendToUser: (...args: unknown[]) => mockSendToUser(...args),
}))

interface FakeDelivery {
  commitment_id: string
  reminder_type: string
  user_id: string
  scheduled_for: string
  status: string
}

describe("Commitment Reminders Engine: Casos Obligatorios 15 a 25", () => {
  let fakeCommitments: any[] = []
  let fakeDeliveries: FakeDelivery[] = []

  // Create a mock Supabase client that emulates DB queries and inserts
  const createMockSupabase = () => {
    return {
      from: (table: string) => {
        if (table === "worker_commitments") {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                gte: () => ({
                  lte: () => {
                    const filtered = fakeCommitments.filter((c) => c.status === val)
                    return Promise.resolve({ data: filtered, error: null })
                  },
                }),
                not: () => {
                  const filtered = fakeCommitments.filter((c) => c.status === val && c.details?.reminderAt)
                  return Promise.resolve({ data: filtered, error: null })
                },
              }),
            }),
          }
        }
        if (table === "commitment_reminder_deliveries") {
          return {
            select: () => ({
              in: (_col: string, ids: string[]) => {
                const matched = fakeDeliveries.filter((d) => ids.includes(d.commitment_id))
                return Promise.resolve({ data: matched, error: null })
              },
            }),
            insert: (items: any) => {
              const toInsert = Array.isArray(items) ? items : [items]
              for (const it of toInsert) {
                // Idempotency: verify unique constraint (commitment_id, reminder_type)
                const exists = fakeDeliveries.some(
                  (d) => d.commitment_id === it.commitment_id && d.reminder_type === it.reminder_type,
                )
                if (!exists) {
                  fakeDeliveries.push(it)
                }
              }
              return Promise.resolve({ error: null })
            },
          }
        }
        return {} as any
      },
    } as any
  }

  beforeEach(() => {
    vi.clearAllMocks()
    fakeCommitments = []
    fakeDeliveries = []
    mockSendToUser.mockResolvedValue({ sent: 1, failed: 0, invalidTokens: 0 })
  })

  it("15. recordatorio un día antes (19:00 del día anterior)", async () => {
    // Current time: 2026-09-05 19:30 CDMX (2026-09-06T01:30:00Z)
    const now1930 = new Date("2026-09-06T01:30:00.000Z")
    expect(isEveningReminderWindow(now1930)).toBe(true)

    // Commitment tomorrow at 08:00 CDMX (2026-09-06 14:00 UTC)
    fakeCommitments = [
      {
        id: "comm-tomorrow",
        user_id: "user-1",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-09-06T14:00:00.000Z",
        end_at: "2026-09-06T18:00:00.000Z",
        service: "Urgencias",
        workplace: "HGR 1",
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: false,
        reminder_at_start: false,
      },
    ]

    const summary = await processPendingCommitmentReminders({
      now: now1930,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.dayBeforeSent).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
    const [userId, payload] = mockSendToUser.mock.calls[0]
    expect(userId).toBe("user-1")
    expect(payload.type).toBe("AGENDA")
    expect(payload.body).toContain("Mañana tienes")
    expect(payload.body).toContain("Urgencias")
  })

  it("16. dos horas antes (startAt - 2 horas)", async () => {
    // Commitment starts at 16:00 CDMX (22:00 UTC)
    fakeCommitments = [
      {
        id: "comm-2h",
        user_id: "user-2",
        type: "txt_substitution",
        title: "Sustitución TxT",
        start_at: "2026-09-05T22:00:00.000Z",
        end_at: "2026-09-06T06:00:00.000Z",
        service: "Medicina Interna",
        workplace: "",
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: true,
        reminder_at_start: false,
      },
    ]

    // Run at 14:15 CDMX (20:15 UTC) -> 1h45m before start (within the 2h window)
    const now1415 = new Date("2026-09-05T20:15:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now1415,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.hoursBeforeSent).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
    const [, payload] = mockSendToUser.mock.calls[0]
    expect(payload.title).toContain("comienza en 2 horas")
  })

  it("17. al inicio (startAt)", async () => {
    // Commitment starts at 07:00 CDMX (13:00 UTC)
    fakeCommitments = [
      {
        id: "comm-start",
        user_id: "user-3",
        type: "guardia_festiva",
        title: "Guardia festiva",
        start_at: "2026-09-05T13:00:00.000Z",
        end_at: "2026-09-05T21:00:00.000Z",
        service: "Terapia Intensiva",
        workplace: "",
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: false,
        reminder_at_start: true,
      },
    ]

    // Run at 07:02 CDMX (13:02 UTC)
    const now0702 = new Date("2026-09-05T13:02:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now0702,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.atStartSent).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
    const [, payload] = mockSendToUser.mock.calls[0]
    expect(payload.title).toContain("Es hora de tu")
    expect(payload.body).toContain("07:00")
  })

  it("18 & 19. retry del scheduler y no duplicación (idempotencia garantizada)", async () => {
    fakeCommitments = [
      {
        id: "comm-idemp",
        user_id: "user-idemp",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-09-06T14:00:00.000Z",
        end_at: "2026-09-06T18:00:00.000Z",
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: false,
        reminder_at_start: false,
      },
    ]

    const now1930 = new Date("2026-09-06T01:30:00.000Z")
    const mockDb = createMockSupabase()

    // 1st run: sends 1 notification
    const run1 = await processPendingCommitmentReminders({ now: now1930, supabaseClient: mockDb })
    expect(run1.dayBeforeSent).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)

    // 2nd run immediately after: 0 sent!
    const run2 = await processPendingCommitmentReminders({ now: now1930, supabaseClient: mockDb })
    expect(run2.dayBeforeSent).toBe(0)
    expect(mockSendToUser).toHaveBeenCalledTimes(1) // Still 1!

    // 3rd, 4th, 5th run (simulating cron running every 15 min): still 0 sent!
    const run3 = await processPendingCommitmentReminders({ now: now1930, supabaseClient: mockDb })
    expect(run3.dayBeforeSent).toBe(0)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
  })

  it("20. cambio de horario del compromiso (elimina entregas viejas para permitir nueva entrega)", async () => {
    // Record already delivered for old time
    fakeDeliveries.push({
      commitment_id: "comm-reschedule",
      reminder_type: "HOURS_BEFORE",
      user_id: "user-4",
      scheduled_for: "2026-09-05T12:00:00.000Z",
      status: "sent",
    })

    // User moved it 4 hours later -> the trigger/cleanup removes past delivery
    fakeDeliveries = fakeDeliveries.filter((d) => d.commitment_id !== "comm-reschedule")

    // Commitment with new time
    fakeCommitments = [
      {
        id: "comm-reschedule",
        user_id: "user-4",
        type: "overtime",
        title: "Tiempo extra reprogramado",
        start_at: "2026-09-05T22:00:00.000Z",
        end_at: "2026-09-06T02:00:00.000Z",
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: true,
        reminder_at_start: false,
      },
    ]

    const now2015 = new Date("2026-09-05T20:15:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now2015,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.hoursBeforeSent).toBe(1)
  })

  it("21. cancelación después de haber programado recordatorio", async () => {
    fakeCommitments = [
      {
        id: "comm-cancelled",
        user_id: "user-5",
        type: "overtime",
        title: "Tiempo extra cancelado",
        start_at: "2026-09-05T22:00:00.000Z",
        end_at: "2026-09-06T02:00:00.000Z",
        status: "cancelled", // CANCELLED
        reminder_day_before: true,
        reminder_hours_before: true,
        reminder_at_start: true,
      },
    ]

    const now2015 = new Date("2026-09-05T20:15:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now2015,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.hoursBeforeSent).toBe(0)
    expect(summary.dayBeforeSent).toBe(0)
    expect(summary.atStartSent).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })

  it("22 & 23. usuario sin permiso de notificaciones o sin token (no crashea)", async () => {
    // When sendToUser returns sent: 0 because no token or disabled, engine succeeds cleanly
    mockSendToUser.mockResolvedValueOnce({ sent: 0, failed: 0, invalidTokens: 0 })

    fakeCommitments = [
      {
        id: "comm-no-token",
        user_id: "user-no-token",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-09-05T22:00:00.000Z",
        end_at: "2026-09-06T02:00:00.000Z",
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: true,
        reminder_at_start: false,
      },
    ]

    const now2015 = new Date("2026-09-05T20:15:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now2015,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.errors).toHaveLength(0)
    expect(summary.hoursBeforeSent).toBe(1)
  })

  it("24. token FCM rotado (sendToUser maneja tokens válidos)", async () => {
    mockSendToUser.mockResolvedValueOnce({ sent: 1, failed: 0, invalidTokens: 1 })

    fakeCommitments = [
      {
        id: "comm-token-rotate",
        user_id: "user-rotate",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-09-05T22:00:00.000Z",
        end_at: "2026-09-06T02:00:00.000Z",
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: true,
        reminder_at_start: false,
      },
    ]

    const now2015 = new Date("2026-09-05T20:15:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now2015,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.errors).toHaveLength(0)
  })

  it("25. deep link y agrupación de varios compromisos mañana (Sección 10 y 14)", async () => {
    const deepLinkSingle = buildAgendaDeepLink("2026-09-06", "comm-123")
    expect(deepLinkSingle).toBe("https://la-veinte-digital.vercel.app/bitacora?date=2026-09-06&commitment=comm-123")

    const deepLinkDayOnly = buildAgendaDeepLink("2026-09-06")
    expect(deepLinkDayOnly).toBe("https://la-veinte-digital.vercel.app/bitacora?date=2026-09-06")

    // Agrupación: usuario con 2 compromisos mañana
    fakeCommitments = [
      {
        id: "comm-batch-1",
        user_id: "user-batch",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-09-06T22:00:00.000Z", // 16:00 CDMX
        end_at: "2026-09-07T00:00:00.000Z",
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: false,
        reminder_at_start: false,
      },
      {
        id: "comm-batch-2",
        user_id: "user-batch",
        type: "guardia_festiva",
        title: "Guardia festiva",
        start_at: "2026-09-07T04:00:00.000Z", // 22:00 CDMX
        end_at: "2026-09-07T12:00:00.000Z",
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: false,
        reminder_at_start: false,
      },
    ]

    const now1930 = new Date("2026-09-06T01:30:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now1930,
      supabaseClient: createMockSupabase(),
    })

    // Both commitments processed in ONE grouped notification
    expect(summary.dayBeforeSent).toBe(2)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
    const [, payload] = mockSendToUser.mock.calls[0]
    expect(payload.title).toBe("Mañana tienes 2 compromisos")
    expect(payload.body).toContain("Tiempo extra 16:00")
    expect(payload.body).toContain("Guardia festiva 22:00")
    expect(payload.destination).toBe("https://la-veinte-digital.vercel.app/bitacora?date=2026-09-06")

    // Both recorded in fakeDeliveries
    expect(fakeDeliveries.filter((d) => d.reminder_type === "DAY_BEFORE")).toHaveLength(2)
  })

  it("26. recordatorio en fecha y hora programada (SCHEDULED_TIME) y deduplicación", async () => {
    // Event has scheduled reminder at 10:00 CDMX on 2026-09-10 (16:00 UTC)
    const scheduledIso = "2026-09-10T16:00:00.000Z"
    fakeCommitments = [
      {
        id: "comm-scheduled",
        user_id: "user-sched",
        type: "general_reminder",
        title: "Reunión con jefatura",
        start_at: "2026-09-10T17:00:00.000Z", // 11:00 CDMX
        end_at: "2026-09-10T18:00:00.000Z",
        notes: "Llevar bitácora impresa",
        details: {
          notificationsEnabled: true,
          reminderAt: scheduledIso,
          location: "Dirección",
        },
        status: "active",
        reminder_day_before: false,
        reminder_hours_before: false,
        reminder_at_start: false,
      },
    ]

    const mockDb = createMockSupabase()

    // 1st run: at 10:02 CDMX (16:02 UTC) -> triggers reminder
    const now1602 = new Date("2026-09-10T16:02:00.000Z")
    const summary1 = await processPendingCommitmentReminders({
      now: now1602,
      supabaseClient: mockDb,
    })

    expect(summary1.scheduledSent).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
    const [userId, payload] = mockSendToUser.mock.calls[0]
    expect(userId).toBe("user-sched")
    expect(payload.title).toBe("Reunión con jefatura")
    expect(payload.body).toContain("Llevar bitácora impresa")
    expect(payload.body).toContain("Dirección")

    // Verify delivery recorded
    const delivered = fakeDeliveries.find((d) => d.commitment_id === "comm-scheduled")
    expect(delivered?.reminder_type).toBe("SCHEDULED_TIME")

    // 2nd run: at 10:10 CDMX -> 0 sent (deduplication!)
    const now1610 = new Date("2026-09-10T16:10:00.000Z")
    const summary2 = await processPendingCommitmentReminders({
      now: now1610,
      supabaseClient: mockDb,
    })
    expect(summary2.scheduledSent).toBe(0)
    expect(mockSendToUser).toHaveBeenCalledTimes(1)
  })

  it("27. notificationsEnabled = false suprime recordatorios completamente", async () => {
    fakeCommitments = [
      {
        id: "comm-disabled",
        user_id: "user-disabled",
        type: "general_reminder",
        title: "Evento sin notificación",
        start_at: "2026-09-06T14:00:00.000Z",
        end_at: "2026-09-06T18:00:00.000Z",
        details: {
          notificationsEnabled: false,
          reminderAt: "2026-09-06T01:30:00.000Z",
        },
        status: "active",
        reminder_day_before: true,
        reminder_hours_before: true,
        reminder_at_start: true,
      },
    ]

    const now1930 = new Date("2026-09-06T01:30:00.000Z")
    const summary = await processPendingCommitmentReminders({
      now: now1930,
      supabaseClient: createMockSupabase(),
    })

    expect(summary.dayBeforeSent).toBe(0)
    expect(summary.hoursBeforeSent).toBe(0)
    expect(summary.atStartSent).toBe(0)
    expect(summary.scheduledSent).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })
})


/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useCommitments } from "../hooks/useCommitments"
import type { CommitmentRow } from "../services/commitments-supabase"

// Mock commitments-supabase
vi.mock("../services/commitments-supabase", () => ({
  fetchCommitments: vi.fn().mockResolvedValue({
    ok: true,
    data: [
      {
        id: "comm-1",
        user_id: "u1",
        type: "overtime",
        title: "Tiempo extra",
        start_at: "2026-11-20T14:00:00.000Z",
        end_at: "2026-11-20T18:00:00.000Z",
        workplace: "HGR 1",
        service: "Urgencias",
        substitute_worker_name: null,
        notes: null,
        details: {},
        reminder_day_before: true,
        reminder_hours_before: true,
        reminder_at_start: true,
        status: "active",
        created_at: "2026-10-20T00:00:00.000Z",
        legacy_local_id: null,
      } as CommitmentRow,
      {
        id: "comm-2",
        user_id: "u1",
        type: "txt_substitution",
        title: "TxT",
        start_at: "2026-11-21T14:00:00.000Z",
        end_at: "2026-11-21T18:00:00.000Z",
        workplace: null,
        service: null,
        substitute_worker_name: null,
        notes: null,
        details: {},
        reminder_day_before: false,
        reminder_hours_before: false,
        reminder_at_start: false,
        status: "cancelled", // Inactive
        created_at: "2026-10-20T00:00:00.000Z",
        legacy_local_id: null,
      } as CommitmentRow,
    ],
  }),
  rowToCommitment: (row: CommitmentRow) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    workplace: row.workplace ?? "",
    service: row.service ?? "",
    substituteWorkerName: row.substitute_worker_name ?? "",
    notes: row.notes ?? "",
    details: row.details as any,
    reminder: {
      dayBefore: row.reminder_day_before,
      hoursBefore: row.reminder_hours_before,
      atStart: row.reminder_at_start,
    },
    status: row.status,
    createdAt: row.created_at,
  }),
  insertCommitment: vi.fn(),
  updateCommitment: vi.fn(),
  deleteCommitment: vi.fn(),
  upsertLegacyCommitment: vi.fn(),
}))

vi.mock("../services/commitments-local", () => ({
  getCommitments: () => [],
  clearLocalForUser: () => {},
}))

describe("useCommitments: sincronización de alarmas locales con el teléfono", () => {
  const syncAgendaRemindersMock = vi.fn().mockResolvedValue({ ok: true, scheduled: 1, cancelled: 0 })

  beforeEach(() => {
    vi.clearAllMocks()
    window.LaVeinteApp = {
      syncAgendaReminders: syncAgendaRemindersMock,
    } as any
  })

  afterEach(() => {
    delete (window as any).LaVeinteApp
  })

  it("sincroniza compromisos activos con el puente nativo sin enviar cancelados", async () => {
    renderHook(() => useCommitments("u1"))

    await waitFor(() => {
      expect(syncAgendaRemindersMock).toHaveBeenCalledTimes(1)
    })

    const payloadStr = syncAgendaRemindersMock.mock.calls[0][0]
    const parsed = JSON.parse(payloadStr)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe("comm-1")
    expect(parsed[0].status).toBe("active")
  })

  it("no lanza error si window.LaVeinteApp no existe (navegador web normal)", async () => {
    delete (window as any).LaVeinteApp
    expect(() => {
      renderHook(() => useCommitments("u1"))
    }).not.toThrow()
  })
})

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { WorkerCommitment } from "../types"
import { COMMITMENT_TYPE_LABELS } from "../types"
import type { CommitmentRow, CommitmentInsert, CommitmentUpdate } from "../services/commitments-supabase"
import {
  fetchCommitments,
  insertCommitment as supabaseInsert,
  updateCommitment as supabaseUpdate,
  deleteCommitment as supabaseDelete,
} from "../services/commitments-supabase"
import {
  getCommitments as getLocal,
  addCommitment as addLocal,
  deleteCommitment as deleteLocal,
  readAllLocal,
  clearLocal,
} from "../services/commitments-local"

function rowToCommitment(row: CommitmentRow): WorkerCommitment {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as WorkerCommitment["type"],
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    workplace: row.workplace ?? "",
    service: row.service ?? "",
    substituteWorkerName: row.substitute_worker_name ?? "",
    notes: row.notes ?? "",
    reminder: {
      dayBefore: row.reminder_day_before,
      hoursBefore: row.reminder_hours_before,
      atStart: row.reminder_at_start,
    },
    status: row.status as WorkerCommitment["status"],
    createdAt: row.created_at,
  }
}

export function useCommitments(userId: string) {
  const [commitments, setCommitments] = useState<WorkerCommitment[]>([])
  const [upcoming, setUpcoming] = useState<WorkerCommitment[]>([])
  const [loading, setLoading] = useState(true)
  const [synced, setSynced] = useState(false)
  const importDone = useRef(false)

  const refresh = useCallback(async () => {
    const rows = await fetchCommitments(userId)
    const mapped = rows.map(rowToCommitment)
    setCommitments(mapped)
    const now = new Date().toISOString()
    setUpcoming(
      mapped
        .filter((c) => c.status === "active" && c.startAt > now)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 3)
    )
    setSynced(true)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (importDone.current || !synced || loading) return
    importDone.current = true

    const local = getLocal(userId)
    if (local.length === 0) return

    const migrate = async () => {
      let migrated = 0
      for (const c of local) {
        const insert: CommitmentInsert = {
          user_id: userId,
          type: c.type,
          title: c.title,
          start_at: c.startAt,
          end_at: c.endAt,
          workplace: c.workplace || undefined,
          service: c.service || undefined,
          substitute_worker_name: c.substituteWorkerName || undefined,
          notes: c.notes || undefined,
          reminder_day_before: c.reminder.dayBefore,
          reminder_hours_before: c.reminder.hoursBefore,
          reminder_at_start: c.reminder.atStart,
          status: c.status,
        }
        const result = await supabaseInsert(insert)
        if (result) migrated++
      }
      if (migrated > 0) {
        clearLocal()
        refresh()
      }
    }

    migrate()
  }, [synced, loading, userId, refresh])

  const add = useCallback(async (c: Omit<WorkerCommitment, "id" | "createdAt">) => {
    const insert: CommitmentInsert = {
      user_id: userId,
      type: c.type,
      title: c.title,
      start_at: c.startAt,
      end_at: c.endAt,
      workplace: c.workplace || undefined,
      service: c.service || undefined,
      substitute_worker_name: c.substituteWorkerName || undefined,
      notes: c.notes || undefined,
      reminder_day_before: c.reminder.dayBefore,
      reminder_hours_before: c.reminder.hoursBefore,
      reminder_at_start: c.reminder.atStart,
      status: c.status,
    }
    const result = await supabaseInsert(insert)
    if (result) await refresh()
    return result ? rowToCommitment(result) : null!
  }, [userId, refresh])

  const update = useCallback(async (id: string, updates: Partial<WorkerCommitment>) => {
    const dbUpdate: CommitmentUpdate = {}
    if (updates.status) dbUpdate.status = updates.status
    if (updates.reminder) {
      if (updates.reminder.dayBefore !== undefined) dbUpdate.reminder_day_before = updates.reminder.dayBefore
      if (updates.reminder.hoursBefore !== undefined) dbUpdate.reminder_hours_before = updates.reminder.hoursBefore
      if (updates.reminder.atStart !== undefined) dbUpdate.reminder_at_start = updates.reminder.atStart
    }
    await supabaseUpdate(id, dbUpdate)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await supabaseDelete(id)
    await refresh()
  }, [refresh])

  return { commitments, upcoming, loading, add, update, remove, refresh }
}

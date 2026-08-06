"use client"

import { useState, useEffect, useCallback } from "react"
import type { WorkerCommitment } from "../types"
import type { CommitmentInsert, CommitmentUpdate } from "../services/commitments-supabase"
import {
  fetchCommitments,
  insertCommitment as supabaseInsert,
  updateCommitment as supabaseUpdate,
  deleteCommitment as supabaseDelete,
} from "../services/commitments-supabase"
import { getCommitments as getLocal, clearLocalForUser } from "../services/commitments-local"

type MigrationState = "pending" | "running" | "completed" | "failed"

function rowToCommitment(row: { id: string; user_id: string; type: string; title: string; start_at: string; end_at: string; workplace: string | null; service: string | null; substitute_worker_name: string | null; notes: string | null; reminder_day_before: boolean; reminder_hours_before: boolean; reminder_at_start: boolean; status: string; created_at: string }): WorkerCommitment {
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
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [migration, setMigration] = useState<MigrationState>("pending")

  const filterUpcoming = useCallback((all: WorkerCommitment[]) => {
    const now = new Date().toISOString()
    return all
      .filter((c) => c.status === "active" && c.startAt > now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 3)
  }, [])

  const refresh = useCallback(async () => {
    const result = await fetchCommitments(userId)
    if (!result.ok) {
      setFetchError(result.error)
      setLoading(false)
      return
    }
    setFetchError(null)
    const mapped = result.data.map(rowToCommitment)
    setCommitments(mapped)
    setUpcoming(filterUpcoming(mapped))
    setLoading(false)
  }, [userId, filterUpcoming])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async refresh on mount
    refresh()
  }, [refresh])

  useEffect(() => {
    if (fetchError || migration !== "pending" || loading) return

    const local = getLocal(userId)
    if (local.length === 0) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMigration("running")

    const migrate = async () => {
      let migrated = 0
      const errors: string[] = []

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
          legacy_local_id: c.id,
        }
        const result = await supabaseInsert(insert)
        if (result) {
          migrated++
        } else {
          errors.push(c.title)
        }
      }

      if (migrated === local.length) {
        clearLocalForUser(userId)
        setMigration("completed")
        await refresh()
      } else if (migrated > 0 && migrated < local.length) {
        setMigration("failed")
        console.warn("[useCommitments] Migracion parcial:", migrated, "de", local.length, "fallos:", errors)
      } else {
        setMigration("failed")
      }
    }

    migrate()
  }, [fetchError, migration, loading, userId, refresh])

  const add = useCallback(async (c: Omit<WorkerCommitment, "id" | "createdAt">): Promise<WorkerCommitment | null> => {
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
    if (!result) return null
    await refresh()
    return rowToCommitment(result)
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

  return { commitments, upcoming, loading, fetchError, add, update, remove, refresh }
}

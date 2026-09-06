"use client"

import { useState, useEffect, useCallback } from "react"
import type { WorkerCommitment } from "../types"
import type { CommitmentInsert, CommitmentUpdate, CommitmentRow } from "../services/commitments-supabase"
import {
  fetchCommitments,
  rowToCommitment,
  insertCommitment as supabaseInsert,
  updateCommitment as supabaseUpdate,
  deleteCommitment as supabaseDelete,
  upsertLegacyCommitment,
} from "../services/commitments-supabase"
import { getCommitments as getLocal, clearLocalForUser } from "../services/commitments-local"
import { notifyCommitmentsChanged, useCommitmentsListener } from "../lib/agenda-bus"
import {
  getTodayCommitments,
  getNextCommitment,
  getCommitmentsForLocalDate,
} from "../lib/commitment-calendar"

type MigrationState = "pending" | "running" | "completed" | "failed"

function filterUpcoming(all: WorkerCommitment[]): WorkerCommitment[] {
  const now = new Date().toISOString()
  return all
    .filter((c) => c.status === "active" && c.startAt > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3)
}

export function useCommitments(userId: string, initialRows?: CommitmentRow[]) {
  const initial = initialRows?.length ? initialRows.map(rowToCommitment) : []
  const [commitments, setCommitments] = useState<WorkerCommitment[]>(initial)
  const [upcoming, setUpcoming] = useState<WorkerCommitment[]>(initialRows?.length ? filterUpcoming(initial) : [])
  const [loading, setLoading] = useState(!initialRows)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [migration, setMigration] = useState<MigrationState>("pending")

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
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async refresh on mount
    refresh()
  }, [refresh])

  useCommitmentsListener(refresh)

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
        const result = await upsertLegacyCommitment(insert)
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
        notifyCommitmentsChanged()
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
    notifyCommitmentsChanged()
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
    notifyCommitmentsChanged()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await supabaseDelete(id)
    await refresh()
    notifyCommitmentsChanged()
  }, [refresh])

  const retryMigration = useCallback(() => {
    setMigration("pending")
  }, [])

  return {
    commitments,
    upcoming,
    todayCommitments: getTodayCommitments(commitments),
    nextCommitment: getNextCommitment(commitments),
    getCommitmentsForDate: (dateStr: string) => getCommitmentsForLocalDate(commitments, dateStr),
    loading,
    fetchError,
    migration,
    retryMigration,
    add,
    update,
    remove,
    refresh,
  }
}

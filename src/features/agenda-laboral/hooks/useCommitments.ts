"use client"

import { useState, useEffect, useCallback } from "react"
import type { WorkerCommitment, CommitmentType } from "../types"
import { getCommitments, getUpcomingCommitments, addCommitment, updateCommitment, deleteCommitment } from "../services/commitments"

interface UseCommitmentsReturn {
  commitments: WorkerCommitment[]
  upcoming: WorkerCommitment[]
  loading: boolean
  add: (c: Omit<WorkerCommitment, "id" | "createdAt">) => WorkerCommitment
  update: (id: string, updates: Partial<WorkerCommitment>) => void
  remove: (id: string) => void
  refresh: () => void
}

export function useCommitments(userId: string): UseCommitmentsReturn {
  const [commitments, setCommitments] = useState<WorkerCommitment[]>([])
  const [upcoming, setUpcoming] = useState<WorkerCommitment[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    const all = getCommitments(userId)
    setCommitments(all)
    setUpcoming(getUpcomingCommitments(userId, 3))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = useCallback((c: Omit<WorkerCommitment, "id" | "createdAt">) => {
    const created = addCommitment(c)
    refresh()
    return created
  }, [refresh])

  const update = useCallback((id: string, updates: Partial<WorkerCommitment>) => {
    updateCommitment(id, updates)
    refresh()
  }, [refresh])

  const remove = useCallback((id: string) => {
    deleteCommitment(id)
    refresh()
  }, [refresh])

  return { commitments, upcoming, loading, add, update, remove, refresh }
}

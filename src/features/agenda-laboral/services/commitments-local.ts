import type { WorkerCommitment } from "../types"

const STORAGE_KEY = "worker_commitments"

export function readAllLocal(): WorkerCommitment[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearLocal() {
  if (typeof window === "undefined" || !window.localStorage) return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function clearLocalForUser(userId: string) {
  if (typeof window === "undefined" || !window.localStorage) return
  const remaining = readAllLocal().filter(
    (c) => c.userId !== userId
  )
  try {
    if (remaining.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
    }
  } catch { /* ignore */ }
}

export function getCommitments(userId: string): WorkerCommitment[] {
  return readAllLocal().filter((c) => c.userId === userId)
}

export function addCommitment(commitment: Omit<WorkerCommitment, "id" | "createdAt">): WorkerCommitment {
  const all = readAllLocal()
  const created: WorkerCommitment = {
    ...commitment,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  all.push(created)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    } catch { /* ignore */ }
  }
  return created
}

export function deleteCommitment(id: string) {
  if (typeof window === "undefined" || !window.localStorage) return
  const all = readAllLocal()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((c) => c.id !== id)))
  } catch { /* ignore */ }
}

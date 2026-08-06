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
  localStorage.removeItem(STORAGE_KEY)
}

export function clearLocalForUser(userId: string) {
  const remaining = readAllLocal().filter(
    (c) => c.userId !== userId
  )
  if (remaining.length === 0) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
  }
}

export function getCommitments(userId: string): WorkerCommitment[] {
  return readAllLocal().filter((c) => c.userId === userId)
}

export function addCommitment(commitment: Omit<WorkerCommitment, "id" | "createdAt">): WorkerCommitment {
  const all = readAllLocal()
  all.push({ ...commitment, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  return all[all.length - 1]
}

export function deleteCommitment(id: string) {
  const all = readAllLocal()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((c) => c.id !== id)))
}

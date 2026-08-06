import type { WorkerCommitment } from "../types"
import { COMMITMENT_TYPE_LABELS } from "../types"

const STORAGE_KEY = "worker_commitments"

function readAll(): WorkerCommitment[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(commitments: WorkerCommitment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commitments))
}

export function getCommitments(userId: string): WorkerCommitment[] {
  return readAll().filter((c) => c.userId === userId)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

export function getUpcomingCommitments(userId: string, limit = 3): WorkerCommitment[] {
  const now = new Date().toISOString()
  return getCommitments(userId)
    .filter((c) => c.status === "active" && c.startAt > now)
    .slice(0, limit)
}

export function addCommitment(commitment: Omit<WorkerCommitment, "id" | "createdAt">): WorkerCommitment {
  const all = readAll()
  const newCommitment: WorkerCommitment = {
    ...commitment,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  all.push(newCommitment)
  writeAll(all)
  return newCommitment
}

export function updateCommitment(id: string, updates: Partial<WorkerCommitment>) {
  const all = readAll()
  const idx = all.findIndex((c) => c.id === id)
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates }
    writeAll(all)
  }
}

export function deleteCommitment(id: string) {
  const all = readAll()
  writeAll(all.filter((c) => c.id !== id))
}

export function checkReminders(userId: string): { commitment: WorkerCommitment; label: string }[] {
  const now = new Date()
  const alerts: { commitment: WorkerCommitment; label: string }[] = []

  for (const c of getCommitments(userId)) {
    if (c.status !== "active") continue
    const start = new Date(c.startAt)
    if (now >= start) continue

    const typeLabel = COMMITMENT_TYPE_LABELS[c.type] ?? "Compromiso"

    if (c.reminder.hoursBefore) {
      const twoHoursBefore = new Date(start.getTime() - 2 * 60 * 60 * 1000)
      if (now >= twoHoursBefore) {
        alerts.push({
          commitment: c,
          label: `En menos de 2h: ${typeLabel} a las ${start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`,
        })
      }
    }

    if (c.reminder.atStart) {
      const fifteenAfter = new Date(start.getTime() + 15 * 60 * 1000)
      if (now >= start && now < fifteenAfter) {
        alerts.push({
          commitment: c,
          label: `Ahora: ${typeLabel}`,
        })
      }
    }
  }

  return alerts
}

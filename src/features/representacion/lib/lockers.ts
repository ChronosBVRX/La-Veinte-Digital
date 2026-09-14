// Lockers — Cl. 67/68 como fundamento general (sin criterio jurídico de reparto).
// Orden operativo por defecto: fecha de solicitud ascendente + priority_override.

export type LockerStatus = "available" | "assigned" | "reserved" | "maintenance" | "blocked";

export interface LockerAssignmentRecord {
  id: string;
  lockerId: string;
  workerId: string;
  status: "active" | "released";
  adminOverride: boolean;
}

export function normalizeLockerNumber(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw.trim().toUpperCase();
  return String(parseInt(digits, 10));
}

export function canAssignLocker(
  lockerStatus: LockerStatus,
  hasActiveAssignment: boolean,
): { ok: boolean; reason: string } {
  if (hasActiveAssignment) return { ok: false, reason: "El locker ya tiene una asignación activa." };
  if (lockerStatus === "available" || lockerStatus === "reserved") return { ok: true, reason: "" };
  if (lockerStatus === "maintenance") return { ok: false, reason: "El locker está en mantenimiento." };
  if (lockerStatus === "blocked") return { ok: false, reason: "El locker está bloqueado." };
  return { ok: false, reason: "El locker está asignado." };
}

export function canAssignWorker(
  workerHasActiveLocker: boolean,
  adminOverride: boolean,
): { ok: boolean; reason: string } {
  if (!workerHasActiveLocker) return { ok: true, reason: "" };
  if (adminOverride) return { ok: true, reason: "" };
  return { ok: false, reason: "El trabajador ya tiene un locker activo. Se requiere override administrativo auditado." };
}

export interface WaitlistEntry {
  id: string;
  requestedAt: string;
  priorityOverride: number | null;
}

/** Orden operativo: priority_override (menor primero) y luego fecha ascendente. */
export function sortWaitlist(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const pa = a.priorityOverride ?? Number.MAX_SAFE_INTEGER;
    const pb = b.priorityOverride ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.requestedAt.localeCompare(b.requestedAt);
  });
}

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

/** Comparación alfanumérica en orden natural (1, 2, ... 9, 10, ... 100). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

export interface LockerStatusMeta {
  singular: string;
  plural: string;
  description: string;
  bg: string;
  color: string;
  border: string;
  dotColor: string;
}

export const LOCKER_STATUS_CONFIG: Record<string, LockerStatusMeta> = {
  available: {
    singular: "Disponible",
    plural: "Disponibles",
    description: "Casillero libre para asignación",
    bg: "#f0fdf4",
    color: "#166534",
    border: "#bbf7d0",
    dotColor: "#16a34a",
  },
  assigned: {
    singular: "Asignado",
    plural: "Asignados",
    description: "Asignado a un trabajador activo",
    bg: "#eff6ff",
    color: "#1e40af",
    border: "#bfdbfe",
    dotColor: "#2563eb",
  },
  reserved: {
    singular: "Reservado",
    plural: "Reservados",
    description: "Reservado temporalmente",
    bg: "#faf5ff",
    color: "#6b21a8",
    border: "#e9d5ff",
    dotColor: "#9333ea",
  },
  maintenance: {
    singular: "Mantenimiento",
    plural: "En mantenimiento",
    description: "En reparación o mantenimiento",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    dotColor: "#d97706",
  },
  blocked: {
    singular: "Bloqueado",
    plural: "Bloqueados",
    description: "Bloqueado administrativamente",
    bg: "#f8fafc",
    color: "#475569",
    border: "#e2e8f0",
    dotColor: "#64748b",
  },
  pending: {
    singular: "Por revisar",
    plural: "Por revisar",
    description: "Tiene incidencias o está pendiente de vincular",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
    dotColor: "#ea580c",
  },
};

export function getLockerStatusLabel(status: string, options?: { plural?: boolean }): string {
  const config = LOCKER_STATUS_CONFIG[status];
  if (!config) return status;
  return options?.plural ? config.plural : config.singular;
}

export function getLockerStatusBadge(status: string, hasPending?: boolean): LockerStatusMeta {
  if (hasPending || status === "pending") {
    return LOCKER_STATUS_CONFIG.pending;
  }
  return (
    LOCKER_STATUS_CONFIG[status] ?? {
      singular: status,
      plural: status,
      description: status,
      bg: "var(--accent)",
      color: "var(--fg)",
      border: "var(--border)",
      dotColor: "var(--muted)",
    }
  );
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

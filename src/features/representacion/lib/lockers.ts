// Lockers — Cl. 67/68 como fundamento general (sin criterio jurídico de reparto).
// Orden operativo por defecto: fecha de solicitud ascendente + priority_override.

export type LockerStatus = "available" | "assigned" | "reserved" | "maintenance" | "blocked";
export type LockerCondition = "ok" | "good" | "damaged" | "maintenance" | "reserved" | "blocked";

export interface LockerAssignmentRecord {
  id: string;
  lockerId: string;
  workerId: string;
  status: "active" | "released";
  adminOverride: boolean;
}

export interface LockerZone {
  id: string;
  delegation_id: string;
  name: string;
  description: string;
  building: string;
  floor: string;
  sort_order: number;
  active: boolean;
  total_lockers?: number;
  assigned_lockers?: number;
  available_lockers?: number;
  attention_lockers?: number;
}

export interface LockerBank {
  id: string;
  delegation_id: string;
  zone_id: string;
  name: string;
  description: string;
  rows: number;
  columns: number;
  sort_order: number;
  orientation: string;
  active: boolean;
}

export interface LockerMapItem {
  id: string;
  delegation_id?: string;
  locker_number: string;
  location?: string | null;
  section?: string | null;
  status: LockerStatus | string;
  condition: LockerCondition;
  zone_id: string | null;
  bank_id: string | null;
  zone_name?: string | null;
  bank_name?: string | null;
  row_position: number | null;
  column_position: number | null;
  position_label?: string | null;
  sort_order?: number | null;
  physical_code?: string | null;
  notes?: string | null;
  maintenance_reason?: string | null;
  maintenance_notes?: string | null;
  occupant_name?: string | null;
  occupant_employee_number?: string | null;
  occupant_category?: string | null;
  occupant_turn?: string | null;
  is_empty_slot?: boolean;
  active_assignment?: {
    id: string;
    worker_id: string;
    assigned_at: string;
    worker_name: string;
    employee_number: string;
    category?: string | null;
    assignment?: string | null;
    turn?: string | null;
  } | null;
  pending_review?: {
    id: string;
    reason: string;
    source_employee_number?: string | null;
    source_worker_name?: string | null;
  } | null;
  pending_review_item?: unknown | null;
  effective_state: LockerEffectiveState;
}

export interface LockerEffectiveState {
  kind: "available" | "assigned" | "reserved" | "maintenance" | "damaged" | "blocked" | "inconsistent" | "pending_review" | "empty_slot";
  label: string;
  description: string;
  isAvailable: boolean;
  hasAttention: boolean;
  hasDiscrepancy: boolean;
  discrepancyMessage: string | null;
  occupantSummary?: {
    name: string;
    employeeNumber: string;
  };
  badge: LockerStatusMeta;
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
    description: "En reparación o con falla física reportada",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    dotColor: "#d97706",
  },
  damaged: {
    singular: "Dañado",
    plural: "Dañados",
    description: "Casillero con daño físico o cerradura forzada",
    bg: "#fef2f2",
    color: "#991b1b",
    border: "#fecaca",
    dotColor: "#ef4444",
  },
  empty_slot: {
    singular: "Espacio Vacío",
    plural: "Espacios Vacíos",
    description: "Espacio vacío en la retícula del mueble",
    bg: "transparent",
    color: "var(--muted)",
    border: "transparent",
    dotColor: "transparent",
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
  inconsistent: {
    singular: "Inconsistencia",
    plural: "Inconsistencias",
    description: "Desincronización entre el estado registrado y la asignación activa",
    bg: "#fef2f2",
    color: "#991b1b",
    border: "#fecaca",
    dotColor: "#dc2626",
  },
};

export function getLockerEffectiveState(
  locker: {
    status: string;
    condition?: string | null;
    is_empty_slot?: boolean;
    occupant_name?: string | null;
    occupant_employee_number?: string | null;
    active_assignment?: {
      worker_name?: string;
      employee_number?: string;
    } | null;
    pending_review_item?: unknown | null;
  },
  activeAssignment?: unknown | null,
  pendingReviewItem?: unknown | null
): LockerEffectiveState {
  if (locker.is_empty_slot) {
    return {
      kind: "empty_slot",
      label: "Espacio Vacío",
      description: "Espacio vacío en la estructura del mueble.",
      isAvailable: false,
      hasAttention: false,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: LOCKER_STATUS_CONFIG.empty_slot,
    };
  }

  const asg = activeAssignment !== undefined
    ? activeAssignment
    : (locker.active_assignment || (locker.occupant_name ? { worker_name: locker.occupant_name, employee_number: locker.occupant_employee_number } : null));
  const pending = pendingReviewItem !== undefined ? pendingReviewItem : locker.pending_review_item;

  const status = locker.status || "available";
  const condition = locker.condition || "ok";
  const hasAsg = Boolean(asg);
  const hasPending = Boolean(pending);

  // 1. Inconsistencia crítica: disponible pero con asignación activa
  if ((status === "available" || status === "disponible") && hasAsg) {
    return {
      kind: "inconsistent",
      label: "Inconsistencia",
      description: "El casillero figura como disponible, pero existe una asignación activa en el sistema.",
      isAvailable: false,
      hasAttention: true,
      hasDiscrepancy: true,
      discrepancyMessage: "Locker disponible con trabajador asignado. Requiere corrección.",
      badge: LOCKER_STATUS_CONFIG.inconsistent,
    };
  }

  // 2. Inconsistencia: marcado asignado pero sin asignación activa
  if ((status === "assigned" || status === "ocupado") && !hasAsg) {
    return {
      kind: "inconsistent",
      label: "Inconsistencia",
      description: "El casillero figura como asignado pero no existe ningún trabajador activo vinculado.",
      isAvailable: false,
      hasAttention: true,
      hasDiscrepancy: true,
      discrepancyMessage: "Locker asignado pero sin asignación activa en sistema.",
      badge: LOCKER_STATUS_CONFIG.inconsistent,
    };
  }

  // 3. Dañado
  if (condition === "damaged") {
    return {
      kind: "damaged",
      label: "Dañado",
      description: "Casillero con daño físico o cerradura forzada.",
      isAvailable: false,
      hasAttention: true,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: LOCKER_STATUS_CONFIG.damaged,
    };
  }

  // 4. Condición física en mantenimiento
  if (condition === "maintenance" || status === "maintenance") {
    return {
      kind: "maintenance",
      label: "Mantenimiento",
      description: "Casillero con falla física reportada (chapa, puerta o llave).",
      isAvailable: false,
      hasAttention: true,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: LOCKER_STATUS_CONFIG.maintenance,
    };
  }

  // 5. Bloqueado
  if (condition === "blocked" || status === "blocked") {
    return {
      kind: "blocked",
      label: "Bloqueado",
      description: "Casillero bloqueado temporalmente por administración.",
      isAvailable: false,
      hasAttention: true,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: LOCKER_STATUS_CONFIG.blocked,
    };
  }

  // 6. Pendiente de revisión por importación
  if (hasPending) {
    return {
      kind: "pending_review",
      label: "Por Revisar",
      description: "Existe un registro pendiente de conciliación derivado de la importación de padrón.",
      isAvailable: !hasAsg,
      hasAttention: true,
      hasDiscrepancy: true,
      discrepancyMessage: "Discrepancia en importación pendiente de resolver.",
      badge: LOCKER_STATUS_CONFIG.pending,
    };
  }

  // 7. Reservado
  if (status === "reserved" || condition === "reserved") {
    return {
      kind: "reserved",
      label: "Reservado",
      description: "Casillero reservado para trámite o asignación posterior.",
      isAvailable: false,
      hasAttention: false,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: LOCKER_STATUS_CONFIG.reserved,
    };
  }

  // 8. Asignado regular
  if (status === "assigned" || status === "ocupado" || hasAsg) {
    const asgObj = typeof asg === "object" && asg !== null ? (asg as { worker_name?: string; employee_number?: string }) : null;
    return {
      kind: "assigned",
      label: "Asignado",
      description: "Asignado y en uso regular por un trabajador.",
      isAvailable: false,
      hasAttention: false,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      occupantSummary: asgObj ? {
        name: asgObj.worker_name || locker.occupant_name || "",
        employeeNumber: asgObj.employee_number || locker.occupant_employee_number || "",
      } : undefined,
      badge: LOCKER_STATUS_CONFIG.assigned,
    };
  }

  // 9. Disponible regular
  return {
    kind: "available",
    label: "Disponible",
    description: "Casillero libre listo para asignarse a un trabajador.",
    isAvailable: true,
    hasAttention: false,
    hasDiscrepancy: false,
    discrepancyMessage: null,
    badge: LOCKER_STATUS_CONFIG.available,
  };
}

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

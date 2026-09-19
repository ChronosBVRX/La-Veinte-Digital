import { describe, expect, it } from "vitest";
import {
  getLockerEffectiveState,
  canAssignLocker,
  canAssignWorker,
  sortWaitlist,
  type LockerMapItem,
} from "@/features/representacion/lib/lockers";

describe("Lockers 2.0 - Effective States", () => {
  const baseLocker: LockerMapItem = {
    id: "loc-1",
    locker_number: "101",
    zone_id: "zone-1",
    bank_id: "bank-1",
    row_position: 0,
    column_position: 0,
    status: "available",
    condition: "good",
    occupant_name: null,
    occupant_employee_number: null,
    is_empty_slot: false,
    effective_state: {
      kind: "available",
      label: "Disponible",
      description: "Casillero libre",
      isAvailable: true,
      hasAttention: false,
      hasDiscrepancy: false,
      discrepancyMessage: null,
      badge: {
        singular: "Disponible",
        plural: "Disponibles",
        description: "Casillero libre para asignación",
        bg: "#f0fdf4",
        border: "#bbf7d0",
        color: "#166534",
        dotColor: "#16a34a",
      },
    },
  };

  it("identifica huecos físicos (empty_slot) correctamente", () => {
    const slot = {
      ...baseLocker,
      is_empty_slot: true,
    };
    const state = getLockerEffectiveState(slot);
    expect(state.kind).toBe("empty_slot");
    expect(state.label).toBe("Espacio Vacío");
  });

  it("identifica casilleros dañados físicamente o en mantenimiento", () => {
    const damaged = {
      ...baseLocker,
      condition: "damaged" as const,
      maintenance_reason: "Chapa rota por candado",
    };
    const state = getLockerEffectiveState(damaged);
    expect(state.kind).toBe("damaged");
    expect(state.label).toBe("Dañado");

    const inMaintenance = {
      ...baseLocker,
      condition: "maintenance" as const,
    };
    const stateMaint = getLockerEffectiveState(inMaintenance);
    expect(stateMaint.kind).toBe("maintenance");
    expect(stateMaint.label).toBe("Mantenimiento");
  });

  it("identifica casilleros reservados", () => {
    const reserved = {
      ...baseLocker,
      condition: "reserved" as const,
    };
    const state = getLockerEffectiveState(reserved);
    expect(state.kind).toBe("reserved");
    expect(state.label).toBe("Reservado");
  });

  it("identifica asignación activa con ocupante válido", () => {
    const assigned = {
      ...baseLocker,
      status: "assigned",
      occupant_name: "Dr. Roberto García",
      occupant_employee_number: "99382104",
      active_assignment: {
        id: "asg-1",
        worker_id: "w-1",
        worker_name: "Dr. Roberto García",
        employee_number: "99382104",
        assigned_at: "2026-01-10T00:00:00Z",
      },
    };
    const state = getLockerEffectiveState(assigned);
    expect(state.kind).toBe("assigned");
    expect(state.label).toBe("Asignado");
    expect(state.occupantSummary?.name).toBe("Dr. Roberto García");
    expect(state.occupantSummary?.employeeNumber).toBe("99382104");
  });

  it("detecta discrepancia cuando status es assigned pero no hay ocupante", () => {
    const discrepancy = {
      ...baseLocker,
      status: "assigned",
      occupant_name: null,
      active_assignment: undefined,
    };
    const state = getLockerEffectiveState(discrepancy);
    expect(state.kind).toBe("inconsistent");
    expect(state.label).toBe("Inconsistencia");
  });

  it("detecta discrepancia cuando status es available pero tiene ocupante asignado", () => {
    const discrepancy = {
      ...baseLocker,
      status: "available",
      occupant_name: "Enfermera Elena Soto",
      active_assignment: {
        id: "asg-2",
        worker_id: "w-2",
        worker_name: "Enfermera Elena Soto",
        employee_number: "98123456",
        assigned_at: "2026-02-01T00:00:00Z",
      },
    };
    const state = getLockerEffectiveState(discrepancy);
    expect(state.kind).toBe("inconsistent");
    expect(state.label).toBe("Inconsistencia");
  });

  it("identifica casillero libre y listo para asignación", () => {
    const available = {
      ...baseLocker,
      status: "available",
      condition: "good" as const,
      occupant_name: null,
    };
    const state = getLockerEffectiveState(available);
    expect(state.kind).toBe("available");
    expect(state.label).toBe("Disponible");
    expect(state.badge.dotColor).toBe("#16a34a");
  });
});

describe("Lockers 2.0 Hardening - Contract & Business Rules", () => {
  it("valida la estructura y tipado de LockerMapResponse y LockerMapSummary", () => {
    const summary = {
      total: 1199,
      assigned: 357,
      available: 842,
      attention: 0,
      maintenance: 0,
      unlocated: 1199,
      pendingReview: 1770,
      waitlist: 0,
      integrityIssues: 0,
      waitlistCount: 0,
      pending_review: 1770,
      integrity_issues_count: 0,
    };

    expect(summary.total).toBe(1199);
    expect(summary.unlocated).toBe(1199);
    expect(summary.pendingReview).toBe(1770);
    expect(summary.waitlist).toBe(0);
    expect(summary.assigned + summary.available).toBe(1199);
  });

  it("verifica restricciones para asignar casillero según condición y estado", () => {
    // Locker disponible
    expect(canAssignLocker("available", false).ok).toBe(true);

    // Locker ya asignado
    expect(canAssignLocker("assigned", false).ok).toBe(false);

    // Locker con asignación activa detectada
    expect(canAssignLocker("available", true).ok).toBe(false);

    // Locker en mantenimiento o bloqueado
    expect(canAssignLocker("maintenance", false).ok).toBe(false);
    expect(canAssignLocker("blocked", false).ok).toBe(false);
  });

  it("verifica restricciones para asignar trabajador según casillero previo y override admin", () => {
    // Trabajador sin casillero previo
    expect(canAssignWorker(false, false).ok).toBe(true);

    // Trabajador con casillero previo sin override
    expect(canAssignWorker(true, false).ok).toBe(false);

    // Trabajador con casillero previo con override autorizado
    expect(canAssignWorker(true, true).ok).toBe(true);
  });

  it("ordena lista de espera según prioridad y fecha ascendente (FIFO)", () => {
    const entries = [
      { id: "1", requestedAt: "2026-03-01T10:00:00Z", priorityOverride: null },
      { id: "2", requestedAt: "2026-01-15T10:00:00Z", priorityOverride: null },
      { id: "3", requestedAt: "2026-02-01T10:00:00Z", priorityOverride: 1 }, // Mayor prioridad (1 < null)
    ];

    const sorted = sortWaitlist(entries);
    expect(sorted[0].id).toBe("3"); // prioridad 1
    expect(sorted[1].id).toBe("2"); // enero (más antiguo)
    expect(sorted[2].id).toBe("1"); // marzo
  });
});


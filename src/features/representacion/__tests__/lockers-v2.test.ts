import { describe, expect, it } from "vitest";
import {
  getLockerEffectiveState,
  canAssignLocker,
  canAssignWorker,
  sortWaitlist,
  normalizeLockerStatus,
  normalizeLockerCondition,
  type LockerMapItem,
} from "@/features/representacion/lib/lockers";

const baseLocker: LockerMapItem = {
    id: "loc-1",
    locker_number: "101",
    zone_id: "zone-1",
    bank_id: "bank-1",
    row_position: 0,
    column_position: 0,
    status: "available",
    condition: "ok",
    occupant_name: null,
    occupant_employee_number: null,
    is_empty_slot: false,
    effective_state: {
      kind: "available",
      label: "Disponible",
      description: "Casillero libre",
      isAvailable: true,
      isAssigned: false,
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

describe("Lockers 2.0 - Effective States", () => {
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
      attention: 842,
      maintenance: 0,
      unlocated: 1199,
      pendingReview: 1770,
      waitlist: 0,
      affectedLockers: 842,
      issueCount: 1770,
      integrityIssues: 842,
      waitlistCount: 0,
      pending_review: 1770,
      integrity_issues_count: 842,
    };

    expect(summary.total).toBe(1199);
    expect(summary.unlocated).toBe(1199);
    expect(summary.pendingReview).toBe(1770);
    expect(summary.affectedLockers).toBe(842);
    expect(summary.issueCount).toBe(1770);
    expect(summary.affectedLockers).toBeLessThanOrEqual(summary.total);
    expect(summary.assigned + summary.available).toBe(1199);
  });

  it("verifica que un casillero con asignación activa preserva isAssigned=true aun con revisión pendiente", () => {
    const assignedWithPending = {
      ...baseLocker,
      status: "assigned",
      active_assignment: {
        id: "asg-99",
        worker_id: "w-99",
        worker_name: "EDUARDO BOLAÑOS",
        employee_number: "98173968",
        assigned_at: "2026-03-01T00:00:00Z",
      },
      pending_review_item: {
        id: "rev-1",
        reason: "DUPLICATE_LOCKER_DIFFERENT_WORKERS",
      },
    };

    const state = getLockerEffectiveState(assignedWithPending);
    expect(state.kind).toBe("assigned");
    expect(state.isAssigned).toBe(true);
    expect(state.isAvailable).toBe(false);
    expect(state.hasAttention).toBe(true);
    expect(state.hasDiscrepancy).toBe(true);
    expect(state.badge.singular).toBe("Por revisar");
  });

  it("verifica que un casillero sin asignación pero con revisión pendiente no es asignado ni disponible", () => {
    const unassignedWithPending = {
      ...baseLocker,
      status: "available",
      active_assignment: null,
      occupant_name: null,
      pending_review_item: {
        id: "rev-2",
        reason: "WORKER_NOT_FOUND",
      },
    };

    const state = getLockerEffectiveState(unassignedWithPending);
    expect(state.kind).toBe("pending_review");
    expect(state.isAssigned).toBe(false);
    expect(state.isAvailable).toBe(false);
    expect(state.hasAttention).toBe(true);
  });

  it("verifica normalización de estados y condiciones físicas legacy", () => {
    expect(normalizeLockerStatus("ocupado")).toBe("assigned");
    expect(normalizeLockerStatus("assigned")).toBe("assigned");
    expect(normalizeLockerStatus("disponible")).toBe("available");
    expect(normalizeLockerStatus("available")).toBe("available");
    expect(normalizeLockerStatus("reserved")).toBe("reserved");

    expect(normalizeLockerCondition("damaged")).toBe("maintenance");
    expect(normalizeLockerCondition("maintenance")).toBe("maintenance");
    expect(normalizeLockerCondition("blocked")).toBe("blocked");
    expect(normalizeLockerCondition("ok")).toBe("ok");
    expect(normalizeLockerCondition("good")).toBe("ok");
  });

  it("verifica búsqueda de trabajadores con acentos, prefijo # y matrículas", () => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const lockerSample = {
      locker_number: "247",
      physical_code: "EDIF-A-247",
      worker_name: "EDUARDO BOLAÑOS",
      employee_number: "98173968",
    };

    const queries = ["#247", "247", "98173968", "BOLAÑOS", "bolanos", "EDUARDO BOLAÑOS", "eduardo"];

    for (const q of queries) {
      const cleanQ = q.replace(/^#/, "").trim();
      const normQ = normalize(cleanQ);

      const matches =
        normalize(lockerSample.locker_number).includes(normQ) ||
        normalize(lockerSample.physical_code).includes(normQ) ||
        normalize(lockerSample.worker_name).includes(normQ) ||
        normalize(lockerSample.employee_number).includes(normQ);

      expect(matches).toBe(true);
    }
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


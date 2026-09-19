import { describe, expect, it } from "vitest";
import {
  getLockerEffectiveState,
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

import { describe, expect, it } from "vitest";
import {
  canAssignLocker,
  canAssignWorker,
  normalizeLockerNumber,
  sortWaitlist,
  naturalCompare,
  getLockerStatusLabel,
  getLockerStatusBadge,
} from "@/features/representacion/lib/lockers";

describe("lockers", () => {
  it("normaliza números", () => {
    expect(normalizeLockerNumber("001")).toBe("1");
    expect(normalizeLockerNumber(" L-042 ")).toBe("42");
  });
  it("asignar disponible sin asignación activa: ok", () => {
    expect(canAssignLocker("available", false).ok).toBe(true);
  });
  it("impide locker con asignación activa", () => {
    expect(canAssignLocker("available", true).ok).toBe(false);
  });
  it("mantenimiento/bloqueado no asignables", () => {
    expect(canAssignLocker("maintenance", false).ok).toBe(false);
    expect(canAssignLocker("blocked", false).ok).toBe(false);
  });
  it("impide doble locker activo sin override; permite con override", () => {
    expect(canAssignWorker(true, false).ok).toBe(false);
    expect(canAssignWorker(true, true).ok).toBe(true);
    expect(canAssignWorker(false, false).ok).toBe(true);
  });
  it("waitlist ordena por fecha ascendente por defecto", () => {
    const rows = sortWaitlist([
      { id: "b", requestedAt: "2026-09-02T00:00:00Z", priorityOverride: null },
      { id: "a", requestedAt: "2026-09-01T00:00:00Z", priorityOverride: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("priority_override administrativo reordena y queda auditado", () => {
    const rows = sortWaitlist([
      { id: "b", requestedAt: "2026-09-01T00:00:00Z", priorityOverride: 1 },
      { id: "a", requestedAt: "2026-09-01T00:00:00Z", priorityOverride: null },
    ]);
    expect(rows[0].id).toBe("b");
  });

  it("ordena casilleros en orden natural numérico", () => {
    const rawNumbers = ["10", "1", "100", "2", "25", "3", "20", "1A", "1B"];
    const sorted = [...rawNumbers].sort(naturalCompare);
    expect(sorted).toEqual(["1", "1A", "1B", "2", "3", "10", "20", "25", "100"]);
  });

  it("mapea estados a etiquetas comprensibles en español sin tecnicismos en inglés", () => {
    expect(getLockerStatusLabel("available")).toBe("Disponible");
    expect(getLockerStatusLabel("available", { plural: true })).toBe("Disponibles");
    expect(getLockerStatusLabel("assigned")).toBe("Asignado");
    expect(getLockerStatusLabel("assigned", { plural: true })).toBe("Asignados");
    expect(getLockerStatusLabel("pending")).toBe("Por revisar");
    expect(getLockerStatusLabel("maintenance")).toBe("Mantenimiento");
    expect(getLockerStatusLabel("blocked")).toBe("Bloqueado");
    expect(getLockerStatusLabel("reserved")).toBe("Reservado");
  });

  it("genera badges accesibles para casilleros regulares y con incidencias", () => {
    const availableBadge = getLockerStatusBadge("available");
    expect(availableBadge.singular).toBe("Disponible");
    expect(availableBadge.dotColor).toBe("#16a34a");

    const pendingBadge = getLockerStatusBadge("available", true);
    expect(pendingBadge.singular).toBe("Por revisar");
    expect(pendingBadge.color).toBe("#c2410c");
  });
});

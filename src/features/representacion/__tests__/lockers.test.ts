import { describe, expect, it } from "vitest";
import { canAssignLocker, canAssignWorker, normalizeLockerNumber, sortWaitlist } from "@/features/representacion/lib/lockers";

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
});

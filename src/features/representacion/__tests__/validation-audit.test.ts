import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "@/features/representacion/services/audit";
import { workerSchema, licenseInputSchema } from "@/features/representacion/lib/validation";

describe("validación y auditoría", () => {
  it("worker exige matrícula/nombre/categoría/adscripción/turno", () => {
    const r = workerSchema.safeParse({ employee_number: "", first_name: "", paternal_surname: "", category: "", assignment: "", turn: "" });
    expect(r.success).toBe(false);
  });
  it("licencia exige fin >= inicio", () => {
    const r = licenseInputSchema.safeParse({
      worker_id: "00000000-0000-4000-8000-000000000000",
      with_pay: false,
      start_date: "2026-09-02",
      end_date: "2026-09-01",
      reason: "x",
    });
    expect(r.success).toBe(false);
  });
  it("auditoría sanitiza PII", () => {
    const out = sanitizeAuditMetadata({ employee_number: "12345678", phone: "4430000000", domicilio: "Calle X", action: "ok" });
    expect(out.employee_number).toBe("***5678");
    expect(out.phone).toBe("[redactado]");
    expect(out.domicilio).toBe("[redactado]");
    expect(out.action).toBe("ok");
  });
});

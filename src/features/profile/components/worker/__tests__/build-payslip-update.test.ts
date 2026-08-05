import { describe, expect, it } from "vitest"
import { buildConfirmedPayslipProfileUpdate, validateFieldEdit } from "../build-payslip-update"
import type { WorkerProfileDraft } from "@/shared/domain/worker"

function draft(fields: WorkerProfileDraft["confirmedFields"] = [], overrides: Partial<WorkerProfileDraft> = {}): WorkerProfileDraft {
  return {
    mode: "payslip",
    identity: { matricula: "M1", adscripcion: "A1", categoria: "CAT" },
    situation: { workdayHours: 8, employmentType: "base", effectiveSeniorityDate: "2020-01-01", shift: "matutino" },
    confirmedFields: fields,
    ...overrides,
  }
}

describe("buildConfirmedPayslipProfileUpdate", () => {
  it("identity solo incluye campos seleccionados", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["matricula", "categoria"]), { method: "native_text" }, "1.0")
    expect(update.identity).toEqual({ matricula: "M1", categoria: "CAT" })
    expect(update.identity).not.toHaveProperty("adscripcion")
  })

  it("situation solo incluye campos seleccionados", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["workdayHours"]), { method: "ocr" }, "1.0")
    expect(update.situation).toEqual({ workdayHours: 8 })
    expect(update.situation).not.toHaveProperty("shift")
    expect(update.situation).not.toHaveProperty("employmentType")
    expect(update.situation).not.toHaveProperty("effectiveSeniorityDate")
  })

  it("sources solo contienen campos seleccionados con payslip_confirmed", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["matricula", "categoria"]), { method: "native_text" }, "1.0")
    expect(update.sources).toEqual({ matricula: "payslip_confirmed", categoria: "payslip_confirmed" })
  })

  it("no contiene File, base64, texto extraído ni parsed", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["categoria"]), { method: "native_text" }, "1.0") as unknown as Record<string, unknown>
    expect(update).not.toHaveProperty("file")
    expect(update).not.toHaveProperty("base64")
    expect(update).not.toHaveProperty("text")
    expect(update).not.toHaveProperty("parsed")
  })

  it("no contiene userId, accepted_source, accepted_at, event_type, priority", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["categoria"]), { method: "native_text" }, "1.0") as unknown as Record<string, unknown>
    expect(update).not.toHaveProperty("userId")
    expect(update).not.toHaveProperty("accepted_source")
    expect(update).not.toHaveProperty("accepted_at")
    expect(update).not.toHaveProperty("event_type")
    expect(update).not.toHaveProperty("priority")
  })

  it("campos desmarcados no se incluyen en identity ni situation", () => {
    const d = draft(["matricula"])
    d.identity.adscripcion = "Adsc"
    d.identity.categoria = "Cat"
    const update = buildConfirmedPayslipProfileUpdate(d, { method: "native_text" }, "1.0")
    expect(update.identity).not.toHaveProperty("adscripcion")
    expect(update.identity).not.toHaveProperty("categoria")
    expect(update.identity).toHaveProperty("matricula")
  })

  it("mode es payslip, sourceOfRequest es payslip", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["categoria"]), { method: "ocr" }, "1.0")
    expect(update.mode).toBe("payslip")
    expect(update.sourceOfRequest).toBe("payslip")
  })

  it("consentRef contiene purpose y version", () => {
    const update = buildConfirmedPayslipProfileUpdate(draft(["categoria"]), { method: "native_text" }, "2.0")
    expect(update.consentRef).toEqual({ purpose: "store_tarjeton", version: "2.0" })
  })
})

describe("validateFieldEdit", () => {
  it("matricula: máximo 32 caracteres", () => {
    expect(validateFieldEdit("matricula", "A".repeat(33))).toContain("32")
    expect(validateFieldEdit("matricula", "M12345")).toBeNull()
  })

  it("categoria: máximo 200 caracteres", () => {
    expect(validateFieldEdit("categoria", "A".repeat(201))).toContain("200")
    expect(validateFieldEdit("categoria", "TEC")).toBeNull()
  })

  it("workdayHours: solo 6, 6.5, 8, 12", () => {
    expect(validateFieldEdit("workdayHours", "7")).toContain("inválida")
    expect(validateFieldEdit("workdayHours", "8")).toBeNull()
    expect(validateFieldEdit("workdayHours", "6.5")).toBeNull()
  })

  it("effectiveSeniorityDate: formato AAAA-MM-DD", () => {
    expect(validateFieldEdit("effectiveSeniorityDate", "2020-13-01")).toBeNull() // No validamos rango en este nivel
    expect(validateFieldEdit("effectiveSeniorityDate", "01-01-2020")).toContain("inválido")
    expect(validateFieldEdit("effectiveSeniorityDate", "2020-01-01")).toBeNull()
  })

  it("shift: solo enum permitido", () => {
    expect(validateFieldEdit("shift", "nocturno_x")).toContain("inválido")
    expect(validateFieldEdit("shift", "matutino")).toBeNull()
    expect(validateFieldEdit("shift", "nocturno")).toBeNull()
  })

  it("employmentType: solo canónicos, no legacy", () => {
    expect(validateFieldEdit("employmentType", "base")).toBeNull()
    expect(validateFieldEdit("employmentType", "sustituto")).toBeNull()
    expect(validateFieldEdit("employmentType", "eventual")).toContain("no permitido")
    expect(validateFieldEdit("employmentType", "confianza_a_estatuto")).toContain("no permitido")
  })

  it("valores vacíos son válidos (campos opcionales)", () => {
    expect(validateFieldEdit("matricula", "")).toBeNull()
    expect(validateFieldEdit("categoria", "")).toBeNull()
  })
})

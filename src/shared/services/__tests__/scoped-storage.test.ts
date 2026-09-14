import { describe, it, expect } from "vitest"
import { scopedStorageKey, AUTHENTICATED_USER_REQUIRED } from "@/shared/services/scoped-storage"

describe("scopedStorageKey", () => {
  it("construye una clave versionada y separada por usuario", () => {
    expect(scopedStorageKey("nomina_profile", "uuid-a")).toBe("nomina_profile:v2:uuid-a")
  })

  it("produce claves distintas por usuario para la misma base", () => {
    expect(scopedStorageKey("nomina_payslips", "uuid-a")).not.toBe(
      scopedStorageKey("nomina_payslips", "uuid-b"),
    )
  })

  it("exige userId autenticado (nunca cae a una clave compartida)", () => {
    expect(() => scopedStorageKey("nomina_profile", "")).toThrow(AUTHENTICATED_USER_REQUIRED)
    expect(() => scopedStorageKey("nomina_profile", "   ")).toThrow(AUTHENTICATED_USER_REQUIRED)
    expect(() => scopedStorageKey("nomina_profile", undefined as unknown as string)).toThrow(
      AUTHENTICATED_USER_REQUIRED,
    )
  })
})

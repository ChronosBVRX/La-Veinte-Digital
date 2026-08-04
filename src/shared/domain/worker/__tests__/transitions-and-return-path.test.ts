import { describe, expect, it } from "vitest"
import {
  isValidOnboardingTransition,
  isValidWorkerModeTransition,
  WORKER_PROFILE_MODES,
  isSafeInternalReturnPath,
  ALLOWED_INTERNAL_RETURN_PATHS,
} from "../"

describe("isValidOnboardingTransition", () => {
  it("acepta unconfigured → basic", () => {
    expect(isValidOnboardingTransition("unconfigured", "basic")).toBe(true)
  })

  it("acepta unconfigured → configured", () => {
    expect(isValidOnboardingTransition("unconfigured", "configured")).toBe(true)
  })

  it("acepta basic → configured", () => {
    expect(isValidOnboardingTransition("basic", "configured")).toBe(true)
  })

  it("acepta configured → basic (borrado de datos laborales)", () => {
    expect(isValidOnboardingTransition("configured", "basic")).toBe(true)
  })

  it("rechaza quedarse en el mismo estado", () => {
    expect(isValidOnboardingTransition("basic", "basic")).toBe(false)
    expect(isValidOnboardingTransition("unconfigured", "unconfigured")).toBe(false)
  })

  it("rechaza transiciones hacia atrás del onboarding", () => {
    expect(isValidOnboardingTransition("configured", "unconfigured")).toBe(false)
    expect(isValidOnboardingTransition("basic", "unconfigured")).toBe(false)
  })

  it("rechaza valores desconocidos", () => {
    expect(isValidOnboardingTransition("unconfigured", "unknown" as never)).toBe(false)
  })
})

describe("isValidWorkerModeTransition", () => {
  it("acepta manual → payslip", () => {
    expect(isValidWorkerModeTransition("manual", "payslip")).toBe(true)
  })

  it("acepta payslip → manual", () => {
    expect(isValidWorkerModeTransition("payslip", "manual")).toBe(true)
  })

  it("rechaza quedarse en el mismo modo", () => {
    expect(isValidWorkerModeTransition("manual", "manual")).toBe(false)
    expect(isValidWorkerModeTransition("payslip", "payslip")).toBe(false)
  })

  it("rechaza valores que no son modos válidos", () => {
    expect(isValidWorkerModeTransition("basic" as never, "manual")).toBe(false)
    expect(isValidWorkerModeTransition("manual", "unknown" as never)).toBe(false)
  })

  it("expone solo los modos manual y payslip (no existe basic)", () => {
    expect(WORKER_PROFILE_MODES).toEqual(["manual", "payslip"])
    expect(WORKER_PROFILE_MODES).not.toContain("basic")
  })
})

describe("isSafeInternalReturnPath", () => {
  it("acepta una ruta interna permitida", () => {
    expect(isSafeInternalReturnPath("/calculadoras/aguinaldo")).toBe(true)
  })

  it("acepta una ruta interna permitida con query", () => {
    expect(isSafeInternalReturnPath("/calculadoras/aguinaldo?x=1")).toBe(true)
  })

  it("acepta la raíz", () => {
    expect(isSafeInternalReturnPath("/")).toBe(true)
  })

  it("rechaza URLs externas absolutas", () => {
    expect(isSafeInternalReturnPath("https://evil.com")).toBe(false)
    expect(isSafeInternalReturnPath("http://evil.com/phish")).toBe(false)
  })

  it("rechaza rutas protocol-relative", () => {
    expect(isSafeInternalReturnPath("//evil.com")).toBe(false)
  })

  it("rechaza javascript:", () => {
    expect(isSafeInternalReturnPath("javascript:alert(1)")).toBe(false)
    expect(isSafeInternalReturnPath("JaVaScRiPt:alert(1)")).toBe(false)
  })

  it("rechaza rutas internas no listadas", () => {
    expect(isSafeInternalReturnPath("/admin/secreto")).toBe(false)
  })

  it("rechaza valores vacíos, null y undefined", () => {
    expect(isSafeInternalReturnPath(null)).toBe(false)
    expect(isSafeInternalReturnPath(undefined)).toBe(false)
    expect(isSafeInternalReturnPath("")).toBe(false)
    expect(isSafeInternalReturnPath("   ")).toBe(false)
  })

  it("rechaza rutas relativas sin barra inicial", () => {
    expect(isSafeInternalReturnPath("calculadoras/aguinaldo")).toBe(false)
  })

  it("la lista blanca incluye las rutas de herramientas principales", () => {
    expect(ALLOWED_INTERNAL_RETURN_PATHS).toContain("/calculadoras/aguinaldo")
    expect(ALLOWED_INTERNAL_RETURN_PATHS).toContain("/nomina")
    expect(ALLOWED_INTERNAL_RETURN_PATHS).toContain("/tarjeton")
  })
})

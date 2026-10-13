import { describe, it, expect } from "vitest"
import { validateClabe, maskClabe } from "../lib/clabe"

describe("validateClabe", () => {
  it("rechaza CLABEs vacías o de longitud diferente a 18", () => {
    expect(validateClabe("").isValid).toBe(false)
    expect(validateClabe("123456").isValid).toBe(false)
    expect(validateClabe("1234567890123456789").isValid).toBe(false)
  })

  it("rechaza caracteres no numéricos", () => {
    expect(validateClabe("01218001555555555A").isValid).toBe(false)
  })

  it("valida correctamente una CLABE con dígito verificador correcto (BBVA 012)", () => {
    // Ejemplo canónico ABM: 032180000118359719
    const res = validateClabe("032180000118359719")
    expect(res.isValid).toBe(true)
  })

  it("detecta dígito verificador erróneo", () => {
    const res = validateClabe("032180000118359710")
    expect(res.isValid).toBe(false)
    expect(res.error).toContain("Dígito verificador")
  })

  it("enmascara correctamente la CLABE", () => {
    expect(maskClabe("032180000118359719")).toBe("••••••••••••••9719")
    expect(maskClabe("")).toBe("")
  })
})

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Regresión: el flujo autenticado de importación NUNCA debe usar el dueño
 * literal "local". Debe transportar el UUID autenticado (`user.id`).
 */
const source = readFileSync(
  join(process.cwd(), "src/features/tarjeton/hooks/useTarjetonImporter.ts"),
  "utf8",
)

describe("useTarjetonImporter — dueño autenticado", () => {
  it("pasa el userId autenticado a syncConfirmedPayslip (no 'local')", () => {
    const call = source.split("\n").find((line) => line.includes("syncConfirmedPayslip("))
    expect(call).toBeDefined()
    expect(call).not.toMatch(/"local"/)
    expect(call).toMatch(/syncConfirmedPayslip\(result\.data, request, userId\)/)
  })

  it("no persiste análisis ni PDFs bajo un dueño literal 'local'", () => {
    expect(source).not.toMatch(/"local"/)
  })
})

import { describe, it, expect } from "vitest"
import {
  resolveIntegratedMonthlySalary,
  buildWorkerContext,
  type PayslipLineRow,
} from "@/shared/server/worker-context-builder"
import { parsePorVencerDate, formatMexicanDate } from "@/features/tarjeton/lib/imss-date-parser"

describe("Extracción, Reconstrucción y Persistencia del Sueldo Mensual Integrado y Derechos", () => {
  it("Prioriza SMI directamente extraído del tarjetón (CONFIRMED)", () => {
    const totals = { integratedMonthlySalary: 28540.50, totalEarnings: 15000 }
    const lines: PayslipLineRow[] = []

    const res = resolveIntegratedMonthlySalary(totals, lines, "2026-16")
    expect(res.amount).toBe(28540.50)
    expect(res.meta.origin).toBe("EXTRACTED")
    expect(res.meta.isDirectlyExtracted).toBe(true)
    expect(res.meta.sourcePeriod).toBe("2026-16")
  })

  it("Reconstruye normativamente el SMI si no fue extraído directamente pero hay conceptos fijos (002 + 011 + 050 * 2)", () => {
    const totals = { totalEarnings: 15000 } // Sin integratedMonthlySalary
    const lines: PayslipLineRow[] = [
      { concept_code: "002", description: "SUELDO BASE", amount: 10000, kind: "earning", confirmed_by_user: true },
      { concept_code: "011", description: "AYUDA DE RENTA", amount: 2000, kind: "earning", confirmed_by_user: true },
      { concept_code: "050", description: "AYUDA DESPENSA", amount: 1500, kind: "earning", confirmed_by_user: true },
      { concept_code: "032", description: "ESTIMULO ASISTENCIA", amount: 800, kind: "earning", confirmed_by_user: true }, // No integra SMI
    ]

    // Integrables: 10,000 + 2,000 + 1,500 = 13,500 quincenal * 2 = 27,000 mensual
    const res = resolveIntegratedMonthlySalary(totals, lines, "2026-16")
    expect(res.amount).toBe(27000)
    expect(res.meta.origin).toBe("RECONSTRUCTED")
    expect(res.meta.isReconstructed).toBe(true)
  })

  it("Devuelve INCOMPLETE si no hay datos suficientes para calcular o reconstruir el SMI", () => {
    const totals = null
    const lines: PayslipLineRow[] = []

    const res = resolveIntegratedMonthlySalary(totals, lines, "2026-16")
    expect(res.amount).toBeNull()
    expect(res.meta.origin).toBe("INCOMPLETE")
    expect(res.meta.isDirectlyExtracted).toBe(false)
  })

  it("Convierte fecha compacta 14102026 a ISO 2026-10-14 y formato legible 14/10/2026", () => {
    const parsedIso = parsePorVencerDate("14102026")
    expect(parsedIso).toBe("2026-10-14")

    const formatted = formatMexicanDate(parsedIso!)
    expect(formatted).toBe("14/10/2026")
  })

  it("Construye el arreglo entitlements dentro del WorkerContext", () => {
    const ctx = buildWorkerContext({
      latestPayslipRow: {
        id: "p-1",
        period_raw: "2026-16",
        vacations: {
          porVencerRaw: "14102026",
          secondPeriodStartRaw: "2027-04-16",
          twentyYearsOrMoreDays: 15,
        },
      },
    })

    expect(ctx.vacations?.entitlements).toBeDefined()
    expect(ctx.vacations?.entitlements).toHaveLength(3) // 2 ordinarios + 1 V20
    expect(ctx.vacations?.entitlements?.[0].dueDate).toBe("2026-10-14")
    expect(ctx.vacations?.entitlements?.[0].confirmed).toBe(true)
    expect(ctx.vacations?.entitlements?.[2].kind).toBe("V20")
  })
})

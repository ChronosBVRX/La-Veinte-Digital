import { describe, it, expect } from "vitest"
import {
  buildRecurringConceptsFromPayslipLines,
  buildWorkerContextPayroll,
  type PayslipLineRow,
} from "../worker-context-builder"
import type { RecurringConceptEvidence } from "@/features/nomina/lib/types"

/**
 * PRUEBA DE INTEGRACIÓN DEL PIPELINE DE DATOS (bug $200.00 en producción).
 *
 * Historia: el RPC confirm_imported_payslip solo persiste recurrentes
 * 050/023/063 en payroll_contexts; hidratar el simulador desde ahí hacía que
 * la portada mostrara $200.00 (una sola percepción) en lugar del total
 * comprobado $14,256.87 del tarjetón real 2A-AGO-2026.
 *
 * Este test recorre el pipeline REAL:
 *   líneas del tarjetón (imported_payslip_lines)
 *     → buildRecurringConceptsFromPayslipLines (worker-context)
 *     → perfil hidratado en el simulador
 *     → sumComprobadoTarjeton (selector de la portada)
 */

/** Líneas EXACTAS del tarjetón real 2A-AGO-2026 (TÉCNICO RADIÓLOGO 80). */
const TARJETON_REAL_LINES: PayslipLineRow[] = [
  { concept_code: "002", description: "Sueldo Base", amount: 3937.64, kind: "earning", confirmed_by_user: true },
  { concept_code: "011", description: "Ayuda Renta", amount: 3234.77, kind: "earning", confirmed_by_user: true },
  { concept_code: "020", description: "Ayuda Renta", amount: 250.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "022", description: "Ayuda Renta Cláusula 63 Bis Inc c", amount: 1972.41, kind: "earning", confirmed_by_user: true },
  { concept_code: "032", description: "Estímulo Asistencia", amount: 1721.37, kind: "earning", confirmed_by_user: true },
  { concept_code: "033", description: "Estímulo Puntualidad", amount: 1147.58, kind: "earning", confirmed_by_user: true },
  { concept_code: "050", description: "Ayuda Despensa", amount: 200.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "054", description: "Emanaciones Radiactivas", amount: 1434.48, kind: "earning", confirmed_by_user: true },
  { concept_code: "072", description: "Libros no Médicos", amount: 358.62, kind: "earning", confirmed_by_user: true },
]

const TOTAL_PERCEPCIONES_REAL = 14256.87

describe("Pipeline tarjetón → worker-context → portada del simulador", () => {
  it("reconstruye TODAS las percepciones confirmadas, no solo el subset del RPC", () => {
    // Simula el estado legacy que dejaba el RPC: SOLO 050 persistido.
    const legacyRcFromRpc = [
      { conceptCode: "050", appearsNormally: true, lastAmount: 200, source: "last_payslip", confirmed: true },
    ]

    const rc = buildRecurringConceptsFromPayslipLines(
      TARJETON_REAL_LINES,
      "2026-08-31",
      legacyRcFromRpc,
    )

    const codes = rc.map((e) => e.conceptCode).sort()
    expect(codes).toEqual(["002", "011", "020", "022", "032", "033", "050", "054", "072"])

    // Invariantes del tarjetón real:
    const byCode = new Map(rc.map((e) => [e.conceptCode, e]))
    expect(byCode.get("002")!.lastAmount).toBe(3937.64)
    expect(byCode.get("011")!.lastAmount).toBe(3234.77)
    expect(byCode.get("050")!.lastAmount).toBe(200.00)
    expect(byCode.get("050")!.lastAmount!).not.toBe(TOTAL_PERCEPCIONES_REAL)

    for (const e of rc) {
      expect(e.confirmed).toBe(true)
      expect(e.occurrenceType).not.toBe("one_time")
    }
  })

  it("selector de la portada suma el TOTAL COMPROBADO ($14,256.87), nunca una percepción suelta", async() => {
    const { sumComprobadoTarjeton } = await import("@/features/simulador-nomina/services/simulate")

    const legacyRcFromRpc = [
      { conceptCode: "050", appearsNormally: true, lastAmount: 200, source: "last_payslip", confirmed: true },
    ]
    const rc = buildRecurringConceptsFromPayslipLines(TARJETON_REAL_LINES, "2026-08-31", legacyRcFromRpc)

    // Perfil tal como queda tras la hidratación del simulador:
    const profile = { recurringConcepts: rc as RecurringConceptEvidence[] } as never

    const total = sumComprobadoTarjeton(profile)
    expect(total).toBeCloseTo(TOTAL_PERCEPCIONES_REAL, 2)
    expect(total).not.toBe(200)
  })

  it("buildWorkerContextPayroll mantiene los totales declarados del tarjetón", () => {
    const payroll = buildWorkerContextPayroll(
      {
        period_raw: "2A-AGO-2026",
        payroll_totals: { totalEarnings: 14256.87, totalDeductions: 10339.87, netPay: 3917.00 },
      },
      [],
      [],
      TARJETON_REAL_LINES,
    )
    expect(payroll!.totalEarnings).toBe(14256.87)
    expect(payroll!.totalDeductions).toBe(10339.87)
    expect(payroll!.netPay).toBe(3917.00)
    expect(payroll!.recurringConcepts).toHaveLength(9)

    // La suma de anclas coincide con el total declarado (todas confirmadas):
    const sum = (payroll!.recurringConcepts as RecurringConceptEvidence[])
      .reduce((s, e) => s + (e.lastAmount ?? 0), 0)
    expect(sum).toBeCloseTo(TOTAL_PERCEPCIONES_REAL, 2)
  })

  it("preserva entradas previas de códigos ausentes en el último tarjetón", () => {
    const previo = [
      { conceptCode: "063", appearsNormally: true, lastAmount: 150, source: "last_payslip", lastSeenAt: "2026-07-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "until_changed" },
    ]
    const rc = buildRecurringConceptsFromPayslipLines(TARJETON_REAL_LINES, "2026-08-31", previo)
    const c063 = rc.find((e) => e.conceptCode === "063")
    expect(c063).toBeDefined()
    expect(c063!.lastAmount).toBe(150)
    expect(c063!.lastSeenAt).toBe("2026-07-31") // no lo toca el merge
  })
})

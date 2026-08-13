/**
 * REGRESIÓN: "el tarjetón se lee correctamente pero no se guarda".
 *
 * Antecedente (incidente real): un tarjetón con texto nativo se leía
 * completo (matrícula, categoría, percepciones, deducciones, totales),
 * pero al confirmar la transacción de Supabase hacía rollback y no se
 * guardaba NADA. La causa: la sección de OBSERVACIONES contenía números
 * válidos para JavaScript pero incompatibles con las columnas tipadas de
 * PostgreSQL (initialCharge gigante por mala reconstrucción del PDF,
 * units fuera de SMALLINT), y un solo INSERT fallido revertía todo.
 *
 * Este test reproduce ese tarjetón (anónimo, con el layout geométrico
 * observado) y exige que el flujo completo lo guarde: los campos
 * opcionales inválidos se normalizan y solo se registra un warning.
 */
import { describe, expect, it } from "vitest"
import { parseImssTarjeton } from "../lib/imss-tarjeton-parser"
import { confirmTarjetonService } from "../services/confirm-tarjeton"
import type { ConfirmTarjetonRequest, PositionedPdfText } from "@/shared/contracts/tarjeton-import"

function positionedItem(x: number, y: number, text: string): PositionedPdfText {
  return {
    text,
    page: 1,
    x,
    y,
    width: Math.max(10, text.length * 3),
    height: 10,
    confidence: 1,
    method: "native_text",
  }
}

// Layout del tarjetón real anonimizado: receptor arriba, percepciones y
// deducciones en dos columnas, y una sección de OBSERVACIONES con la fila
// 190 cuyo cargo inicial se reconstruyó con dígitos de más (artifact del
// PDF) y cuyas unidades exceden SMALLINT.
const items: PositionedPdfText[] = [
  positionedItem(10, 10, "INSTITUTO MEXICANO DEL SEGURO SOCIAL"),
  positionedItem(10, 30, "RECIBO DE PAGO DE NOMINA"),
  positionedItem(10, 50, "RECEPTOR"),
  positionedItem(10, 70, "PERIODO DE PAGO 1A-ENE-2026"),
  positionedItem(10, 90, "MATRICULA 123456"),
  positionedItem(10, 110, "NOMBRE MARIA JOSE GARCIA RUIZ"),
  positionedItem(10, 130, "NOMBRE CATEGORIA/PUESTO ENFERMERA GENERAL 80"),
  positionedItem(200, 150, "PERCEPCIONES"),
  positionedItem(200, 170, "002 SUELDO BASE 3,937.64"),
  positionedItem(200, 190, "TOTAL PERCEPCIONES 3,937.64"),
  positionedItem(400, 150, "DEDUCCIONES"),
  positionedItem(400, 170, "212 ISR -234.56"),
  positionedItem(400, 190, "TOTAL DEDUCCIONES 234.56"),
  positionedItem(400, 210, "LIQUIDO 3,703.08"),
  positionedItem(10, 260, "OBSERVACIONES"),
  positionedItem(10, 280, "190 PRESTAMO CAJA DE AHORRO 2,670.42 2026014 99999 UNIDADES CARGO INICIAL 742,135,987,210.00"),
  positionedItem(10, 300, "CERTIFICACION 31-01-2026"),
]

describe("regresión: tarjetón que se lee pero no se guarda", () => {
  it("el parser produce los valores problemáticos (reproducción del defecto)", async () => {
    const outcome = await parseImssTarjeton({ items, pageCount: 1 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const observation = outcome.parsed.payroll.observations[0]
    expect(observation.conceptCode).toBe("190")
    // Estos valores sobrevivían al parser y reventaban el RPC:
    // - units 99999 > SMALLINT (32767) → smallint out of range
    // - initialCharge 742135987210 → artifact del PDF sin control de rango
    expect(observation.units).toBe(99999)
    expect(observation.initialCharge).toBe(742135987210)
  })

  it("el flujo completo confirma el tarjetón sanitizando solo los campos opcionales inválidos", async () => {
    const outcome = await parseImssTarjeton({ items, pageCount: 1 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const parsed = outcome.parsed
    parsed.payroll.earnings = parsed.payroll.earnings.map((line) => ({ ...line, confirmedByUser: true }))
    parsed.payroll.deductions = parsed.payroll.deductions.map((line) => ({ ...line, confirmedByUser: true }))

    let sentArgs: Record<string, unknown> | null = null
    const rpc = async (_fn: string, args: Record<string, unknown>) => {
      sentArgs = args
      return {
        data: { schemaVersion: "1.0", id: "payslip-1", duplicate: false, profileUpdated: false, payrollContextUpdated: true },
        error: null,
      }
    }

    const request: ConfirmTarjetonRequest = {
      schemaVersion: "1.0",
      sourceHash: "a".repeat(64),
      parsed,
      profileUpdates: {},
      acknowledgeTotalDifference: false,
      authorizeServerStorage: true,
    }

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(true)

    const sentParsed = (sentArgs!.p_parsed as ConfirmTarjetonRequest["parsed"])
    // La observación se conserva con los campos sanos.
    expect(sentParsed.payroll.observations[0]).toMatchObject({
      conceptCode: "190",
      duePeriod: "2026014",
    })
    // Los campos que habrían provocado el rollback se normalizaron.
    expect(sentParsed.payroll.observations[0].units).toBeUndefined()
    expect(sentParsed.payroll.observations[0].initialCharge).toBeUndefined()
    // Queda evidencia del saneamiento en los warnings.
    expect(sentParsed.extraction.warnings).toContain("Observación 1 (190): unidades inválidas; se omitieron.")
    expect(sentParsed.extraction.warnings.some((warning: string) => warning.includes("cargo inicial inválido"))).toBe(true)
    // Los datos críticos se conservan intactos.
    expect(sentParsed.payroll.earnings).toHaveLength(1)
    expect(sentParsed.payroll.earnings[0].amount).toBe(3937.64)
    expect(sentParsed.payroll.totalEarnings).toBe(3937.64)
    expect(sentParsed.payroll.netPay).toBe(3703.08)
  })
})

import { describe, expect, it } from "vitest"
import { isConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"
import { normalizeRpcResponse } from "@/features/tarjeton/services/confirm-tarjeton"

describe("normalizeRpcResponse", () => {
  it("acepta una confirmación exitosa aunque PostgreSQL incluya warnings diagnósticos", () => {
    const normalized = normalizeRpcResponse({
      id: "11111111-1111-4111-8111-111111111111",
      duplicate: false,
      warnings: ["Este tarjetón ya había sido importado anteriormente."],
      profileUpdated: true,
      payrollContextUpdated: true,
    })

    expect(normalized).toEqual({
      schemaVersion: "1.0",
      id: "11111111-1111-4111-8111-111111111111",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
    })
    expect(isConfirmTarjetonResponse(normalized)).toBe(true)
  })

  it("conserva schemaVersion cuando ya viene del wrapper público", () => {
    const normalized = normalizeRpcResponse({
      schemaVersion: "1.0",
      id: "22222222-2222-4222-8222-222222222222",
      duplicate: true,
      warnings: ["Duplicado reconciliado"],
      profileUpdated: true,
      payrollContextUpdated: true,
    })

    expect(isConfirmTarjetonResponse(normalized)).toBe(true)
    expect(normalized).not.toHaveProperty("warnings")
  })

  it("no oculta claves desconocidas distintas de warnings", () => {
    const normalized = normalizeRpcResponse({
      id: "33333333-3333-4333-8333-333333333333",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
      unexpectedField: "debe seguir siendo inválido",
    })

    expect(isConfirmTarjetonResponse(normalized)).toBe(false)
  })
})

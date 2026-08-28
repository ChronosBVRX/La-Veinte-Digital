import { describe, expect, it } from "vitest"
import { describeScannerError } from "../components/scannerError"

const ctx = { bridgeReady: true, nativeShell: true }

describe("describeScannerError", () => {
  it("maps NotAllowedError to a permission message", () => {
    const err = new Error("Permission denied")
    err.name = "NotAllowedError"
    expect(describeScannerError(err, ctx)).toContain("Permitir cámara")
  })

  it("maps NotFoundError", () => {
    const err = new Error("no device")
    err.name = "NotFoundError"
    expect(describeScannerError(err, ctx)).toContain("cámara en este dispositivo")
  })

  it("maps NotReadableError", () => {
    const err = new Error("busy")
    err.name = "NotReadableError"
    expect(describeScannerError(err, ctx)).toContain("ocupada")
  })

  it("maps OverconstrainedError", () => {
    const err = new Error("constraint")
    err.name = "OverconstrainedError"
    expect(describeScannerError(err, ctx)).toContain("configurarse")
  })

  it("maps SecurityError", () => {
    const err = new Error("insecure")
    err.name = "SecurityError"
    expect(describeScannerError(err, ctx)).toContain("contexto no es seguro")
  })

  it("maps AbortError", () => {
    const err = new Error("cancel")
    err.name = "AbortError"
    expect(describeScannerError(err, ctx)).toContain("canceló")
  })

  it("maps TypeError", () => {
    const err = new TypeError("not a function")
    expect(describeScannerError(err, ctx)).toContain("no está disponible")
  })

  it("falls back to the error message for unknown errors", () => {
    const err = new Error("something unexpected")
    expect(describeScannerError(err, ctx)).toBe("something unexpected")
  })

  it("falls back to a generic message when the error has no message", () => {
    expect(describeScannerError("boom", ctx)).toContain("No se pudo acceder a la cámara")
  })
})

import { describe, it, expect, vi } from "vitest"
import { isTransientQueryFailure, withSingleRetry } from "../lib/with-single-retry"

describe("isTransientQueryFailure", () => {
  it("sin error no es un fallo", () => {
    expect(isTransientQueryFailure({ error: null, status: 200 })).toBe(false)
  })

  it("status 0 (red) es transitorio", () => {
    expect(isTransientQueryFailure({ error: { code: "", message: "fetch failed" }, status: 0 })).toBe(true)
  })

  it("5xx, 408 y 429 son transitorios", () => {
    expect(isTransientQueryFailure({ error: { code: "XX000" }, status: 503 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "XX000" }, status: 502 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "XX000" }, status: 408 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "XX000" }, status: 429 })).toBe(true)
  })

  it("error de red sin código ni status es transitorio", () => {
    expect(isTransientQueryFailure({ error: { message: "TypeError: fetch failed" } })).toBe(true)
  })

  it("permisos/RLS, esquema y query inválida NO se reintentan", () => {
    expect(isTransientQueryFailure({ error: { code: "42501" }, status: 403 })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "42P01" }, status: 404 })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "22P02" }, status: 400 })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "PGRST116" }, status: 406 })).toBe(false)
  })

  it("4xx con status conocido y sin código NO se reintentan", () => {
    expect(isTransientQueryFailure({ error: { message: "bad request" }, status: 400 })).toBe(false)
    expect(isTransientQueryFailure({ error: { message: "unauthorized" }, status: 401 })).toBe(false)
    expect(isTransientQueryFailure({ error: { message: "forbidden" }, status: 403 })).toBe(false)
    expect(isTransientQueryFailure({ error: { message: "not found" }, status: 404 })).toBe(false)
  })

  it("408, 429 y 5xx con status conocido y sin código se reintentan", () => {
    expect(isTransientQueryFailure({ error: { message: "request timeout" }, status: 408 })).toBe(true)
    expect(isTransientQueryFailure({ error: { message: "rate limited" }, status: 429 })).toBe(true)
    expect(isTransientQueryFailure({ error: { message: "internal error" }, status: 500 })).toBe(true)
    expect(isTransientQueryFailure({ error: { message: "bad gateway" }, status: 502 })).toBe(true)
  })

  it("status 0 o error de red sin status ni código se reintentan", () => {
    expect(isTransientQueryFailure({ error: { message: "fetch failed" }, status: 0 })).toBe(true)
    expect(isTransientQueryFailure({ error: { message: "TypeError: fetch failed" } })).toBe(true)
  })

  it("sin status, los códigos PostgreSQL/PostgREST deciden", () => {
    expect(isTransientQueryFailure({ error: { code: "57P03" } })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "08006" } })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "PGRST003" } })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "42501" } })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "42P01" } })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "22P02" } })).toBe(false)
    expect(isTransientQueryFailure({ error: { code: "PGRST116" } })).toBe(false)
  })

  it("el status HTTP conocido tiene prioridad sobre el código", () => {
    expect(isTransientQueryFailure({ error: { code: "42501" }, status: 503 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "57P03" }, status: 400 })).toBe(false)
  })

  it("códigos transitorios de PostgreSQL se reintentan", () => {
    expect(isTransientQueryFailure({ error: { code: "57P03" }, status: 503 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "08006" }, status: 500 })).toBe(true)
    expect(isTransientQueryFailure({ error: { code: "PGRST003" }, status: 504 })).toBe(true)
  })
})

describe("withSingleRetry", () => {
  it("una consulta exitosa se ejecuta una sola vez", async () => {
    const run = vi.fn(async () => ({ error: null, status: 200, data: "ok" }))
    const { value, attempts } = await withSingleRetry(run, 0)

    expect(attempts).toBe(1)
    expect(run).toHaveBeenCalledTimes(1)
    expect(value.data).toBe("ok")
  })

  it("un error permanente no se reintenta", async () => {
    const run = vi.fn(async () => ({ error: { code: "42501" }, status: 403, data: null }))
    const { value, attempts } = await withSingleRetry(run, 0)

    expect(attempts).toBe(1)
    expect(run).toHaveBeenCalledTimes(1)
    expect(value.error).toEqual({ code: "42501" })
  })

  it("un fallo transitorio se reintenta una vez y puede recuperarse", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: "57P03" }, status: 503, data: null })
      .mockResolvedValueOnce({ error: null, status: 200, data: "recuperado" })

    const { value, attempts } = await withSingleRetry(run, 0)

    expect(attempts).toBe(2)
    expect(run).toHaveBeenCalledTimes(2)
    expect(value.error).toBeNull()
    expect(value.data).toBe("recuperado")
  })

  it("nunca hace más de un reintento aunque el fallo persista", async () => {
    const run = vi.fn(async () => ({ error: { code: "", message: "fetch failed" }, status: 0, data: null }))
    const { value, attempts } = await withSingleRetry(run, 0)

    expect(attempts).toBe(2)
    expect(run).toHaveBeenCalledTimes(2)
    expect(value.error).toBeTruthy()
  })

  it("acepta un thenable (PostgrestBuilder) sin convertirlo en Promise", async () => {
    const result = { error: null, status: 200, data: [{ id: "payslip-1" }] }
    const thenable = {
      ...result,
      then(onFulfilled: (value: typeof result) => unknown) {
        return Promise.resolve(result).then(onFulfilled)
      },
    }
    const { value, attempts } = await withSingleRetry(() => thenable, 0)

    expect(attempts).toBe(1)
    expect(value.data).toEqual([{ id: "payslip-1" }])
  })
})

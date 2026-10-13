import { describe, it, expect, vi } from "vitest"
import { CajaClient } from "../client"

describe("CajaClient", () => {
  it("validateMatricula realiza petición GET sin Bearer", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", payload: { matricula: "123456" } }),
    })

    const client = new CajaClient({ fetchImpl: mockFetch })
    const res = await client.validateMatricula("123456")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain("users/validate/123456")
    expect(callArgs[1].method).toBe("GET")
    expect(callArgs[1].headers.authorization).toBeUndefined()
    expect(res.status).toBe("ok")
  })

  it("login realiza POST con matrícula y password", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", payload: { authToken: "tok123", sessionTime: 1800 } }),
    })

    const client = new CajaClient({ fetchImpl: mockFetch })
    const res = await client.login({ matricula: "123456", password: "secretPassword" })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain("login")
    expect(callArgs[1].method).toBe("POST")
    expect(JSON.parse(callArgs[1].body)).toEqual({ matricula: "123456", password: "secretPassword" })
    expect(res.payload?.authToken).toBe("tok123")
  })

  it("getBalance envía Bearer token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        payload: { saldoTotal: 15000, saldoAhorro: 12000, saldoPrestamo: 3000 },
      }),
    })

    const client = new CajaClient({
      fetchImpl: mockFetch,
      getToken: () => "valid-bearer-token",
    })
    const res = await client.getBalance("123456")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain("accounts/123456/balance")
    expect(callArgs[1].headers.authorization).toBe("Bearer valid-bearer-token")
    expect(res.payload?.saldoTotal).toBe(15000)
  })

  it("withdrawPartial envía PUT con cuerpo JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", message: "Retiro procesado" }),
    })

    const client = new CajaClient({
      fetchImpl: mockFetch,
      getToken: () => "valid-bearer-token",
    })
    await client.withdrawPartial("123456", { monto: 5000, cuentaClabe: "012180000118359719" })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain("accounts/123456/balance/pwithdraw")
    expect(callArgs[1].method).toBe("PUT")
    expect(JSON.parse(callArgs[1].body)).toEqual({ monto: 5000, cuentaClabe: "012180000118359719" })
  })

  it("lanza CajaApiError con código y status HTTP en caso de error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        code: "1040",
        message: "Matricula no encontrada",
        status: "error",
      }),
    })

    const client = new CajaClient({ fetchImpl: mockFetch })
    await expect(client.validateMatricula("999999")).rejects.toMatchObject({
      httpStatus: 404,
      code: "1040",
      apiMessage: "Matricula no encontrada",
    })
  })

  it("logoutServer envía GET logout/{matricula} con Bearer token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", message: "Sesión cerrada" }),
    })

    const client = new CajaClient({
      fetchImpl: mockFetch,
      getToken: () => "mock-bearer-token",
    })
    await client.logoutServer("123456")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[0]).toContain("logout/123456")
    expect(callArgs[1].method).toBe("GET")
    expect(callArgs[1].headers.authorization).toBe("Bearer mock-bearer-token")
  })
})


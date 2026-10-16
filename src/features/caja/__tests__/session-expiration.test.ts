import { describe, it, expect } from "vitest"
import { CajaSessionExpiredError, isCajaSessionExpired } from "../services/caja-service"
import { extractJwtExpiry } from "@/lib/caja/session"

describe("Caja session expiration handling", () => {
  describe("CajaSessionExpiredError and isCajaSessionExpired", () => {
    it("crea una instancia de CajaSessionExpiredError con código y mensaje predeterminado", () => {
      const err = new CajaSessionExpiredError()
      expect(err.name).toBe("CajaSessionExpiredError")
      expect(err.code).toBe("session_expired")
      expect(err.message).toContain("ha expirado")
      expect(isCajaSessionExpired(err)).toBe(true)
    })

    it("identifica errores con status 401 o código unauthenticated", () => {
      expect(isCajaSessionExpired({ status: 401, message: "Unauthorized" })).toBe(true)
      expect(isCajaSessionExpired({ code: "unauthenticated" })).toBe(true)
      expect(isCajaSessionExpired({ code: "session_expired" })).toBe(true)
    })

    it("identifica errores con mensajes de sesión expirada o token inválido", () => {
      expect(isCajaSessionExpired(new Error("La sesión ha expirado"))).toBe(true)
      expect(isCajaSessionExpired(new Error("Token inválido o revocado"))).toBe(true)
      expect(isCajaSessionExpired(new Error("sesión cerrada por inactividad"))).toBe(true)
      expect(isCajaSessionExpired(new Error("Request unauthorized"))).toBe(true)
    })

    it("retorna false para errores que no son de sesión", () => {
      expect(isCajaSessionExpired(null)).toBe(false)
      expect(isCajaSessionExpired(undefined)).toBe(false)
      expect(isCajaSessionExpired(new Error("Fallo de conexión timeout"))).toBe(false)
      expect(isCajaSessionExpired({ code: "balance_error", status: 500 })).toBe(false)
    })
  })

  describe("extractJwtExpiry", () => {
    it("extrae la fecha de expiración de un JWT válido", () => {
      const expUnix = Math.floor(Date.now() / 1000) + 3600
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
      const payload = Buffer.from(JSON.stringify({ sub: "12345", exp: expUnix })).toString("base64url")
      const fakeJwt = `${header}.${payload}.fakesig`

      const extracted = extractJwtExpiry(fakeJwt)
      expect(extracted).toBe(expUnix * 1000)
    })

    it("retorna null si la cadena no es JWT o no contiene claim exp", () => {
      expect(extractJwtExpiry("not-a-jwt")).toBeNull()
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")
      const payloadNoExp = Buffer.from(JSON.stringify({ sub: "12345" })).toString("base64url")
      expect(extractJwtExpiry(`${header}.${payloadNoExp}.fakesig`)).toBeNull()
    })
  })
})

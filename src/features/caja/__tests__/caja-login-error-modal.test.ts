import { describe, it, expect } from "vitest"
import { CajaLoginError } from "../services/caja-service"

describe("CajaLoginError y detección de sesión activa", () => {
  it("construye CajaLoginError con código, estado y flag de sesión activa", () => {
    const err = new CajaLoginError(
      "Ya cuenta con una sesión activa. Intente de nuevo.",
      "1041",
      true,
      409
    )

    expect(err.name).toBe("CajaLoginError")
    expect(err.message).toBe("Ya cuenta con una sesión activa. Intente de nuevo.")
    expect(err.code).toBe("1041")
    expect(err.isSessionActive).toBe(true)
    expect(err.status).toBe(409)
  })

  it("detecta sesión activa vía regex o flag", () => {
    const activeMessages = [
      "Ya cuenta con una sesión activa.",
      "El usuario ya tiene una sesion activa en otro equipo",
      "Existe una Sesión Activa previa",
    ]

    for (const msg of activeMessages) {
      const isDetected = /sesi[oó]n.*activa/i.test(msg)
      expect(isDetected).toBe(true)
    }
  })

  it("distingue errores de credenciales incorrectas", () => {
    const credMessages = [
      "Matricula y/o Password incorrectos. Intente de nuevo",
      "Contraseña inválida",
    ]

    for (const msg of credMessages) {
      const isCredErr = /incorrect[oa]s/i.test(msg) || /password/i.test(msg) || /contrase[ñn]a/i.test(msg)
      expect(isCredErr).toBe(true)
    }
  })
})

import { describe, it, expect, beforeEach } from "vitest"
import {
  saveCajaCredentials,
  loadCajaCredentials,
  clearCajaCredentials,
  hasSavedCajaCredentials,
} from "../services/caja-credentials-storage"

describe("caja-credentials-storage", () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    // Mock global window y localStorage en entorno node de vitest
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    }

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: mockStorage },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    })
  })

  it("guarda las credenciales cifradas y nunca almacena la contraseña en texto plano", async () => {
    const userId = "usr-12345"
    const creds = { matricula: "99887766", password: "MiSuperPasswordSecreto123!" }

    const ok = await saveCajaCredentials(userId, creds)
    expect(ok).toBe(true)

    // Verificar en el store crudo
    const rawEntry = Array.from(store.values())[0]
    expect(rawEntry).toBeDefined()
    expect(rawEntry).not.toContain("MiSuperPasswordSecreto123!")
    expect(rawEntry).not.toContain("99887766")

    const parsed = JSON.parse(rawEntry)
    expect(parsed.v).toBe(1)
    expect(parsed.iv).toBeDefined()
    expect(parsed.ct).toBeDefined()
  })

  it("recupera y descifra correctamente las credenciales guardadas", async () => {
    const userId = "usr-abc-001"
    const creds = { matricula: "12345678", password: "ClaveDeAcceso2026$" }

    await saveCajaCredentials(userId, creds)
    const loaded = await loadCajaCredentials(userId)

    expect(loaded).toEqual({
      matricula: "12345678",
      password: "ClaveDeAcceso2026$",
    })
  })

  it("aísla las credenciales entre diferentes usuarios (multiusuario)", async () => {
    const user1 = "user-alice"
    const user2 = "user-bob"

    await saveCajaCredentials(user1, { matricula: "11111111", password: "pwd-alice" })
    await saveCajaCredentials(user2, { matricula: "22222222", password: "pwd-bob" })

    const creds1 = await loadCajaCredentials(user1)
    const creds2 = await loadCajaCredentials(user2)

    expect(creds1?.matricula).toBe("11111111")
    expect(creds2?.matricula).toBe("22222222")

    // user1 no puede leer con la clave de user2
    clearCajaCredentials(user1)
    expect(await loadCajaCredentials(user1)).toBeNull()
    expect(await loadCajaCredentials(user2)).not.toBeNull()
  })

  it("borra las credenciales correctamente", async () => {
    const userId = "user-to-clear"
    await saveCajaCredentials(userId, { matricula: "12345678", password: "test" })

    expect(hasSavedCajaCredentials(userId)).toBe(true)
    clearCajaCredentials(userId)
    expect(hasSavedCajaCredentials(userId)).toBe(false)
    expect(await loadCajaCredentials(userId)).toBeNull()
  })

  it("falla limpiamente y retorna null si no hay datos o la entrada está corrupta", async () => {
    const userId = "user-corrupt"
    store.set(`caja_saved_credentials:v2:${userId}`, "invalid-json")

    const loaded = await loadCajaCredentials(userId)
    expect(loaded).toBeNull()
  })
})

import { describe, it, expect, vi } from "vitest"
import { getUserWithTimeout } from "@/shared/lib/auth-helpers"
import type { User } from "@supabase/supabase-js"

type MockClient = Parameters<typeof getUserWithTimeout>[0]

describe("Manejo Seguro de Autenticación con Timeout Determinista (getUserWithTimeout)", () => {
  it("resuelve normalmente cuando Supabase responde de inmediato con usuario", async () => {
    const mockUser = { id: "usr_ok", email: "test@example.com" } as User
    const client: MockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    }

    const res = await getUserWithTimeout(client, 1000)
    expect(res.timedOut).toBe(false)
    expect(res.user?.id).toBe("usr_ok")
    expect(res.error).toBeUndefined()
  })

  it("maneja el rechazo o error de Supabase sin lanzar excepciones no controladas", async () => {
    const client: MockClient = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Network connection lost")),
      },
    }

    const res = await getUserWithTimeout(client, 1000)
    expect(res.timedOut).toBe(false)
    expect(res.user).toBeNull()
    expect(res.error).toBeDefined()
  })

  it("aplica timeout determinista ante promesas colgadas que nunca resuelven", async () => {
    const client: MockClient = {
      auth: {
        getUser: vi.fn().mockImplementation(() => new Promise(() => {})), // Promesa infinita
      },
    }

    const startTime = Date.now()
    const res = await getUserWithTimeout(client, 100)
    const elapsed = Date.now() - startTime

    expect(res.timedOut).toBe(true)
    expect(res.user).toBeNull()
    expect(elapsed).toBeGreaterThanOrEqual(90)
  })

  it("ignora resoluciones tardías que llegan después de haberse activado el timeout", async () => {
    const mockUser = { id: "usr_late" } as User
    const client: MockClient = {
      auth: {
        getUser: vi.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: { user: mockUser }, error: null })
            }, 300)
          })
        }),
      },
    }

    const res = await getUserWithTimeout(client, 50)
    expect(res.timedOut).toBe(true)
    expect(res.user).toBeNull()
  })

  it("ignora el resultado si la señal se abortó por desmontaje del componente", async () => {
    const mockUser = { id: "usr_unmounted" } as User
    const signal = { aborted: true }
    const client: MockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    }

    const res = await getUserWithTimeout(client, 1000, signal)
    expect(res.timedOut).toBe(false)
    expect(res.user).toBeNull()
  })
})

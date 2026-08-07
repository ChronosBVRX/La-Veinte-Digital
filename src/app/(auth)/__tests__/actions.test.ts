import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => {
  const signInWithPassword = vi.fn()
  const signUp = vi.fn()
  const from = vi.fn()
  return {
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    createClient: vi.fn(async () => ({
      auth: { signInWithPassword, signUp },
      from,
    })),
    signInWithPassword,
    signUp,
    from,
  }
})

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: () => mocks.redirect() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))

import { signInAction, signUpAction } from "@/app/(auth)/actions"

function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  const base = { email: "user@test.local", password: "secret123", full_name: "Test User" }
  for (const [k, v] of Object.entries({ ...base, ...overrides })) fd.append(k, v)
  return fd
}

describe("signInAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirige al dashboard con credenciales validas", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })

    await signInAction(undefined, formData())
    expect(mocks.redirect).toHaveBeenCalled()
  })

  it("devuelve error con credenciales invalidas sin lanzar excepcion", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid login credentials"),
    })

    const result = await signInAction(undefined, formData())
    expect(result).toEqual({ error: "Credenciales incorrectas. Verifica tu correo y contraseña." })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})

describe("signUpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirect.mockReturnValue(undefined)
  })

  it("envía full_name en user_metadata de signUp", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    await signUpAction(undefined, formData())

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "user@test.local",
      password: "secret123",
      options: { data: { full_name: "Test User" } },
    })
  })

  it("no llama a profiles.upsert", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    await signUpAction(undefined, formData())

    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("devuelve error de registro sin lanzar excepcion", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: new Error("signup failed") })

    const result = await signUpAction(undefined, formData())
    expect(result).toEqual({ error: "No se pudo crear la cuenta. Intenta con otro correo." })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

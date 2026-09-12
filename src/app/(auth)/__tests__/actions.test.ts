import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => {
  const signInWithPassword = vi.fn()
  const signUp = vi.fn()
  const resend = vi.fn()
  const resetPasswordForEmail = vi.fn()
  const from = vi.fn()
  return {
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    createClient: vi.fn(async () => ({
      auth: { signInWithPassword, signUp, resend, resetPasswordForEmail },
      from,
    })),
    signInWithPassword,
    signUp,
    resend,
    resetPasswordForEmail,
    from,
  }
})

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: () => mocks.redirect() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import { signInAction, signUpAction, resendConfirmationAction } from "@/app/(auth)/actions"

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
      options: {
        data: { full_name: "Test User" },
        emailRedirectTo: "http://localhost:3000/callback",
      },
    })
  })

  it("devuelve aviso de confirmación en lugar de redirigir", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    const result = await signUpAction(undefined, formData())

    expect(result?.success).toBe(true)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it("mapea el límite de envíos a mensaje de espera", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: Object.assign(new Error("over_email_send_rate_limit"), { status: 429 }) })

    const result = await signUpAction(undefined, formData())

    expect(result).toEqual({ error: "Demasiados intentos. Espera 60 segundos antes de reintentarlo." })
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

describe("resendConfirmationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function emailOnly(email: string) {
    const fd = new FormData()
    fd.append("email", email)
    return fd
  }

  it("reenvía la confirmación con redirect al callback", async () => {
    mocks.resend.mockResolvedValue({ data: {}, error: null })

    const result = await resendConfirmationAction(undefined, emailOnly("user@test.local"))

    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "user@test.local",
      options: { emailRedirectTo: "http://localhost:3000/callback" },
    })
    expect(result?.success).toBe(true)
  })

  it("pide el correo cuando viene vacío", async () => {
    const result = await resendConfirmationAction(undefined, emailOnly("   "))

    expect(result).toEqual({ error: "Ingresa tu correo electrónico." })
    expect(mocks.resend).not.toHaveBeenCalled()
  })

  it("mapea el 429 a mensaje de espera de 60 segundos", async () => {
    mocks.resend.mockResolvedValue({ data: null, error: Object.assign(new Error("Too many requests"), { status: 429 }) })

    const result = await resendConfirmationAction(undefined, emailOnly("user@test.local"))

    expect(result).toEqual({ error: "Demasiados intentos. Espera 60 segundos antes de reintentarlo." })
  })
})

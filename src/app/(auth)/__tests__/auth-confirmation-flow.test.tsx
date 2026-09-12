// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const mocks = vi.hoisted(() => {
  const signUp = vi.fn()
  const resend = vi.fn()
  return {
    createClient: vi.fn(async () => ({
      auth: { signUp, resend },
    })),
    signUp,
    resend,
  }
})

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import { ResendConfirmationForm } from "@/app/(auth)/login/resend-confirmation-form"
import { RegisterForm } from "@/app/(auth)/register/register-form"

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ResendConfirmationForm", () => {
  it("reenvía y activa enfriamiento con cuenta regresiva", async () => {
    mocks.resend.mockResolvedValue({ data: {}, error: null })
    const { container } = render(<ResendConfirmationForm email="user@test.local" cooldownSeconds={2} />)

    const button = screen.getByRole("button", { name: /reenviar confirmación/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)

    fireEvent.submit(container.querySelector("form")!)
    await screen.findByText(/reenviamos el correo de confirmación/i)

    const cooling = await screen.findByRole("button", { name: /reenviar en \d+s/i })
    expect((cooling as HTMLButtonElement).disabled).toBe(true)

    const released = await screen.findByRole("button", { name: /reenviar confirmación/i }, { timeout: 5000 })
    expect((released as HTMLButtonElement).disabled).toBe(false)
  }, 10000)

  it("muestra error comprensible ante 429", async () => {
    mocks.resend.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Too many requests"), { status: 429 }),
    })
    render(<ResendConfirmationForm email="user@test.local" />)

    fireEvent.submit(screen.getByRole("button", { name: /reenviar confirmación/i }).closest("form")!)
    await screen.findByText(/espera 60 segundos/i)
  })
})

describe("RegisterForm", () => {
  it("tras el registro pide revisar correo y spam", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
    const { container } = render(<RegisterForm />)

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: "Test User" } })
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "user@test.local" } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret123" } })
    fireEvent.submit(container.querySelector("form")!)

    await screen.findByText("Revisa tu correo electrónico")
    expect(screen.getByText(/bandeja de entrada o spam/i)).toBeTruthy()
  })
})

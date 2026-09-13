// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { isFacebookLoginEnabled } from "@/shared/lib/auth-providers"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: {} })),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import { LoginForm } from "@/app/(auth)/login/login-form"
import { RegisterForm } from "@/app/(auth)/register/register-form"

const FLAG = "NEXT_PUBLIC_ENABLE_FACEBOOK_LOGIN"

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env[FLAG]
})

afterEach(() => {
  delete process.env[FLAG]
})

describe("isFacebookLoginEnabled", () => {
  it("oculto por defecto (sin variable)", () => {
    expect(isFacebookLoginEnabled()).toBe(false)
  })

  it("oculto con cualquier valor distinto de true", () => {
    process.env[FLAG] = "false"
    expect(isFacebookLoginEnabled()).toBe(false)
    process.env[FLAG] = "1"
    expect(isFacebookLoginEnabled()).toBe(false)
  })

  it("visible solo con true exacto (reactivación reversible)", () => {
    process.env[FLAG] = "true"
    expect(isFacebookLoginEnabled()).toBe(true)
  })
})

describe("Facebook Login oculto en producción", () => {
  it("login: Google visible, Facebook ausente", () => {
    render(<LoginForm />)
    expect(screen.getByRole("button", { name: /google/i })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /facebook/i })).toBeNull()
  })

  it("registro: Google visible, Facebook ausente", () => {
    render(<RegisterForm />)
    expect(screen.getByRole("button", { name: /google/i })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /facebook/i })).toBeNull()
  })

  it("con flag true reaparece en ambos sin tocar código", () => {
    process.env[FLAG] = "true"
    const { unmount } = render(<LoginForm />)
    expect(screen.getByRole("button", { name: /facebook/i })).toBeTruthy()
    unmount()
    render(<RegisterForm />)
    expect(screen.getByRole("button", { name: /facebook/i })).toBeTruthy()
  })
})

import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => {
  const signUp = vi.fn()
  const from = vi.fn()
  return {
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    createClient: vi.fn(async () => ({
      auth: { signUp },
      from,
    })),
    signUp,
    from,
  }
})

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: () => mocks.redirect() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))

import { signUpAction } from "@/app/(auth)/actions"

function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData()
  const base = { email: "user@test.local", password: "secret123", full_name: "Test User" }
  for (const [k, v] of Object.entries({ ...base, ...overrides })) fd.append(k, v)
  return fd
}

describe("signUpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirect.mockReturnValue(undefined)
  })

  it("envía full_name en user_metadata de signUp", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    await signUpAction(formData())

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "user@test.local",
      password: "secret123",
      options: { data: { full_name: "Test User" } },
    })
  })

  it("no llama a profiles.upsert", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })

    await signUpAction(formData())

    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("propaga el error de signUp sin tocar profiles", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null }, error: new Error("signup failed") })

    await expect(signUpAction(formData())).rejects.toThrow("signup failed")
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => {
  const exchangeCodeForSession = vi.fn()
  const getUser = vi.fn()
  const rpc = vi.fn()
  const from = vi.fn()
  return {
    exchangeCodeForSession,
    getUser,
    rpc,
    from,
    createClient: vi.fn(async () => ({
      auth: { exchangeCodeForSession, getUser },
      rpc,
      from,
    })),
  }
})

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))

import { GET } from "../callback/route"

describe("callback route onboarding redirection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ error: null })
  })

  it("redirige a onboarding laboral si el usuario no tiene matricula ni estado basico/configurado", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "google-user-1",
          user_metadata: {},
        },
      },
      error: null,
    })

    // Mock profiles select: sin matricula
    const maybeSingleProfile = vi.fn().mockResolvedValue({ data: { matricula: null, adscripcion: null }, error: null })
    const eqProfile = vi.fn().mockReturnValue({ maybeSingle: maybeSingleProfile })
    const selectProfile = vi.fn().mockReturnValue({ eq: eqProfile })

    // Mock worker_preferences select: unconfigured
    const maybeSinglePrefs = vi.fn().mockResolvedValue({ data: { onboarding_state: "unconfigured" }, error: null })
    const eqPrefs = vi.fn().mockReturnValue({ maybeSingle: maybeSinglePrefs })
    const selectPrefs = vi.fn().mockReturnValue({ eq: eqPrefs })

    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") return { select: selectProfile }
      if (table === "worker_preferences") return { select: selectPrefs }
      return {}
    })

    const req = new Request("http://localhost:3000/callback?code=test-code")
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/profile/mi-informacion-laboral?onboarding=true")
  })

  it("redirige al dashboard si el usuario ya cuenta con matricula registrada", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "worker-user-1",
          user_metadata: {},
        },
      },
      error: null,
    })

    const maybeSingleProfile = vi.fn().mockResolvedValue({ data: { matricula: "12345678", adscripcion: "HGZ 32" }, error: null })
    const eqProfile = vi.fn().mockReturnValue({ maybeSingle: maybeSingleProfile })
    const selectProfile = vi.fn().mockReturnValue({ eq: eqProfile })

    const maybeSinglePrefs = vi.fn().mockResolvedValue({ data: { onboarding_state: "configured" }, error: null })
    const eqPrefs = vi.fn().mockReturnValue({ maybeSingle: maybeSinglePrefs })
    const selectPrefs = vi.fn().mockReturnValue({ eq: eqPrefs })

    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") return { select: selectProfile }
      if (table === "worker_preferences") return { select: selectPrefs }
      return {}
    })

    const req = new Request("http://localhost:3000/callback?code=test-code")
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("respeta el parámetro next seguro y no redirige a onboarding", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })

    const req = new Request("http://localhost:3000/callback?code=test-code&next=/asistente")
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/asistente")
  })

  it("sincroniza matricula y adscripcion desde user_metadata si estan presentes", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "new-user-with-meta",
          user_metadata: {
            matricula: "99887766",
            adscripcion: "UMF 1",
          },
        },
      },
      error: null,
    })

    const eqUpdate = vi.fn().mockResolvedValue({ error: null })
    const updateProfile = vi.fn().mockReturnValue({ eq: eqUpdate })

    const maybeSingleProfile = vi.fn().mockResolvedValue({ data: { matricula: "99887766", adscripcion: "UMF 1" }, error: null })
    const eqProfile = vi.fn().mockReturnValue({ maybeSingle: maybeSingleProfile })
    const selectProfile = vi.fn().mockReturnValue({ eq: eqProfile })

    const maybeSinglePrefs = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqPrefs = vi.fn().mockReturnValue({ maybeSingle: maybeSinglePrefs })
    const selectPrefs = vi.fn().mockReturnValue({ eq: eqPrefs })

    mocks.from.mockImplementation((table: string) => {
      if (table === "profiles") return { update: updateProfile, select: selectProfile }
      if (table === "worker_preferences") return { select: selectPrefs }
      return {}
    })

    const req = new Request("http://localhost:3000/callback?code=test-code")
    const res = await GET(req)

    expect(updateProfile).toHaveBeenCalledWith({
      matricula: "99887766",
      adscripcion: "UMF 1",
    })
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })
})

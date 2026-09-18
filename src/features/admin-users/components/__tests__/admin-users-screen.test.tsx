// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { AdminUserPage } from "@/shared/contracts/admin-users"
import { AdminUsersScreen } from "@/features/admin-users/components/AdminUsersScreen"

const USER_PAGE: AdminUserPage = {
  users: [
    {
      id: "u-1",
      email: "worker@test.local",
      fullName: "Worker Uno",
      matricula: "M-1",
      role: "user",
      accountStatus: "active",
      suspensionKind: null,
      suspensionEndsAt: null,
      emailConfirmed: true,
      registeredAt: "2026-01-01T00:00:00.000Z",
      lastSignInAt: "2026-09-01T00:00:00.000Z",
      providers: ["email"],
      profileComplete: true,
    },
    {
      id: "u-2",
      email: "trashed@test.local",
      fullName: "Worker Dos",
      matricula: null,
      role: "admin",
      accountStatus: "trashed",
      suspensionKind: null,
      suspensionEndsAt: null,
      emailConfirmed: false,
      registeredAt: "2026-02-01T00:00:00.000Z",
      lastSignInAt: null,
      providers: ["google"],
      profileComplete: false,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
}

const DETAIL = {
  user: {
    id: "u-1",
    email: "worker@test.local",
    fullName: "Worker Uno",
    matricula: "M-1",
    adscripcion: null,
    categoria: null,
    role: "user",
    registeredAt: "2026-01-01T00:00:00.000Z",
    profileCreatedAt: "2026-01-01T00:00:00.000Z",
    lastSignInAt: "2026-09-01T00:00:00.000Z",
    emailConfirmedAt: "2026-01-01T00:00:00.000Z",
    providers: ["email"],
  },
  status: {
    accountStatus: "active",
    rawStatus: "active",
    suspensionKind: null,
    suspensionEndsAt: null,
    suspensionExpired: false,
    reason: null,
    changedAt: null,
    changedBy: null,
    trashedAt: null,
    purgeAfter: null,
    sessionsRevokedAt: null,
    authSyncAt: null,
    authSyncError: null,
  },
  union: {
    memberships: [
      {
        id: "m-1",
        delegationId: "00000000-0000-0000-0000-00000000d001",
        delegationCode: "XXI",
        delegationName: "Delegación XXI",
        role: "union_admin",
        active: true,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    delegations: [
      { id: "00000000-0000-0000-0000-00000000d001", code: "XXI", name: "Delegación XXI", active: true },
    ],
  },
  counts: { payslips: 1, remoteDocuments: 1, hasPayrollContext: true },
  diagnostics: {
    authentication: "OK",
    profile: "OK",
    payslip: "DISPONIBLE",
    documents: "DISPONIBLE",
    storage: "OK",
    lastSyncAt: "2026-09-01T00:00:00.000Z",
  },
  flags: { isSelf: false, canReactivate: false, canRestore: false },
  activity: [{ kind: "login" as const, at: "2026-09-01T00:00:00.000Z" }],
  permanentDeleteEnabled: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("AdminUsersScreen", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("muestra el estado vacío sin resultados", () => {
    render(<AdminUsersScreen initialPage={{ users: [], total: 0, page: 1, pageSize: 25 }} initialError={false} />)
    expect(screen.getByText("Sin resultados")).toBeTruthy()
  })

  it("muestra error con reintento y recupera el listado", async () => {
    fetchMock.mockResolvedValue(jsonResponse(USER_PAGE))

    render(<AdminUsersScreen initialPage={null} initialError={true} />)
    expect(screen.getByText("No se pudo cargar el listado")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }))

    await waitFor(() => {
      expect(screen.getAllByText("Worker Uno").length).toBeGreaterThan(0)
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/admin/users?"),
      expect.objectContaining({ cache: "no-store" }),
    )
  })

  it("abre la ficha administrativa desde el menú contextual y muestra diagnósticos", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/admin/users/u-1")) return jsonResponse(DETAIL)
      return jsonResponse(USER_PAGE)
    })

    render(<AdminUsersScreen initialPage={USER_PAGE} initialError={false} />)

    fireEvent.click(screen.getAllByRole("button", { name: /Acciones para Worker Uno/i })[0])
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver ficha" }))

    await waitFor(() => {
      expect(screen.getByText("Diagnóstico técnico")).toBeTruthy()
    })
    expect(screen.getAllByText("DISPONIBLE").length).toBeGreaterThan(0)
    expect(screen.getByText(/No se muestran documentos, tarjetones ni contenido privado/i)).toBeTruthy()
  })

  it("el menú contextual se cierra con Escape (accesibilidad por teclado)", () => {
    render(<AdminUsersScreen initialPage={USER_PAGE} initialError={false} />)

    fireEvent.click(screen.getAllByRole("button", { name: /Acciones para Worker Uno/i })[0])
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0)
  })

  it("exige motivo y confirmación para enviar a papelera y llama a la API", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ ok: true, authSync: "ok" })
      return jsonResponse(USER_PAGE)
    })

    render(<AdminUsersScreen initialPage={USER_PAGE} initialError={false} />)

    fireEvent.click(screen.getAllByRole("button", { name: /Acciones para Worker Uno/i })[0])
    fireEvent.click(screen.getByRole("menuitem", { name: "Enviar a papelera" }))

    const confirmButton = screen.getByRole("button", { name: "Enviar a papelera" }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: "cuenta duplicada" } })
    expect(confirmButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole("checkbox"))
    await waitFor(() => expect(confirmButton.disabled).toBe(false))

    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/u-1/trash",
        expect.objectContaining({ method: "POST" }),
      )
    })
    const body = JSON.parse(String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/trash"))?.[1]?.body))
    expect(body).toEqual({ reason: "cuenta duplicada" })
  })

  it("muestra la sección sindical y permite asignar el rol con motivo", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ ok: true })
      if (String(url).includes("/api/admin/users/u-1")) return jsonResponse(DETAIL)
      return jsonResponse(USER_PAGE)
    })

    render(<AdminUsersScreen initialPage={USER_PAGE} initialError={false} />)

    fireEvent.click(screen.getAllByRole("button", { name: /Acciones para Worker Uno/i })[0])
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver ficha" }))

    await waitFor(() => {
      expect(screen.getByText("Representación Sindical")).toBeTruthy()
    })
    expect(screen.getByText(/Administrador Sindical/)).toBeTruthy()
    expect(screen.getByText(/activo/)).toBeTruthy()
    expect(screen.getByText(/no del rol de plataforma/i)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Asignar rol sindical/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Motivo/i)).toBeTruthy()
    })

    const submit = screen.getByRole("button", { name: "Habilitar acceso" }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: "alta de rol sindical" } })
    await waitFor(() => expect(submit.disabled).toBe(false))

    fireEvent.click(submit)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/users/u-1/union-role",
        expect.objectContaining({ method: "POST" }),
      )
    })
    const body = JSON.parse(
      String(fetchMock.mock.calls.find((call) => String(call[0]).includes("/union-role"))?.[1]?.body),
    )
    expect(body).toEqual({
      delegationId: "00000000-0000-0000-0000-00000000d001",
      role: "union_rep",
      active: true,
      reason: "alta de rol sindical",
    })
  })

  it("bloquea la eliminación definitiva cuando el servidor la deshabilita", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/api/admin/users/u-2")) {
        return jsonResponse({
          ...DETAIL,
          user: { ...DETAIL.user, id: "u-2", fullName: "Worker Dos", email: "trashed@test.local" },
          status: { ...DETAIL.status, accountStatus: "trashed", rawStatus: "trashed", purgeAfter: "2026-10-01T00:00:00.000Z" },
          flags: { isSelf: false, canReactivate: false, canRestore: true },
          permanentDeleteEnabled: false,
        })
      }
      return jsonResponse(USER_PAGE)
    })

    render(<AdminUsersScreen initialPage={USER_PAGE} initialError={false} />)

    fireEvent.click(screen.getAllByRole("button", { name: /Acciones para Worker Dos/i })[0])
    fireEvent.click(screen.getByRole("menuitem", { name: "Ver ficha" }))

    await waitFor(() => {
      const purgeButton = screen.getByRole("button", { name: "Eliminar definitivamente" }) as HTMLButtonElement
      expect(purgeButton.disabled).toBe(true)
    })
    expect(screen.getByText(/eliminación definitiva está deshabilitada en el servidor/i)).toBeTruthy()
  })
})

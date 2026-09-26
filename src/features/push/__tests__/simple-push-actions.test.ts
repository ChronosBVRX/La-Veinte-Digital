import { describe, it, expect, vi, beforeEach } from "vitest"
import { DEFAULT_PUSH_TITLES, type EnviarNotificacionInput } from "../actions/push-actions"

// Mock server-only dependencies
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const mockGetAdminCapabilities = vi.fn()
vi.mock("@/shared/server/admin/admin-capabilities", () => ({
  getAdminCapabilities: () => mockGetAdminCapabilities(),
}))

const mockSendBroadcast = vi.fn()
const mockSendToUser = vi.fn()
const mockSendToUsers = vi.fn()
vi.mock("@/features/push/services/push-admin", () => ({
  sendBroadcast: (payload: unknown) => mockSendBroadcast(payload),
  sendToUser: (id: string, payload: unknown) => mockSendToUser(id, payload),
  sendToUsers: (ids: string[], payload: unknown) => mockSendToUsers(ids, payload),
  sanitizeDestination: (dest?: string | null) => (dest ? dest.trim() : undefined),
}))

// Import after mocks
const { enviarNotificacion } = await import("../actions/push-actions")

describe("enviarNotificacion action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendBroadcast.mockResolvedValue({ sent: 5, failed: 0, invalidTokens: 0 })
  })

  it("has default titles configured for all valid categories", () => {
    expect(DEFAULT_PUSH_TITLES.GENERAL).toBe("Aviso General")
    expect(DEFAULT_PUSH_TITLES.IMPORTANT_ALERT).toBe("Alerta Importante")
    expect(DEFAULT_PUSH_TITLES.AGENDA).toBe("Convocatoria y Agenda")
    expect(DEFAULT_PUSH_TITLES.DOCUMENT).toBe("Documento IMSS")
    expect(DEFAULT_PUSH_TITLES.UPDATE).toBe("Actualización del Sistema")
  })

  it("denies access when user is not admin and has no legacy push capability", async () => {
    mockGetAdminCapabilities.mockResolvedValue({
      user: { id: "u-1", email: "worker@laveinte.mx" },
      capabilities: { isAdmin: false, canAccessLegacyPush: false },
    })

    const result = await enviarNotificacion({
      message: "Hola a todos",
      category: "GENERAL",
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain("No autorizado")
    expect(mockSendBroadcast).not.toHaveBeenCalled()
  })

  it("allows access when user has isAdmin capability", async () => {
    mockGetAdminCapabilities.mockResolvedValue({
      user: { id: "admin-1", email: "admin@laveinte.mx" },
      capabilities: { isAdmin: true, canAccessLegacyPush: false },
    })

    const result = await enviarNotificacion({
      message: "Mensaje institucional urgente",
      category: "IMPORTANT_ALERT",
    })

    expect(result.ok).toBe(true)
    expect(result.sent).toBe(5)
    expect(mockSendBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "IMPORTANT_ALERT",
        title: "Alerta Importante",
        body: "Mensaje institucional urgente",
      })
    )
  })

  it("uses custom title when provided", async () => {
    mockGetAdminCapabilities.mockResolvedValue({
      user: { id: "admin-1", email: "admin@laveinte.mx" },
      capabilities: { isAdmin: true, canAccessLegacyPush: false },
    })

    const result = await enviarNotificacion({
      title: "Título Personalizado",
      message: "Texto del mensaje",
      category: "GENERAL",
    })

    expect(result.ok).toBe(true)
    expect(mockSendBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Título Personalizado",
        body: "Texto del mensaje",
      })
    )
  })

  it("rejects when message is empty", async () => {
    mockGetAdminCapabilities.mockResolvedValue({
      user: { id: "admin-1", email: "admin@laveinte.mx" },
      capabilities: { isAdmin: true, canAccessLegacyPush: false },
    })

    const result = await enviarNotificacion({
      message: "   ",
      category: "GENERAL",
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe("El mensaje es obligatorio")
    expect(mockSendBroadcast).not.toHaveBeenCalled()
  })

  it("allows access when user is a legacy push operator without admin role", async () => {
    mockGetAdminCapabilities.mockResolvedValue({
      user: { id: "op-1", email: "operator@laveinte.mx" },
      capabilities: { isAdmin: false, canAccessLegacyPush: true },
    })

    const result = await enviarNotificacion({
      message: "Aviso de delegación",
      category: "AGENDA",
    })

    expect(result.ok).toBe(true)
    expect(mockSendBroadcast).toHaveBeenCalled()
  })
})

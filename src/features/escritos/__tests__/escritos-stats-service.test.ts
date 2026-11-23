import { describe, it, expect, vi, beforeEach } from "vitest"
import { getEscritosStats, recordEscritoGeneration } from "../server/escritos-stats-service"

describe("escritos-stats-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getEscritosStats devuelve los datos agregados desde el RPC", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { total_generados: 15, total_companeros: 8 },
      error: null,
    })

    const mockClient = {
      rpc: mockRpc,
    } as unknown as Parameters<typeof getEscritosStats>[0]

    const stats = await getEscritosStats(mockClient)
    expect(stats.totalGenerados).toBe(15)
    expect(stats.totalCompaneros).toBe(8)
    expect(mockRpc).toHaveBeenCalledWith("get_escritos_stats")
  })

  it("getEscritosStats devuelve fallback seguro 0 si ocurre un error", async () => {
    const mockRpc = vi.fn().mockRejectedValue(new Error("Network fail"))

    const mockClient = {
      rpc: mockRpc,
    } as unknown as Parameters<typeof getEscritosStats>[0]

    const stats = await getEscritosStats(mockClient)
    expect(stats.totalGenerados).toBe(0)
    expect(stats.totalCompaneros).toBe(0)
  })

  it("recordEscritoGeneration registra evento atómico y devuelve estadísticas actualizadas", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { success: true, id: 10, total_generados: 16, total_companeros: 9 },
      error: null,
    })

    const mockClient = {
      rpc: mockRpc,
    } as unknown as Parameters<typeof recordEscritoGeneration>[1]

    const result = await recordEscritoGeneration(
      { userId: "user-123", tipoEscrito: "peticion", modo: "ia" },
      mockClient,
    )

    expect(result.success).toBe(true)
    expect(result.stats.totalGenerados).toBe(16)
    expect(result.stats.totalCompaneros).toBe(9)
    expect(mockRpc).toHaveBeenCalledWith("log_escrito_generation", {
      p_tipo_escrito: "peticion",
      p_modo: "ia",
      p_user_id: "user-123",
    })
  })
})

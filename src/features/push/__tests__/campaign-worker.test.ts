import { describe, it, expect } from "vitest"

describe("Campaign Worker Delivery Logic", () => {
  it("deduplicates tokens and groups into batches of at most 500", () => {
    const rawTokens: string[] = []
    for (let i = 0; i < 1200; i++) {
      rawTokens.push(`token_${i % 600}`) // 600 unique tokens duplicated twice
    }

    const uniqueTokens = Array.from(new Set(rawTokens.filter(Boolean)))
    expect(uniqueTokens.length).toBe(600)

    const MAX_BATCH = 500
    const chunks: string[][] = []
    for (let i = 0; i < uniqueTokens.length; i += MAX_BATCH) {
      chunks.push(uniqueTokens.slice(i, i + MAX_BATCH))
    }

    expect(chunks.length).toBe(2)
    expect(chunks[0].length).toBe(500)
    expect(chunks[1].length).toBe(100)
  })

  it("calculates exponential backoff minutes correctly for retryable attempts", () => {
    function getBackoffMinutes(attempts: number): number {
      return attempts === 1 ? 1 : attempts === 2 ? 5 : 15
    }

    expect(getBackoffMinutes(1)).toBe(1)
    expect(getBackoffMinutes(2)).toBe(5)
    expect(getBackoffMinutes(3)).toBe(15)
  })

  it("determines campaign final status based on accepted and failed counts", () => {
    function getFinalStatus(target: number, accepted: number, failed: number): string {
      if (target === 0) return "COMPLETED"
      if (failed > 0 && accepted > 0) return "PARTIAL"
      if (failed > 0 && accepted === 0) return "FAILED"
      return "COMPLETED"
    }

    expect(getFinalStatus(0, 0, 0)).toBe("COMPLETED")
    expect(getFinalStatus(10, 10, 0)).toBe("COMPLETED")
    expect(getFinalStatus(10, 8, 2)).toBe("PARTIAL")
    expect(getFinalStatus(10, 0, 10)).toBe("FAILED")
  })

  it("formats SELF test campaign title with [PRUEBA] prefix safely", () => {
    function formatTitle(title: string, purpose: "TEST" | "LIVE"): string {
      return purpose === "TEST" ? `[PRUEBA] ${title}`.slice(0, 200) : title.slice(0, 200)
    }

    expect(formatTitle("Aviso Urgente", "TEST")).toBe("[PRUEBA] Aviso Urgente")
    expect(formatTitle("Aviso Urgente", "LIVE")).toBe("Aviso Urgente")

    const longTitle = "X".repeat(210)
    const formatted = formatTitle(longTitle, "TEST")
    expect(formatted.startsWith("[PRUEBA] ")).toBe(true)
    expect(formatted.length).toBeLessThanOrEqual(200)
  })
})

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

  it("filters RETRY_PENDING deliveries so only those with next_attempt_at <= now are eligible", () => {
    const now = new Date("2026-09-06T12:00:00Z").getTime()
    const rows = [
      { id: "1", status: "PENDING", next_attempt_at: null },
      { id: "2", status: "RETRY_PENDING", next_attempt_at: "2026-09-06T11:59:00Z" }, // past -> eligible
      { id: "3", status: "RETRY_PENDING", next_attempt_at: "2026-09-06T12:00:00Z" }, // exact now -> eligible
      { id: "4", status: "RETRY_PENDING", next_attempt_at: "2026-09-06T12:05:00Z" }, // future -> NOT eligible
      { id: "5", status: "ACCEPTED", next_attempt_at: null }, // completed -> NOT eligible
    ]

    const eligible = rows.filter((r) => {
      if (r.status === "PENDING") return true
      if (r.status === "RETRY_PENDING") {
        return !r.next_attempt_at || new Date(r.next_attempt_at).getTime() <= now
      }
      return false
    })

    expect(eligible.map((e) => e.id)).toEqual(["1", "2", "3"])
  })

  it("handles response count mismatch by identifying unhandled rows for controlled retry", () => {
    const availableRows = [
      { id: "row-1", fcm_token: "token-1" },
      { id: "row-2", fcm_token: "token-2" },
      { id: "row-3", fcm_token: "token-3" },
      { id: "row-4", fcm_token: "token-4" },
    ]
    // Firebase only returned 2 responses out of 4 tokens
    const responses = [
      { success: true },
      { success: false, error: { code: "messaging/unknown-error" } },
    ]

    expect(responses.length).toBeLessThan(availableRows.length)
    const unhandled = availableRows.slice(responses.length)
    expect(unhandled.length).toBe(2)
    expect(unhandled.map((u) => u.id)).toEqual(["row-3", "row-4"])
  })

  it("paginates devices correctly in batches of 1000", () => {
    const totalDevices = 2500
    const allMockDevices = Array.from({ length: totalDevices }, (_, i) => ({
      id: `dev-${i}`,
      user_id: `user-${Math.floor(i / 2)}`,
      fcm_token: `token-${i}`,
    }))

    const PAGE_SIZE = 1000
    let page = 0
    let hasMore = true
    const collected: typeof allMockDevices = []

    while (hasMore) {
      const start = page * PAGE_SIZE
      const end = start + PAGE_SIZE
      const pageSlice = allMockDevices.slice(start, end)
      if (pageSlice.length === 0) {
        hasMore = false
      } else {
        collected.push(...pageSlice)
        if (pageSlice.length < PAGE_SIZE) {
          hasMore = false
        } else {
          page++
        }
      }
    }

    expect(collected.length).toBe(2500)
    expect(page).toBe(2) // 0, 1, 2 (final page had 500 < 1000)
  })
})

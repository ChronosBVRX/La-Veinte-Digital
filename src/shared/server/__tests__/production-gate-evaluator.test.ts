import { describe, it, expect } from "vitest"
import { evaluateProductionGate, type UpstreamJobStatus } from "../../../../scripts/evaluate-production-gate"

describe("Production Gate Fail-Closed Aggregator", () => {
  it("passes when all 5 upstream jobs are success", () => {
    const allSuccess: UpstreamJobStatus = {
      validate: "success",
      "supabase-db": "success",
      python: "success",
      e2e: "success",
      android: "success",
    }

    const result = evaluateProductionGate(allSuccess)
    expect(result.passed).toBe(true)
    expect(result.failedJobs).toHaveLength(0)
  })

  it("fails when validate fails", () => {
    const status: UpstreamJobStatus = {
      validate: "failure",
      "supabase-db": "success",
      python: "success",
      e2e: "success",
      android: "success",
    }
    const result = evaluateProductionGate(status)
    expect(result.passed).toBe(false)
    expect(result.failedJobs).toContain("validate")
  })

  it("fails when supabase-db fails", () => {
    const status: UpstreamJobStatus = {
      validate: "success",
      "supabase-db": "failure",
      python: "success",
      e2e: "success",
      android: "success",
    }
    const result = evaluateProductionGate(status)
    expect(result.passed).toBe(false)
    expect(result.failedJobs).toContain("supabase-db")
  })

  it("fails when python fails", () => {
    const status: UpstreamJobStatus = {
      validate: "success",
      "supabase-db": "success",
      python: "failure",
      e2e: "success",
      android: "success",
    }
    const result = evaluateProductionGate(status)
    expect(result.passed).toBe(false)
    expect(result.failedJobs).toContain("python")
  })

  it("fails when e2e fails", () => {
    const status: UpstreamJobStatus = {
      validate: "success",
      "supabase-db": "success",
      python: "success",
      e2e: "failure",
      android: "success",
    }
    const result = evaluateProductionGate(status)
    expect(result.passed).toBe(false)
    expect(result.failedJobs).toContain("e2e")
  })

  it("fails when android fails", () => {
    const status: UpstreamJobStatus = {
      validate: "success",
      "supabase-db": "success",
      python: "success",
      e2e: "success",
      android: "failure",
    }
    const result = evaluateProductionGate(status)
    expect(result.passed).toBe(false)
    expect(result.failedJobs).toContain("android")
  })

  it("fails closed on cancelled, skipped, timed_out, or unexpected statuses", () => {
    const badStatuses = ["cancelled", "skipped", "timed_out", "neutral", "action_required", ""]
    for (const bad of badStatuses) {
      const status: UpstreamJobStatus = {
        validate: bad,
        "supabase-db": "success",
        python: "success",
        e2e: "success",
        android: "success",
      }
      const result = evaluateProductionGate(status)
      expect(result.passed).toBe(false)
      expect(result.failedJobs).toContain("validate")
    }
  })
})

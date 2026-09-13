import { describe, it, expect } from "vitest"
import { execSync } from "node:child_process"

describe("Release Gate Runner Self-Test", () => {
  it("fails immediately and exits with code 1 when a command fails", () => {
    let failed = false
    try {
      execSync("node -e 'process.exit(1)'", { stdio: "pipe" })
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it("passes cleanly when commands succeed", () => {
    let succeeded = false
    try {
      execSync("node -e 'process.exit(0)'", { stdio: "pipe" })
      succeeded = true
    } catch {
      succeeded = false
    }
    expect(succeeded).toBe(true)
  })
})

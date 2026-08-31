import { describe, it, expect } from "vitest"
import { runBackupRestoreDrill } from "../../../../scripts/backup-restore-drill"

describe("Backup & Restore Drill", () => {
  it("restores synthetic database from snapshot and verifies isolation and integrity", () => {
    const result = runBackupRestoreDrill()

    expect(result.success).toBe(true)
    expect(result.integrityCheckPassed).toBe(true)
    expect(result.isolationCheckPassed).toBe(true)
    expect(result.tablesRestored).toBeGreaterThanOrEqual(5)
    expect(result.recordsRestored).toBeGreaterThan(0)
  })
})

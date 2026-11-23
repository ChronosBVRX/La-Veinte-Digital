import { describe, expect, it } from "vitest"
import {
  MAX_FILE_BYTES,
  MAX_SESSION_BYTES,
  formatBytes,
  isAllowedType,
} from "../lib/transfer"

describe("Transfer limits and file type flexibility (experimento temporal 500 MB)", () => {
  it("sets MAX_FILE_BYTES to 500 MB", () => {
    expect(MAX_FILE_BYTES).toBe(500 * 1024 * 1024)
    expect(MAX_FILE_BYTES).toBe(524_288_000)
  })

  it("sets MAX_SESSION_BYTES to at least 500 MB", () => {
    expect(MAX_SESSION_BYTES).toBeGreaterThanOrEqual(500 * 1024 * 1024)
  })

  it("allows any content type without restrictions", () => {
    expect(isAllowedType("application/pdf")).toBe(true)
    expect(isAllowedType("image/jpeg")).toBe(true)
    expect(isAllowedType("image/png")).toBe(true)
    expect(isAllowedType("application/zip")).toBe(true)
    expect(isAllowedType("video/mp4")).toBe(true)
    expect(isAllowedType("application/octet-stream")).toBe(true)
    expect(isAllowedType("text/plain")).toBe(true)
    expect(isAllowedType("application/vnd.ms-excel")).toBe(true)
    expect(isAllowedType("")).toBe(true)
    expect(isAllowedType(undefined)).toBe(true)
    expect(isAllowedType("custom/unknown-format")).toBe(true)
  })

  it("formats 500 MB correctly in formatBytes", () => {
    expect(formatBytes(500 * 1024 * 1024)).toBe("500.0 MB")
  })
})

import { describe, expect, it } from "vitest"
import { authorizePushAdmin } from "../services/push-authorize"

const MOUNT = { adminEmails: "admin@laveinte.mx, root@laveinte.mx", adminKey: "k-123" }

describe("authorizePushAdmin", () => {
  it("denies when admin key is not configured (fail closed)", () => {
    const r = authorizePushAdmin({ userEmail: "admin@laveinte.mx", adminKeyHeader: "k-123", adminEmails: "admin@laveinte.mx", adminKey: undefined })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(503)
  })

  it("denies when admin emails are not configured (fail closed)", () => {
    const r = authorizePushAdmin({ userEmail: "admin@laveinte.mx", adminKeyHeader: "k-123", adminEmails: undefined, adminKey: "k-123" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(503)
  })

  it("denies a non-admin authenticated user", () => {
    const r = authorizePushAdmin({ userEmail: "worker@mail.com", adminKeyHeader: "k-123", ...MOUNT })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(403)
  })

  it("denies admin user with wrong admin key", () => {
    const r = authorizePushAdmin({ userEmail: "admin@laveinte.mx", adminKeyHeader: "k-wrong", ...MOUNT })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(403)
  })

  it("denies an anonymous caller (no email)", () => {
    const r = authorizePushAdmin({ userEmail: null, adminKeyHeader: "k-123", ...MOUNT })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(403)
  })

  it("allows an admin with a valid email and key (case-insensitive email)", () => {
    const r = authorizePushAdmin({ userEmail: "  ADMIN@LAVEINTE.MX ", adminKeyHeader: "k-123", ...MOUNT })
    expect(r.ok).toBe(true)
  })
})

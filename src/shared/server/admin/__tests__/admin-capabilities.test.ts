import { describe, it, expect } from "vitest"
import { evaluateAdminCapabilities } from "../admin-capabilities"

describe("evaluateAdminCapabilities", () => {
  it("denies all capabilities to a normal user", () => {
    const caps = evaluateAdminCapabilities({
      role: "user",
      email: "trabajador@imss.gob.mx",
      legacyAllowedEmails: "admin@laveinte.org",
    })

    expect(caps.isAdmin).toBe(false)
    expect(caps.canAccessAdminPanel).toBe(false)
    expect(caps.canManageAnnouncements).toBe(false)
    expect(caps.canManageCampaigns).toBe(false)
    expect(caps.canAccessLegacyPush).toBe(false)
    expect(caps.canAccessAndroidAdmin).toBe(false)
    expect(caps.canAccessVacationsAdmin).toBe(false)
  })

  it("grants full capabilities to a profile with role admin", () => {
    const caps = evaluateAdminCapabilities({
      role: "admin",
      email: "director@imss.gob.mx",
      legacyAllowedEmails: "admin@laveinte.org",
    })

    expect(caps.isAdmin).toBe(true)
    expect(caps.canAccessAdminPanel).toBe(true)
    expect(caps.canManageAnnouncements).toBe(true)
    expect(caps.canManageCampaigns).toBe(true)
    expect(caps.canAccessAndroidAdmin).toBe(true)
    expect(caps.canAccessVacationsAdmin).toBe(true)
    // Legacy push is false unless his email is also in the allowed list
    expect(caps.canAccessLegacyPush).toBe(false)
  })

  it("grants legacy push and minimal panel access to legacy email without role admin", () => {
    const caps = evaluateAdminCapabilities({
      role: "user",
      email: "push_operator@laveinte.org",
      legacyAllowedEmails: "push_operator@laveinte.org,other@test.com",
    })

    expect(caps.isAdmin).toBe(false)
    expect(caps.canAccessAdminPanel).toBe(true) // allowed to traverse layout to reach /admin/push
    expect(caps.canAccessLegacyPush).toBe(true)
    // All other administrative sections are strictly denied
    expect(caps.canManageAnnouncements).toBe(false)
    expect(caps.canManageCampaigns).toBe(false)
    expect(caps.canAccessAndroidAdmin).toBe(false)
    expect(caps.canAccessVacationsAdmin).toBe(false)
  })

  it("handles null and empty inputs safely", () => {
    const caps = evaluateAdminCapabilities({
      role: null,
      email: null,
      legacyAllowedEmails: null,
    })

    expect(caps.isAdmin).toBe(false)
    expect(caps.canAccessAdminPanel).toBe(false)
    expect(caps.canManageAnnouncements).toBe(false)
    expect(caps.canManageCampaigns).toBe(false)
    expect(caps.canAccessLegacyPush).toBe(false)
  })
})

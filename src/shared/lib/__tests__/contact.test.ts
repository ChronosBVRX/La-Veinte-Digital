import { describe, it, expect } from "vitest"
import {
  COMPANY_NAME,
  OWNER_NAME,
  OWNER_ROLE,
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
  CONTACT_MAILTO,
} from "../contact"

describe("contact configuration", () => {
  it("defines Chronos System S.A.S as company and owner entity", () => {
    expect(COMPANY_NAME).toBe("Chronos System S.A.S")
    expect(OWNER_NAME).toBe("Chronos System S.A.S")
    expect(OWNER_ROLE).not.toContain("Eduardo")
    expect(OWNER_ROLE).not.toContain("Bolaños")
    expect(OWNER_ROLE).not.toContain("Técnico Radiólogo")
  })

  it("preserves official contact email and phone", () => {
    expect(CONTACT_EMAIL).toBe("noirsysan@gmail.com")
    expect(CONTACT_PHONE_DISPLAY).toBe("443 366 7106")
    expect(CONTACT_PHONE_HREF).toBe("tel:+524433667106")
    expect(CONTACT_MAILTO).toBe("mailto:noirsysan@gmail.com")
  })
})

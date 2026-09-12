import { describe, it, expect } from "vitest"
import { evaluateAuditOutput } from "../../../../scripts/audit-production-dependencies"

describe("evaluateAuditOutput — Fail-Closed Dependency Security Auditor", () => {
  it("passes when only approved mitigated vulnerabilities are present", () => {
    const mockJson = {
      vulnerabilities: {
        next: {
          name: "next",
          severity: "critical",
          via: [
            {
              url: "https://github.com/advisories/GHSA-p293-qw3h-jr36",
              title: "Next.js Windows RCE",
              severity: "critical",
            },
            {
              url: "https://github.com/advisories/GHSA-2xp9-vwfh-vxw4",
              title: "Next.js AVIF RCE",
              severity: "critical",
            },
          ],
        },
      },
    }

    const result = evaluateAuditOutput(mockJson)
    expect(result.passed).toBe(true)
    expect(result.unmitigatedVulnerabilities).toHaveLength(0)
    expect(result.mitigatedVulnerabilities).toHaveLength(2)
  })

  it("fails closed when a new unmitigated high severity vulnerability appears", () => {
    const mockJson = {
      vulnerabilities: {
        "malicious-lib": {
          name: "malicious-lib",
          severity: "high",
          via: [
            {
              url: "https://github.com/advisories/GHSA-9999-xxxx-yyyy",
              title: "Remote Code Execution in malicious-lib",
              severity: "high",
            },
          ],
        },
      },
    }

    const result = evaluateAuditOutput(mockJson)
    expect(result.passed).toBe(false)
    expect(result.unmitigatedVulnerabilities).toHaveLength(1)
    expect(result.unmitigatedVulnerabilities[0]?.name).toBe("malicious-lib")
    expect(result.unmitigatedVulnerabilities[0]?.severity).toBe("high")
  })

  it("fails closed when a critical vulnerability appears with unknown advisory", () => {
    const mockJson = {
      vulnerabilities: {
        next: {
          name: "next",
          severity: "critical",
          via: [
            {
              url: "https://github.com/advisories/GHSA-unapproved-advisory",
              title: "New Next.js 0-day",
              severity: "critical",
            },
          ],
        },
      },
    }

    const result = evaluateAuditOutput(mockJson)
    expect(result.passed).toBe(false)
    expect(result.unmitigatedVulnerabilities).toHaveLength(1)
  })

  it("ignores low and moderate severity dependencies", () => {
    const mockJson = {
      vulnerabilities: {
        dompurify: {
          name: "dompurify",
          severity: "moderate",
          via: [
            {
              url: "https://github.com/advisories/GHSA-55q2-fjhq-7xh7",
              title: "DOMPurify XSS",
              severity: "moderate",
            },
          ],
        },
      },
    }

    const result = evaluateAuditOutput(mockJson)
    expect(result.passed).toBe(true)
    expect(result.unmitigatedVulnerabilities).toHaveLength(0)
  })
})

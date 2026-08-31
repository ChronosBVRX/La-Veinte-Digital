import { describe, it, expect, beforeEach } from "vitest"
import {
  captureException,
  captureMessage,
  sanitizeContext,
  sanitizeValue,
  setRelease,
  setObservabilityTransport,
  type ObservabilityEvent,
} from "../index"

describe("Observability & Telemetry Hardening", () => {
  const dispatchedEvents: ObservabilityEvent[] = []

  beforeEach(() => {
    dispatchedEvents.length = 0
    setRelease("1.0.0-test")
    setObservabilityTransport({
      send(event) {
        dispatchedEvents.push(event)
      },
    })
  })

  it("redacts sensitive keys (password, token, cookie, curp, rfc, nss, tarjeton)", () => {
    const rawContext = {
      user_id: "user-123",
      password: "SuperSecretPassword123!",
      authToken: "bearer 12345abcdef",
      cookie: "sb-auth-token=xyz",
      curp: "ROSA900101HMCRR01",
      rfc: "ROSA9001019A1",
      nss: "12345678901",
      matricula: "99887766",
      safeKey: "safe-data",
    }

    const sanitized = sanitizeContext(rawContext)

    expect(sanitized.user_id).toBe("user-123")
    expect(sanitized.safeKey).toBe("safe-data")
    expect(sanitized.password).toBe("[REDACTED]")
    expect(sanitized.authToken).toBe("[REDACTED]")
    expect(sanitized.cookie).toBe("[REDACTED]")
    expect(sanitized.curp).toBe("[REDACTED]")
    expect(sanitized.rfc).toBe("[REDACTED]")
    expect(sanitized.nss).toBe("[REDACTED]")
    expect(sanitized.matricula).toBe("[REDACTED]")
  })

  it("redacts sensitive patterns in string values", () => {
    const input = "User token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThis"
    const sanitized = sanitizeValue(input) as string
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
    expect(sanitized).toContain("[REDACTED]")
  })

  it("captures exceptions with release and environment info", () => {
    const error = new Error("Database connection timeout")
    captureException(error, { endpoint: "/api/consulta" })

    expect(dispatchedEvents).toHaveLength(1)
    const event = dispatchedEvents[0]

    expect(event.level).toBe("error")
    expect(event.message).toBe("Database connection timeout")
    expect(event.errorName).toBe("Error")
    expect(event.release).toBe("1.0.0-test")
    expect(event.context.endpoint).toBe("/api/consulta")
  })

  it("captures messages with appropriate severity level", () => {
    captureMessage("Worker profile updated successfully", "info", {
      profileType: "enfermeria",
      hasRecurrents: true,
    })

    expect(dispatchedEvents).toHaveLength(1)
    const event = dispatchedEvents[0]

    expect(event.level).toBe("info")
    expect(event.message).toBe("Worker profile updated successfully")
    expect(event.context.profileType).toBe("enfermeria")
    expect(event.context.hasRecurrents).toBe(true)
  })

  it("safely handles non-error objects and primitives passed as errors", () => {
    captureException("String error message", { detail: "test" })
    captureException({ custom: "error object" }, { detail: "test" })

    expect(dispatchedEvents).toHaveLength(2)
    expect(dispatchedEvents[0].message).toBe("String error message")
    expect(dispatchedEvents[1].errorName).toBe("object")
  })
})

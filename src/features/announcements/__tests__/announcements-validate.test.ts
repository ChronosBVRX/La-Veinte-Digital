import { describe, it, expect } from "vitest"
import { validateAnnouncementInput, MAX_TITLE_LENGTH, MAX_BODY_LENGTH, MAX_BAR_TEXT_LENGTH, MAX_PUSH_SUMMARY_LENGTH } from "../services/announcements-validate"

describe("validateAnnouncementInput", () => {
  const validPayload = {
    title: "Convocatoria Vacacional 2027",
    body: "Se abre el periodo de registro para la programación de vacaciones del siguiente ciclo.",
    show_in_inbox: true,
    show_in_bar: true,
    bar_text: "Convocatoria Vacacional 2027 abierta",
    push_summary: "Ya puedes programar tus vacaciones 2027.",
    destination_path: "/vacaciones",
  }

  it("accepts valid input with all surfaces", () => {
    const res = validateAnnouncementInput(validPayload)
    expect(res.ok).toBe(true)
    expect(res.value?.title).toBe(validPayload.title)
    expect(res.value?.show_in_inbox).toBe(true)
    expect(res.value?.show_in_bar).toBe(true)
  })

  it("rejects empty title", () => {
    const res = validateAnnouncementInput({ ...validPayload, title: "" })
    expect(res.ok).toBe(false)
    expect(res.errors).toContain("El título es obligatorio.")
  })

  it("rejects title exceeding max length", () => {
    const longTitle = "A".repeat(MAX_TITLE_LENGTH + 1)
    const res = validateAnnouncementInput({ ...validPayload, title: longTitle })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("El título no puede superar"))).toBe(true)
  })

  it("rejects empty body", () => {
    const res = validateAnnouncementInput({ ...validPayload, body: "   " })
    expect(res.ok).toBe(false)
    expect(res.errors).toContain("El contenido del aviso es obligatorio.")
  })

  it("rejects body exceeding max length", () => {
    const longBody = "B".repeat(MAX_BODY_LENGTH + 1)
    const res = validateAnnouncementInput({ ...validPayload, body: longBody })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("El contenido no puede superar"))).toBe(true)
  })

  it("rejects if neither inbox nor bar is selected", () => {
    const res = validateAnnouncementInput({
      ...validPayload,
      show_in_inbox: false,
      show_in_bar: false,
    })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("al menos una superficie visible"))).toBe(true)
  })

  it("rejects push summary exceeding max length", () => {
    const longSummary = "S".repeat(MAX_PUSH_SUMMARY_LENGTH + 1)
    const res = validateAnnouncementInput({ ...validPayload, push_summary: longSummary })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("El resumen para push no puede superar"))).toBe(true)
  })

  it("rejects bar text exceeding max length", () => {
    const longBar = "T".repeat(MAX_BAR_TEXT_LENGTH + 1)
    const res = validateAnnouncementInput({ ...validPayload, bar_text: longBar })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("El texto para la barra no puede superar"))).toBe(true)
  })

  it("rejects when expires_at is before or equal to publish_at", () => {
    const res = validateAnnouncementInput({
      ...validPayload,
      publish_at: "2026-10-01T10:00:00Z",
      expires_at: "2026-10-01T09:00:00Z",
    })
    expect(res.ok).toBe(false)
    expect(res.errors?.some((e) => e.includes("posterior a la fecha de publicación"))).toBe(true)
  })

  it("accepts valid future dates where expires_at > publish_at", () => {
    const res = validateAnnouncementInput({
      ...validPayload,
      publish_at: "2026-10-01T10:00:00Z",
      expires_at: "2026-10-15T10:00:00Z",
    })
    expect(res.ok).toBe(true)
    expect(res.value?.publish_at).toBe("2026-10-01T10:00:00.000Z")
    expect(res.value?.expires_at).toBe("2026-10-15T10:00:00.000Z")
  })
})

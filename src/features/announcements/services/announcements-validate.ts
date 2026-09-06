import type { AnnouncementInput } from "@/shared/contracts/announcements"

export interface ValidationResult<T> {
  ok: boolean
  errors?: string[]
  value?: T
}

export const MAX_TITLE_LENGTH = 100
export const MAX_PUSH_SUMMARY_LENGTH = 200
export const MAX_BAR_TEXT_LENGTH = 120
export const MAX_BODY_LENGTH = 5000
export const MAX_DESTINATION_LENGTH = 2048

/**
 * Validador puro para creación y edición de avisos.
 * Exige:
 * - Título (1..100)
 * - Cuerpo (1..5000)
 * - Al menos una superficie visible (bandeja o barra)
 * - Si show_in_bar es true, bar_text opcional o se deriva de título/resumen, pero si se provee <= 120
 * - Si show_in_inbox es true con push, push_summary <= 200
 * - Fechas válidas: expires_at > publish_at si ambas están presentes
 */
export function validateAnnouncementInput(input: unknown): ValidationResult<AnnouncementInput> {
  const errors: string[] = []

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["Datos inválidos"] }
  }

  const data = input as Record<string, unknown>

  const title = typeof data.title === "string" ? data.title.trim() : ""
  if (!title) {
    errors.push("El título es obligatorio.")
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`El título no puede superar ${MAX_TITLE_LENGTH} caracteres (actual: ${title.length}).`)
  }

  const body = typeof data.body === "string" ? data.body.trim() : ""
  if (!body) {
    errors.push("El contenido del aviso es obligatorio.")
  } else if (body.length > MAX_BODY_LENGTH) {
    errors.push(`El contenido no puede superar ${MAX_BODY_LENGTH} caracteres (actual: ${body.length}).`)
  }

  const kind = data.kind === "tip" || data.kind === "tool" ? data.kind : "announcement"

  const show_in_inbox = Boolean(data.show_in_inbox ?? true)
  const show_in_bar = Boolean(data.show_in_bar ?? false)

  if (!show_in_inbox && !show_in_bar) {
    errors.push("Debes seleccionar al menos una superficie visible (Bandeja o Barra informativa).")
  }

  let push_summary: string | null = null
  if (data.push_summary != null && String(data.push_summary).trim() !== "") {
    const s = String(data.push_summary).trim()
    if (s.length > MAX_PUSH_SUMMARY_LENGTH) {
      errors.push(`El resumen para push no puede superar ${MAX_PUSH_SUMMARY_LENGTH} caracteres.`)
    } else {
      push_summary = s
    }
  }

  let bar_text: string | null = null
  if (data.bar_text != null && String(data.bar_text).trim() !== "") {
    const b = String(data.bar_text).trim()
    if (b.length > MAX_BAR_TEXT_LENGTH) {
      errors.push(`El texto para la barra no puede superar ${MAX_BAR_TEXT_LENGTH} caracteres.`)
    } else {
      bar_text = b
    }
  }

  let destination_path: string | null = null
  if (data.destination_path != null && String(data.destination_path).trim() !== "") {
    const d = String(data.destination_path).trim()
    if (d.length > MAX_DESTINATION_LENGTH) {
      errors.push(`El destino no puede superar ${MAX_DESTINATION_LENGTH} caracteres.`)
    } else {
      destination_path = d
    }
  }

  let publish_at: string | null = null
  if (data.publish_at != null && String(data.publish_at).trim() !== "") {
    const p = String(data.publish_at).trim()
    const pDate = new Date(p)
    if (isNaN(pDate.getTime())) {
      errors.push("Fecha de publicación inválida.")
    } else {
      publish_at = pDate.toISOString()
    }
  }

  let expires_at: string | null = null
  if (data.expires_at != null && String(data.expires_at).trim() !== "") {
    const e = String(data.expires_at).trim()
    const eDate = new Date(e)
    if (isNaN(eDate.getTime())) {
      errors.push("Fecha de vencimiento inválida.")
    } else {
      expires_at = eDate.toISOString()
    }
  }

  if (publish_at && expires_at) {
    if (new Date(expires_at).getTime() <= new Date(publish_at).getTime()) {
      errors.push("La fecha de vencimiento debe ser posterior a la fecha de publicación.")
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      kind,
      title,
      push_summary,
      body,
      bar_text,
      destination_path,
      show_in_inbox,
      show_in_bar,
      publish_at,
      expires_at,
      source_document: data.source_document ? String(data.source_document).trim() : null,
      source_reference: data.source_reference ? String(data.source_reference).trim() : null,
      source_version: data.source_version ? String(data.source_version).trim() : null,
      source_page: data.source_page ? String(data.source_page).trim() : null,
    },
  }
}

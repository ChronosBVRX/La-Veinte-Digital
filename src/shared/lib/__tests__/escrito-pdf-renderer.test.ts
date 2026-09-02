import { describe, it, expect } from "vitest"
import { buildJsPdfDocument } from "../escrito-pdf-renderer"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("escrito-pdf-renderer Carta formatting", () => {
  it("renders short and long documents with 612x792 pt letter format", async () => {
    const shortDraft: EscritoDraftV2 = {
      id: "esc_short_1",
      titulo: "Solicitud Corta",
      asunto: "Permiso",
      ciudad: "Ciudad de México",
      fecha: "02 de septiembre de 2026",
      destino: { cargo: "DIRECTOR DE LA UNIDAD", nombre: "DR. JUAN PÉREZ" },
      cuerpo: "Por medio de la presente solicito el día económico correspondiente al CCT.",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const docShort = await buildJsPdfDocument(shortDraft)
    expect(docShort.internal.pageSize.getWidth()).toBe(612)
    expect(docShort.internal.pageSize.getHeight()).toBe(792)
    expect(docShort.getNumberOfPages()).toBe(1)

    // Documento largo (múltiples páginas, verificación de saltos y justificación)
    const longBody = Array(20)
      .fill("Conforme a los derechos estipulados en el Contrato Colectivo de Trabajo vigente entre el Instituto Mexicano del Seguro Social y el Sindicato Nacional de Trabajadores del Seguro Social, solicitamos formalmente la revisión de las guardias asignadas para el periodo correspondiente con apego irrestricto a la normativa laboral.")
      .join("\n\n")

    const longDraft: EscritoDraftV2 = {
      ...shortDraft,
      id: "esc_long_2",
      cuerpo: longBody,
    }

    const docLong = await buildJsPdfDocument(longDraft)
    expect(docLong.internal.pageSize.getWidth()).toBe(612)
    expect(docLong.internal.pageSize.getHeight()).toBe(792)
    expect(docLong.getNumberOfPages()).toBeGreaterThan(1)
  })
})

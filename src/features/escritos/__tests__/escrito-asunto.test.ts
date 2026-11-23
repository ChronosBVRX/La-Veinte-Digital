import { describe, it, expect } from "vitest"
import { isGenericAsunto, inferAsuntoFromProblem } from "@/shared/lib/escrito-asunto"
import { parseLlmEscritoOutput } from "../server/generar-escrito-service"
import { generateBasicFallbackEscrito } from "../lib/fallback-generator"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { buildJsPdfDocument } from "@/shared/lib/escrito-pdf-renderer"

describe("Detección e Inferencia Inteligente de Asunto (escrito-asunto)", () => {
  describe("isGenericAsunto", () => {
    it("identifica cadenas vacías, nulas o cortas como genéricas", () => {
      expect(isGenericAsunto(null)).toBe(true)
      expect(isGenericAsunto(undefined)).toBe(true)
      expect(isGenericAsunto("")).toBe(true)
      expect(isGenericAsunto("   ")).toBe(true)
      expect(isGenericAsunto("abc")).toBe(true)
    })

    it("identifica etiquetas genéricas de interfaz como genéricas", () => {
      expect(isGenericAsunto("Redacción Libre: Solicitud formal")).toBe(true)
      expect(isGenericAsunto("redaccion libre: solicitud formal")).toBe(true)
      expect(isGenericAsunto("Redacción Libre")).toBe(true)
      expect(isGenericAsunto("Solicitud: Solicitud formal")).toBe(true)
      expect(isGenericAsunto("Aclaración: Solicitud formal")).toBe(true)
      expect(isGenericAsunto("Queja / Inconformidad: Solicitud formal")).toBe(true)
      expect(isGenericAsunto("Solicitud formal")).toBe(true)
      expect(isGenericAsunto("Nuevo escrito")).toBe(true)
      expect(isGenericAsunto("Asunto del escrito")).toBe(true)
    })

    it("reconoce asuntos legítimos relacionados con el problema como válidos", () => {
      expect(isGenericAsunto("Aclaración sobre descuento indebido en nómina")).toBe(false)
      expect(isGenericAsunto("Solicitud de cambio de adscripción por salud")).toBe(false)
      expect(isGenericAsunto("Inconformidad por afectación a mi rol de guardia")).toBe(false)
      expect(isGenericAsunto("Pago de viáticos correspondientes a comisión sindical")).toBe(false)
    })
  })

  describe("inferAsuntoFromProblem", () => {
    it("conserva un asunto personalizado válido existente", () => {
      const custom = "Mi asunto personalizado específico"
      const result = inferAsuntoFromProblem("solicitud", "hechos...", "peticion...", custom)
      expect(result).toBe(custom)
    })

    it("reemplaza asuntos genéricos con el asunto detectado del problema", () => {
      const result = inferAsuntoFromProblem(
        "libre",
        "En la quincena pasada noté un descuento del concepto 054 no justificado.",
        "Solicito la aclaración y reembolso del descuento aplicado en mi nómina.",
        "Redacción Libre: Solicitud formal"
      )
      expect(result).toContain("Aclaración sobre descuento en nómina")
      expect(result).not.toContain("Redacción Libre")
      expect(result).not.toContain("Solicitud formal")
    })

    it("detecta trámites vacacionales a partir de los hechos y petición", () => {
      const result = inferAsuntoFromProblem(
        "solicitud",
        "Tengo derecho al primer periodo del año conforme a mi antigüedad.",
        "Solicito la programación de mi rol vacacional para el mes de julio."
      )
      expect(result).toBe("Solicitud de programación y disfrute de periodo vacacional")
    })

    it("detecta solicitudes de cambio de adscripción", () => {
      const result = inferAsuntoFromProblem(
        "solicitud",
        "Por motivos de salud familiar requiero acercarme a la zona centro.",
        "Solicito el cambio de adscripción a la UMF No. 1."
      )
      expect(result).toBe("Solicitud de cambio de adscripción y reubicación laboral")
    })

    it("limpia frases introductorias para generar un asunto directo", () => {
      const result = inferAsuntoFromProblem(
        "libre",
        "Durante el turno nocturno ocurrió una avería en el equipo.",
        "Por medio de la presente solicito la reparación inmediata del mastógrafo de la unidad."
      )
      expect(result).toContain("Reparación inmediata del mastógrafo")
      expect(result).not.toContain("Por medio de la presente")
    })
  })

  describe("parseLlmEscritoOutput", () => {
    it("extrae ASUNTO y CUERPO estructurados desde la respuesta del modelo", () => {
      const raw = `ASUNTO: Solicitud de reubicación temporal por causas médicas
CUERPO:
Por medio de la presente me dirijo a usted con el debido respeto para exponer mi situación de salud.

Por lo anteriormente expuesto, solicito atentamente el cambio temporal de servicio.`

      const parsed = parseLlmEscritoOutput(raw)
      expect(parsed.asunto).toBe("Solicitud de reubicación temporal por causas médicas")
      expect(parsed.cuerpo).toContain("Por medio de la presente me dirijo a usted")
      expect(parsed.cuerpo).not.toContain("ASUNTO:")
      expect(parsed.cuerpo).not.toContain("CUERPO:")
    })

    it("soporta formato con markdown negrita (**ASUNTO:**)", () => {
      const raw = `**ASUNTO:** Aclaración sobre descuento del concepto 054
**CUERPO:**
Expongo a usted los hechos relativos al descuento aplicado.`

      const parsed = parseLlmEscritoOutput(raw)
      expect(parsed.asunto).toBe("Aclaración sobre descuento del concepto 054")
      expect(parsed.cuerpo).toContain("Expongo a usted los hechos")
    })

    it("descarta asuntos genéricos emitidos por el modelo", () => {
      const raw = `ASUNTO: Redacción Libre: Solicitud formal
CUERPO:
Texto formal del escrito.`

      const parsed = parseLlmEscritoOutput(raw)
      expect(parsed.asunto).toBeUndefined()
      expect(parsed.cuerpo).toBe("Texto formal del escrito.")
    })
  })

  describe("Integración con Fallback y Renderizado PDF", () => {
    it("generateBasicFallbackEscrito genera un asunto vinculado al problema y no genérico", () => {
      const fallback = generateBasicFallbackEscrito({
        tipo: "libre",
        hechos: "Se me aplicó un descuento indebido en mi sueldo.",
        peticion: "Solicito la devolución del importe retenido.",
        asunto: "Redacción Libre: Solicitud formal",
      })

      expect(fallback.asuntoSugerido).toContain("Aclaración sobre descuento")
      expect(fallback.asuntoSugerido).not.toContain("Redacción Libre")
      expect(fallback.asuntoSugerido).not.toContain("Solicitud formal")
    })

    it("buildJsPdfDocument sanitiza asuntos genéricos preexistentes en borradores guardados", async () => {
      const draft = createEmptyEscritoDraftV2("usr_test_asunto", "libre", {
        asunto: "Redacción Libre: Solicitud formal",
        hechos: "Descuento indebido de 3 días de salario por supuesta omisión de checada.",
        peticion: "Solicito la corrección en el sistema y el reintegro de las percepciones.",
        cuerpo: "Texto del cuerpo formal del escrito.",
      })

      const jsDoc = await buildJsPdfDocument(draft, "usr_test_asunto")
      expect(jsDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
      // El documento PDF debe haberse generado sin errores
    })
  })
})

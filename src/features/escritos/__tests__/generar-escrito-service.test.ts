import { describe, it, expect } from "vitest"
import {
  generateBasicFallbackEscrito,
  buildEscritoPrompt,
  type GenerarEscritoContext,
} from "../server/generar-escrito-service"
import type { GenerarEscritoRequest } from "@/shared/contracts/escrito-draft"

describe("generar-escrito-service", () => {
  it("generateBasicFallbackEscrito conserva íntegramente los hechos y la petición", () => {
    const req: GenerarEscritoRequest = {
      tipo: "solicitud",
      hechos: "El pasado lunes 10 de agosto en el Hospital General de Zona No. 1, se me asignó una guardia extraordinaria que cubrí en su totalidad.",
      peticion: "Solicito que se tramite el pago correspondiente a dicha jornada extraordinaria.",
      destino: {
        cargo: "Jefe de Personal",
        nombre: "Lic. Roberto Gómez",
      },
      ciudad: "Morelia, Michoacán",
      fecha: "2026-08-31",
      asunto: "Pago de jornada extraordinaria",
    }

    const res = generateBasicFallbackEscrito(req)

    expect(res.generationMode).toBe("basic_fallback")
    expect(res.cuerpo).toContain(req.hechos)
    expect(res.cuerpo).toContain(req.peticion)
    expect(res.cuerpo).not.toContain("No encontré evidencia")
    expect(res.asuntoSugerido).toBe("Pago de jornada extraordinaria")
    expect(res.tituloSugerido).toContain("Solicitud")
    expect(res.fuentes).toEqual([])
  })

  it("buildEscritoPrompt genera instrucciones estrictas de no inventar leyes y no usar markdown", () => {
    const req: GenerarEscritoRequest = {
      tipo: "queja",
      hechos: "Hechos de prueba",
      peticion: "Peticion de prueba",
      destino: { cargo: "Director", nombre: "Dr. Morales" },
      ciudad: "Morelia",
      fecha: "2026-08-31",
    }

    const context: GenerarEscritoContext = {
      evidence: [],
      hasSources: false,
    }

    const prompt = buildEscritoPrompt(req, context)

    expect(prompt).toContain("NO inventes números de artículos")
    expect(prompt).toContain("NO uses markdown")
    expect(prompt).toContain("Hechos expuestos:")
    expect(prompt).toContain("Petición concreta:")
    expect(prompt).not.toContain("[S1]")
  })

  it("si hay fuentes normativas verificadas, el prompt incluye las fuentes e instrucción de citar formalmente", () => {
    const req: GenerarEscritoRequest = {
      tipo: "solicitud",
      hechos: "Hechos con fundamento",
      peticion: "Petición con fundamento",
      destino: { cargo: "Jefe", nombre: "Lic. Ruiz" },
      ciudad: "Morelia",
      fecha: "2026-08-31",
      incluirFundamentos: true,
    }

    const context: GenerarEscritoContext = {
      evidence: [
        {
          id: "cct-63",
          chunkId: "cct_chunk_63",
          documentId: "cct-2025-2027",
          documento: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
          version: "2025-2027",
          tipo: "clausula",
          numero: "Cláusula 63 Bis",
          paginaInicio: 42,
          paginaFin: 43,
          fragmento: "Texto oficial de la cláusula 63 Bis sobre descansos y permisos...",
          sourceUrl: null,
          validity: "CURRENT",
          pendingReview: false,
          score: 180,
        },
      ],
      hasSources: true,
    }

    const prompt = buildEscritoPrompt(req, context)

    expect(prompt).toContain("FUENTES NORMATIVAS VERIFICADAS")
    expect(prompt).toContain("Cláusula 63 Bis")
    expect(prompt).toContain("Contrato Colectivo")
    expect(prompt).toContain("Con fundamento en")
  })
})

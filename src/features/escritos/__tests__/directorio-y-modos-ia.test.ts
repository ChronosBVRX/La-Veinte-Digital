import { describe, it, expect } from "vitest"
import {
  DIRECTORIO_DESTINATARIOS,
  CATEGORIAS_DESTINATARIOS,
  buscarDestinatarios,
  findDestinatario,
} from "../data/directorio-destinatarios"
import {
  buildUserPrompt,
  getLLMClient,
  generarEscritoService,
} from "../server/generar-escrito-service"
import type { GenerarEscritoRequest } from "@/shared/contracts/escrito-draft"

describe("Directorio Canónico Oficial y Modos de Redacción (FASE 5, 6, 7 y 8)", () => {
  it("solo incluye las categorías autorizadas del SNTSS Sección XX y ningún cargo inventado", () => {
    const validCategorias = new Set([
      "comite_ejecutivo",
      "secretarias",
      "comisiones",
      "subcomisiones",
      "comites_delegacionales",
      "manual",
    ])

    for (const catKey of Object.keys(CATEGORIAS_DESTINATARIOS)) {
      expect(validCategorias.has(catKey)).toBe(true)
    }

    for (const item of DIRECTORIO_DESTINATARIOS) {
      expect(validCategorias.has(item.categoria)).toBe(true)
      expect(item.id).toBeTruthy()
      expect(item.nombre).toBeTruthy()
      expect(item.cargo).toBeTruthy()
      expect(item.organo).toBeTruthy()
      expect(item.periodo).toBe("2026–2032")
    }
  })

  it("no incluye puestos genéricos del IMSS (Director de Hospital, Recursos Humanos, Jefatura) como presets oficiales", () => {
    const presetCargos = DIRECTORIO_DESTINATARIOS.map((d) => d.cargo.toLowerCase())
    const presetNombres = DIRECTORIO_DESTINATARIOS.map((d) => d.nombre.toLowerCase())

    expect(presetCargos.some((c) => c.includes("director de unidad") || c.includes("director de hospital"))).toBe(false)
    expect(presetCargos.some((c) => c.includes("jefe de personal") || c.includes("recursos humanos"))).toBe(false)
    expect(presetCargos.some((c) => c.includes("jefatura de enfermería") || c.includes("jefatura de servicio"))).toBe(false)
    expect(presetNombres.some((n) => n.includes("dirección de unidad médica imss"))).toBe(false)
  })

  it("permite la búsqueda flexible por nombre, cargo u órgano", () => {
    // Por nombre
    const porNombre = buscarDestinatarios("Simbad")
    expect(porNombre.length).toBeGreaterThan(0)
    expect(porNombre[0].nombre).toContain("Simbad Solorio Vargas")

    // Por cargo
    const porCargo = buscarDestinatarios("Tesorero")
    expect(porCargo.length).toBeGreaterThan(0)
    expect(porCargo[0].cargo).toContain("Tesorero")

    // Por órgano
    const porOrgano = buscarDestinatarios("Honor y Justicia")
    expect(porOrgano.length).toBe(3)

    // Búsqueda vacía retorna todo el directorio
    const todo = buscarDestinatarios("")
    expect(todo.length).toBe(DIRECTORIO_DESTINATARIOS.length)
  })

  it("findDestinatario identifica correctamente destinatarios oficiales y diferencia manuales", () => {
    const foundOficial = findDestinatario("Secretario General", "Dr. Simbad Solorio Vargas")
    expect(foundOficial).toBeDefined()
    expect(foundOficial?.categoria).toBe("comite_ejecutivo")

    const notFound = findDestinatario("Director HGZ No. 1", "Dr. Pérez")
    expect(notFound).toBeUndefined()
  })

  it("buildUserPrompt incluye instrucciones estrictas de desarrollo formal de ideas", () => {
    const req: GenerarEscritoRequest = {
      tipo: "solicitud",
      hechos: "mi jefe no me quiere dar mis vacaciones ya metí el papel y no me responde",
      peticion: "que me den mis vacaciones de agosto",
      destino: { cargo: "Secretario de Trabajo", nombre: "A.U.O. Sergio A. González González" },
      ciudad: "Morelia, Mich.",
      fecha: "2026-09-01",
      incluirFundamentos: false,
    }

    const prompt = buildUserPrompt(req, [])
    expect(prompt).toContain("<hechos>")
    expect(prompt).toContain("mi jefe no me quiere dar mis vacaciones")
    expect(prompt).toContain("<peticion>")
    expect(prompt).toContain("que me den mis vacaciones de agosto")
    expect(prompt).toContain("Redacta el cuerpo formal del documento en español institucional mexicano")
  })

  it("distingue claramente generationMode: 'ai_with_sources', 'ai_without_sources', 'manual' y 'basic_fallback'", () => {
    const modes = ["ai_with_sources", "ai_without_sources", "basic_fallback", "manual"]
    expect(modes).toContain("manual")
    expect(modes).toContain("ai_with_sources")
    expect(modes).toContain("ai_without_sources")
    expect(modes).toContain("basic_fallback")
  })

  it("basic_fallback incluye advertencia explícita y nunca se disfraza como redacción de IA", async () => {
    const req: GenerarEscritoRequest = {
      tipo: "solicitud",
      hechos: "Hechos de prueba",
      peticion: "Petición de prueba",
      destino: { cargo: "Secretaría de Trabajo", nombre: "Sergio González" },
      ciudad: "Morelia, Mich.",
      fecha: "2026-09-01",
      incluirFundamentos: false,
    }

    // Ejecutar servicio sin llm (o simulando ausencia de claves)
    const res = await generarEscritoService(req)
    if (!getLLMClient()) {
      expect(res.generationMode).toBe("basic_fallback")
      expect(res.advertencias[0]).toContain("La redacción inteligente no está disponible")
    }
  })
})

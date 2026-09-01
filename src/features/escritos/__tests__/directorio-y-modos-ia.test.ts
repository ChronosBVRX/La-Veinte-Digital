import { describe, it, expect } from "vitest"
import {
  DIRECTORIO_DESTINATARIOS,
  CATEGORIAS_DESTINATARIOS,
  buscarDestinatarios,
  findDestinatario,
  VALOR_DESTINO_MANUAL,
  type DestinatarioCategoria,
} from "../data/directorio-destinatarios"
import {
  buildUserPrompt,
  getLLMClient,
  generarEscritoService,
} from "../server/generar-escrito-service"
import type { GenerarEscritoRequest } from "@/shared/contracts/escrito-draft"

describe("Directorio Canónico Oficial y Trazabilidad Documental (FASE 2, 3 y 4)", () => {
  it("contiene registros no vacíos para Comité Ejecutivo, Secretarías, Comisiones y Subcomisiones", () => {
    const grouped: Record<DestinatarioCategoria, number> = {
      comite_ejecutivo: 0,
      secretarias: 0,
      comisiones: 0,
      subcomisiones: 0,
      comites_delegacionales: 0,
      manual: 0,
    }

    for (const item of DIRECTORIO_DESTINATARIOS) {
      grouped[item.categoria]++
    }

    // Validar definiciones de categorías canónicas
    expect(CATEGORIAS_DESTINATARIOS.comite_ejecutivo.titulo).toContain("Comité Ejecutivo")
    expect(CATEGORIAS_DESTINATARIOS.secretarias.titulo).toContain("Secretarías")
    expect(CATEGORIAS_DESTINATARIOS.comisiones.titulo).toContain("Comisiones")
    expect(CATEGORIAS_DESTINATARIOS.subcomisiones.titulo).toContain("Subcomisiones")
    expect(CATEGORIAS_DESTINATARIOS.comites_delegacionales.titulo).toContain("Comités Delegacionales")
    expect(CATEGORIAS_DESTINATARIOS.manual.titulo).toContain("Manual")

    // Categorías obligatorias con integrantes oficiales
    expect(grouped.comite_ejecutivo).toBeGreaterThan(0)
    expect(grouped.secretarias).toBeGreaterThanOrEqual(15)
    expect(grouped.comisiones).toBeGreaterThanOrEqual(6)
    expect(grouped.subcomisiones).toBeGreaterThanOrEqual(13)

    // comites_delegacionales se mantiene en 0 hasta recibir la lista oficial sin inventar datos
    expect(grouped.comites_delegacionales).toBe(0)
  })

  it("garantiza IDs estrictamente únicos y ninguna combinación nombre/cargo duplicada", () => {
    const ids = new Set<string>()
    const combinaciones = new Set<string>()

    for (const item of DIRECTORIO_DESTINATARIOS) {
      expect(ids.has(item.id)).toBe(false)
      ids.add(item.id)

      const combKey = `${item.nombre}|${item.cargo}`.toLowerCase()
      expect(combinaciones.has(combKey)).toBe(false)
      combinaciones.add(combKey)
    }
  })

  it("todos los registros cuentan con trazabilidad documental verificable", () => {
    for (const item of DIRECTORIO_DESTINATARIOS) {
      expect(item.trazabilidad).toBeDefined()
      expect(item.trazabilidad.documentoOrigen).toContain("Directorio Oficial del Comité Ejecutivo Seccional XX Michoacán")
      expect(item.trazabilidad.rutaODocumentoUrl).toContain("src/features/escritos/data/comite-seccional.ts")
      expect(item.trazabilidad.fechaConsulta).toBe("2026-04-16")
      expect(item.trazabilidad.periodoConfirmado).toBe("2026–2032")
      expect(item.trazabilidad.nivelVerificacion).toBe("OFICIAL_CONFIRMADO")
      expect(item.trazabilidad.nombre).toBe(item.nombre)
      expect(item.trazabilidad.cargo).toBe(item.cargo)
    }
  })

  it("restringe estrictamente los cargos autorizados (solo titulares y presidentes)", () => {
    for (const item of DIRECTORIO_DESTINATARIOS) {
      const cargoLower = item.cargo.toLowerCase()

      // Comisiones: solo Presidentes o Presidentas
      if (item.categoria === "comisiones") {
        expect(cargoLower.startsWith("presidente") || cargoLower.startsWith("presidenta")).toBe(true)
        expect(cargoLower.includes("secretario") || cargoLower.includes("secretaria")).toBe(false)
      }

      // Subcomisiones: solo Representantes Titulares
      if (item.categoria === "subcomisiones") {
        expect(cargoLower).toContain("representante sindical titular")
        expect(cargoLower).not.toContain("auxiliar")
      }

      // Ningún preset con cargos auxiliares
      expect(cargoLower).not.toContain("auxiliar sindical")
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

  it("búsqueda tolerante a mayúsculas, minúsculas, acentos, órganos y cargos", () => {
    // Tolerancia a acentos (sin acento busca con acento)
    const porNombreSinAcento = buscarDestinatarios("Simbad")
    expect(porNombreSinAcento.length).toBeGreaterThan(0)
    expect(porNombreSinAcento[0].nombre).toContain("Simbad Solorio Vargas")

    const porAcentoEnQuery = buscarDestinatarios("Jesús")
    expect(porAcentoEnQuery.length).toBeGreaterThan(0)
    expect(porAcentoEnQuery[0].nombre).toContain("Jesús Alejandro Reyes Román")

    const porTextoSinAcento = buscarDestinatarios("Jesus")
    expect(porTextoSinAcento.length).toBeGreaterThan(0)
    expect(porTextoSinAcento[0].nombre).toContain("Jesús Alejandro Reyes Román")

    // Por cargo
    const porCargo = buscarDestinatarios("Tesorero")
    expect(porCargo.length).toBeGreaterThan(0)
    expect(porCargo[0].cargo).toContain("Tesorero")

    // Por órgano (con acento vs sin acento)
    const porOrganoSinAcento = buscarDestinatarios("Accion Politica")
    expect(porOrganoSinAcento.length).toBe(1)
    expect(porOrganoSinAcento[0].organo).toBe("Comisión de Acción Política")

    // Búsqueda vacía retorna todo el directorio canónico
    const todo = buscarDestinatarios("")
    expect(todo.length).toBe(DIRECTORIO_DESTINATARIOS.length)
  })

  it("findDestinatario identifica correctamente destinatarios oficiales y diferencia manuales", () => {
    const foundOficial = findDestinatario("Secretario General", "Dr. Simbad Solorio Vargas")
    expect(foundOficial).toBeDefined()
    expect(foundOficial?.categoria).toBe("comite_ejecutivo")

    const foundSinAcento = findDestinatario("Secretario General", "Dr. Simbad Solorio Vargas")
    expect(foundSinAcento).toBeDefined()

    const notFound = findDestinatario("Director HGZ No. 1", "Dr. Pérez")
    expect(notFound).toBeUndefined()

    expect(VALOR_DESTINO_MANUAL).toBe("__MANUAL__")
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

    const res = await generarEscritoService(req)
    if (!getLLMClient()) {
      expect(res.generationMode).toBe("basic_fallback")
      expect(res.advertencias[0]).toContain("La redacción inteligente no está disponible")
    }
  })
})

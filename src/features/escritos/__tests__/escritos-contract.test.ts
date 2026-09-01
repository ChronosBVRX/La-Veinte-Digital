import { describe, it, expect } from "vitest"
import {
  isEscritoDraftV2,
  migrateLegacyEscritoToV2,
  createEmptyEscritoDraftV2,
  parseGenerarEscritoRequest,
  type EscritoDraftV2,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"

describe("escrito-draft contract", () => {
  it("crea un borrador V2 vacío con valores por defecto y schemaVersion 2", () => {
    const draft = createEmptyEscritoDraftV2("user-123", {
      nombre: "Juan Pérez",
      matricula: "12345678",
      categoria: "Enfermero General",
      adscripcion: "HGZ 1",
    })

    expect(draft.schemaVersion).toBe(2)
    expect(draft.ownerId).toBe("user-123")
    expect(draft.status).toBe("draft")
    expect(draft.tipo).toBe("solicitud")
    expect(draft.titulo).toBe("Nuevo escrito")
    expect(draft.cuerpo).toBe("")
    expect(draft.hechos).toBe("")
    expect(draft.peticion).toBe("")
    expect(draft.anexos).toEqual([])
    expect(draft.fuentes).toEqual([])
    expect(isEscritoDraftV2(draft)).toBe(true)
  })

  it("identifica correctamente un EscritoDraftV2 válido", () => {
    const valid: EscritoDraftV2 = {
      schemaVersion: 2,
      id: "esc-1",
      ownerId: "user-1",
      status: "draft",
      titulo: "Solicitud de vacaciones",
      tipo: "solicitud",
      asunto: "Solicitud de período vacacional",
      destino: {
        cargo: "Jefe de Personal",
        nombre: "Lic. Roberto Gómez",
      },
      ciudad: "Morelia",
      fecha: "2026-08-31",
      hechos: "Tengo programado mi periodo vacacional.",
      peticion: "Se autoricen las fechas solicitadas.",
      cuerpo: "Por medio de la presente solicito...",
      atencion: [],
      copias: [],
      anexos: [],
      fuentes: [],
      generationMode: "ai_with_sources",
      createdAt: "2026-08-31T10:00:00.000Z",
      updatedAt: "2026-08-31T10:00:00.000Z",
    }

    expect(isEscritoDraftV2(valid)).toBe(true)
  })

  it("rechaza objetos corruptos o incompletos", () => {
    expect(isEscritoDraftV2(null)).toBe(false)
    expect(isEscritoDraftV2(undefined)).toBe(false)
    expect(isEscritoDraftV2({})).toBe(false)
    expect(isEscritoDraftV2({ schemaVersion: 1, id: "1" })).toBe(false)
    expect(isEscritoDraftV2({ schemaVersion: 2, id: "1" })).toBe(false) // falta ownerId, cuerpo, etc.
  })

  it("migra correctamente un escrito legado V1 a EscritoDraftV2", () => {
    const legacy: LegacyEscritoV1 = {
      id: "leg-001",
      titulo: "Oficio al Jefe de Personal",
      cuerpo: "Por medio de la presente expongo los siguientes hechos...",
      destino: "Jefe de Personal|Lic. Roberto Gómez",
      ciudad: "Morelia",
      fecha: "2026-08-15",
      nombre: "Juan Pérez",
      matricula: "12345678",
      categoria: "Enfermero",
      adscripcion: "HGZ 1",
      atencion: "Secretario General|Dr. Luis Morales",
      copia: "Delegado Sindical|Enf. María Solís",
      fotos: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      firmaUrl: "data:image/png;base64,signaturedata",
      createdAt: "2026-08-15T09:00:00.000Z",
    }

    const migrated = migrateLegacyEscritoToV2(legacy, "user-456")

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.id).toBe("leg-001")
    expect(migrated.ownerId).toBe("user-456")
    expect(migrated.titulo).toBe("Oficio al Jefe de Personal")
    expect(migrated.cuerpo).toBe(legacy.cuerpo)
    expect(migrated.destino).toEqual({
      cargo: "Jefe de Personal",
      nombre: "Lic. Roberto Gómez",
    })
    expect(migrated.ciudad).toBe("Morelia")
    expect(migrated.fecha).toBe("2026-08-15")
    expect(migrated.atencion).toEqual([
      { cargo: "Secretario General", nombre: "Dr. Luis Morales" },
    ])
    expect(migrated.copias).toEqual([
      { cargo: "Delegado Sindical", nombre: "Enf. María Solís" },
    ])
    expect(migrated.anexos.length).toBe(1)
    expect(migrated.anexos[0].nombre).toBe("Anexo 1")
    expect(migrated.anexos[0].dataUrl).toBe(legacy.fotos[0])
    expect(migrated.firmaUrl).toBe(legacy.firmaUrl)
    expect(migrated.createdAt).toBe("2026-08-15T09:00:00.000Z")
    expect(migrated.updatedAt).toBeDefined()
    expect(isEscritoDraftV2(migrated)).toBe(true)
  })

  it("valida y parsea peticiones estructuradas a /api/escritos/generar", () => {
    const validPayload = {
      tipo: "solicitud",
      hechos: "El día 20 de agosto me presenté a laborar en mi turno ordinario...",
      peticion: "Solicito que se me reconozca el tiempo extraordinario laborado.",
      destino: {
        cargo: "Jefe de Personal",
        nombre: "Lic. Roberto Gómez",
      },
      ciudad: "Morelia",
      fecha: "2026-08-31",
      incluirFundamentos: true,
    }

    const result = parseGenerarEscritoRequest(validPayload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tipo).toBe("solicitud")
      expect(result.value.hechos).toBe(validPayload.hechos)
      expect(result.value.peticion).toBe(validPayload.peticion)
      expect(result.value.incluirFundamentos).toBe(true)
    }

    const invalidPayload = {
      tipo: "solicitud",
      hechos: "", // hechos vacíos
      peticion: "Solicito algo",
      destino: { cargo: "", nombre: "" },
      ciudad: "",
      fecha: "",
    }

    const invalidResult = parseGenerarEscritoRequest(invalidPayload)
    expect(invalidResult.ok).toBe(false)
  })
})

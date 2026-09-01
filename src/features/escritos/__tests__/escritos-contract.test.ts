import { describe, it, expect } from "vitest"
import {
  isEscritoDraftV2,
  createEmptyEscritoDraftV2,
  migrateLegacyEscritoToV2,
  nuevoIdEscrito,
  TIPOS_ESCRITO,
  type LegacyEscritoV1,
} from "@/shared/contracts/escrito-draft"

describe("EscritoDraftV2 Contract", () => {
  it("valida correctamente un borrador V2 completo y bien formado", () => {
    const draft = createEmptyEscritoDraftV2("usr_123", "solicitud", {
      asunto: "Solicitud de vacaciones",
      hechos: "Cumplí un año de antigüedad laboral.",
      peticion: "Solicito 12 días hábiles de vacaciones.",
      cuerpo: "Por medio de la presente expongo...",
      destino: { cargo: "Jefe de Personal", nombre: "Lic. Roberto Gómez" },
      ciudad: "Morelia",
      fecha: "2026-08-31",
    })

    expect(isEscritoDraftV2(draft)).toBe(true)
    expect(draft.schemaVersion).toBe(2)
    expect(draft.ownerId).toBe("usr_123")
  })

  it("rechaza objetos inválidos, sin versión o con campos faltantes", () => {
    expect(isEscritoDraftV2(null)).toBe(false)
    expect(isEscritoDraftV2({})).toBe(false)
    expect(isEscritoDraftV2({ schemaVersion: 1, id: "123" })).toBe(false)
    expect(
      isEscritoDraftV2({
        schemaVersion: 2,
        id: "123",
        // falta ownerId, destino, etc.
      })
    ).toBe(false)
  })

  it("migra un escrito legado V1 a V2 preservando id, fecha y destino", () => {
    const legacy: LegacyEscritoV1 = {
      id: "leg_999",
      titulo: "Oficio legado",
      fecha: "2026-05-10",
      tipo: "aclaracion",
      cuerpo: "Texto original del oficio",
      destino: "Dra. María Elena Ramos",
      atencion: "Lic. Carlos Soto",
      copias: ["Delegación Sindical", "Archivo"],
      hechos: "Descuento en quincena 08",
      peticion: "Reembolso",
    }

    const migrated = migrateLegacyEscritoToV2(legacy, "usr_target_456")

    expect(isEscritoDraftV2(migrated)).toBe(true)
    expect(migrated.id).toBe("leg_999")
    expect(migrated.ownerId).toBe("usr_target_456")
    expect(migrated.tipo).toBe("aclaracion")
    expect(migrated.destino.nombre).toBe("Dra. María Elena Ramos")
    expect(migrated.atencion).toHaveLength(1)
    expect(migrated.atencion[0].nombre).toBe("Lic. Carlos Soto")
    expect(migrated.copias).toHaveLength(2)
    expect(migrated.copias[0].nombre).toBe("Delegación Sindical")
    expect(migrated.schemaVersion).toBe(2)
  })

  it("genera IDs únicos con prefijo esc_", () => {
    const id1 = nuevoIdEscrito()
    const id2 = nuevoIdEscrito()
    expect(id1).toMatch(/^esc_\d+_[a-z0-9]+$/)
    expect(id2).toMatch(/^esc_\d+_[a-z0-9]+$/)
    expect(id1).not.toBe(id2)
  })

  it("contiene los 5 tipos de escrito definidos con metadata e iconos", () => {
    expect(Object.keys(TIPOS_ESCRITO)).toEqual([
      "solicitud",
      "aclaracion",
      "queja",
      "seguimiento",
      "libre",
    ])
    expect(TIPOS_ESCRITO.solicitud.titulo).toBe("Solicitud")
    expect(TIPOS_ESCRITO.aclaracion.icono).toBe("🔍")
  })
})

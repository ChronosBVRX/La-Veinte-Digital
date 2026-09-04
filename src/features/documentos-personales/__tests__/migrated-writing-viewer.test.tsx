// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { LegacyEscritoV1, EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import {
  adaptEscritoToViewerDocument,
  resolveViewerDocument,
} from "../services/document-viewer-adapter"

const mockGetBlobResource = vi.fn()
const mockSaveBlobResource = vi.fn()
const mockEscritoToPdfFile = vi.fn()
const mockGetEscritoById = vi.fn()
const mockGetEscritosGuardados = vi.fn()

vi.mock("@/shared/services/blob-storage", () => ({
  getBlobResource: (...args: unknown[]) => mockGetBlobResource(...args),
  saveBlobResource: (...args: unknown[]) => mockSaveBlobResource(...args),
  buildBlobKey: (userId: string, docId: string, type: string, category: string) =>
    `user:${userId}:${type}:${docId}:${category}`,
}))

vi.mock("@/shared/services/escritos-storage", () => ({
  getEscritoById: (...args: unknown[]) => mockGetEscritoById(...args),
  getEscritosGuardados: (...args: unknown[]) => mockGetEscritosGuardados(...args),
}))

vi.mock("../lib/escrito-pdf", () => ({
  escritoToPdfFile: (...args: unknown[]) => mockEscritoToPdfFile(...args),
}))

describe("Migrated Legacy Writing Viewer (migrated-writing-viewer)", () => {
  const userId = "usr_migrated_test"

  beforeEach(() => {
    vi.clearAllMocks()
    window.URL.createObjectURL = vi.fn(() => "blob:https://app.test/legacy-escrito-url")
    window.URL.revokeObjectURL = vi.fn()
  })

  it("1. Migra un Escrito V1 con destino string y lo convierte a V2 para generar el PDF", async () => {
    const legacyEscrito: LegacyEscritoV1 = {
      id: "esc_v1_legacy_001",
      titulo: "Solicitud Vacaciones Extraordinarias",
      fecha: "2026-05-10",
      tipo: "solicitud",
      asunto: "Petición de período vacacional",
      destino: "Lic. Armando Casas - Jefe de Personal",
      ciudad: "Puebla, Pue.",
      hechos: "Cumplí con el período laboral requerido.",
      peticion: "Autorizar el segundo período de vacaciones.",
      cuerpo: "Texto del cuerpo legado...",
      atencion: "Dr. Roberto Gómez",
      copias: ["Delegación Sindical Sección XX"],
      createdAt: "2026-05-10T14:30:00.000Z",
    }

    mockGetBlobResource.mockResolvedValue(null) // No hay PDF previo
    const generatedPdf = new File([new Uint8Array([1, 2, 3])], "Solicitud Vacaciones Extraordinarias.pdf", {
      type: "application/pdf",
    })
    mockEscritoToPdfFile.mockResolvedValue(generatedPdf)

    const result = await adaptEscritoToViewerDocument({
      item: {
        id: "esc_v1_legacy_001",
        tipo: "escrito",
        titulo: "Solicitud Vacaciones Extraordinarias",
        escrito: legacyEscrito as unknown as EscritoDraftV2,
      },
      userId,
    })

    // Comprobamos que escritoToPdfFile fue invocado con el draft migrado a V2
    expect(mockEscritoToPdfFile).toHaveBeenCalledTimes(1)
    const passedDraft = mockEscritoToPdfFile.mock.calls[0][0] as EscritoDraftV2

    // Verificación de migración a V2
    expect(passedDraft.schemaVersion).toBe(2)
    expect(passedDraft.id).toBe("esc_v1_legacy_001")
    expect(passedDraft.titulo).toBe("Solicitud Vacaciones Extraordinarias")
    expect(passedDraft.ownerId).toBe(userId)
    expect(passedDraft.destino).toEqual({
      cargo: "",
      nombre: "Lic. Armando Casas - Jefe de Personal",
    })
    expect(passedDraft.atencion[0].nombre).toBe("Dr. Roberto Gómez")
    expect(passedDraft.copias[0].nombre).toBe("Delegación Sindical Sección XX")

    // Verificación del ViewerDocument
    expect(result.id).toBe("esc_v1_legacy_001")
    expect(result.sourceType).toBe("escrito")
    expect(result.name).toBe("Solicitud Vacaciones Extraordinarias.pdf")
    expect(result.mimeType).toBe("application/pdf")
    expect(result.renderUrl).toBe("blob:https://app.test/legacy-escrito-url")
  })

  it("2. Resuelve escrito legado V1 encontrado en almacenamiento mediante resolveViewerDocument", async () => {
    const legacyEscritoInStorage: LegacyEscritoV1 = {
      id: "esc_v1_in_storage",
      titulo: "Oficio Inconformidad Horario",
      tipo: "queja",
      cuerpo: "Inconformidad con cambio de turno...",
      fecha: "2026-03-12",
    }

    // getEscritoById devuelve null, getEscritosGuardados contiene el V1
    mockGetEscritoById.mockReturnValue(null)
    mockGetEscritosGuardados.mockReturnValue([legacyEscritoInStorage])

    mockGetBlobResource.mockResolvedValue(null)
    const generatedFile = new File([new Uint8Array([4, 5, 6])], "Oficio Inconformidad Horario.pdf", {
      type: "application/pdf",
    })
    mockEscritoToPdfFile.mockResolvedValue(generatedFile)

    const result = await resolveViewerDocument(
      { id: "esc_v1_in_storage", tipo: "escrito" },
      userId
    )

    expect(mockGetEscritosGuardados).toHaveBeenCalledWith(userId)
    expect(result.id).toBe("esc_v1_in_storage")
    expect(result.sourceType).toBe("escrito")
    expect(result.name).toBe("Oficio Inconformidad Horario.pdf")
    expect(mockEscritoToPdfFile).toHaveBeenCalled()
  })
})

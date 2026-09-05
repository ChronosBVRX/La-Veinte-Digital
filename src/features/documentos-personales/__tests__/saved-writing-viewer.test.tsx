// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
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

describe("Saved Writing Viewer (saved-writing-viewer)", () => {
  const userId = "usr_test_123"

  const sampleEscritoV2: EscritoDraftV2 = {
    schemaVersion: 2,
    id: "esc_sample_v2",
    ownerId: userId,
    tipo: "solicitud",
    titulo: "Solicitud de Pase de Salida",
    fecha: "2026-09-01",
    asunto: "Pase de salida",
    destino: {
      cargo: "Director de Unidad Médica",
      nombre: "Dr. Roberto González",
    },
    ciudad: "Puebla, Pue.",
    hechos: "Por medio de la presente solicito pase de salida.",
    peticion: "Autorización de pase.",
    cuerpo: "Por medio de la presente solicito pase de salida.",
    atencion: [],
    copias: [],
    anexos: [],
    fuentes: [],
    incluirFundamentos: false,
    status: "completed",
    generationMode: "manual",
    pdfRef: `user:${userId}:pdf:esc_sample_v2:documento`,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEscritosGuardados.mockReturnValue([])
    mockGetEscritoById.mockReturnValue(null)
    window.URL.createObjectURL = vi.fn(() => "blob:https://app.test/escrito-mock-url")
    window.URL.revokeObjectURL = vi.fn()
  })

  it("1. Escrito V2 con PDF guardado en IndexedDB: lo carga directamente sin regenerar con escritoToPdfFile", async () => {
    const existingPdfBlob = new Blob(["%PDF-1.4 Mock Existing Content"], { type: "application/pdf" })
    mockGetBlobResource.mockResolvedValue(existingPdfBlob)

    const result = await adaptEscritoToViewerDocument({
      item: sampleEscritoV2,
      userId,
      profile: null,
    })

    // Debe consultar IndexedDB con la clave correcta
    expect(mockGetBlobResource).toHaveBeenCalledWith(userId, sampleEscritoV2.pdfRef)
    // NO debe regenerar el PDF
    expect(mockEscritoToPdfFile).not.toHaveBeenCalled()
    // NO debe re-guardar
    expect(mockSaveBlobResource).not.toHaveBeenCalled()

    // El resultado debe tener el contrato ViewerDocument
    expect(result.id).toBe(sampleEscritoV2.id)
    expect(result.name).toBe("Solicitud de Pase de Salida.pdf")
    expect(result.mimeType).toBe("application/pdf")
    expect(result.sourceType).toBe("escrito")
    expect(result.renderUrl).toBe("blob:https://app.test/escrito-mock-url")
    expect(result.file).toBe(existingPdfBlob)
    expect(result.fileSize).toBe(existingPdfBlob.size)
  })

  it("2. Escrito V2 sin PDF preexistente en IndexedDB: genera el PDF con escritoToPdfFile y lo persiste en IndexedDB", async () => {
    // Simula que no existe en IndexedDB
    mockGetBlobResource.mockResolvedValue(null)

    const generatedPdfFile = new File(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
      "Solicitud de Pase de Salida.pdf",
      { type: "application/pdf" }
    )
    mockEscritoToPdfFile.mockResolvedValue(generatedPdfFile)
    mockSaveBlobResource.mockResolvedValue(undefined)

    const result = await adaptEscritoToViewerDocument({
      item: sampleEscritoV2,
      userId,
      profile: {
        fullName: "Dr. Juan Pérez",
        matricula: "99123456",
        categoria: "MÉDICO NO FAMILIAR",
      },
    })

    // Consultó IndexedDB
    expect(mockGetBlobResource).toHaveBeenCalled()
    // Como no existía, generó con escritoToPdfFile pasando el perfil institucional
    expect(mockEscritoToPdfFile).toHaveBeenCalledWith(
      sampleEscritoV2,
      userId,
      expect.objectContaining({
        nombre: "Dr. Juan Pérez",
        matricula: "99123456",
        categoria: "MÉDICO NO FAMILIAR",
      })
    )
    // Guardó en IndexedDB
    expect(mockSaveBlobResource).toHaveBeenCalledWith(
      userId,
      sampleEscritoV2.id,
      "pdf",
      "documento",
      generatedPdfFile
    )

    // Contrato ViewerDocument generado
    expect(result.id).toBe(sampleEscritoV2.id)
    expect(result.name).toBe("Solicitud de Pase de Salida.pdf")
    expect(result.mimeType).toBe("application/pdf")
    expect(result.renderUrl).toBe("blob:https://app.test/escrito-mock-url")
    expect(result.fileSize).toBe(generatedPdfFile.size)
  })

  it("3. resolveViewerDocument resuelve un escrito pasado por ID buscándolo en el almacén de escritos", async () => {
    mockGetEscritoById.mockReturnValue(sampleEscritoV2)
    const existingPdfBlob = new Blob(["%PDF-1.4 Mock"], { type: "application/pdf" })
    mockGetBlobResource.mockResolvedValue(existingPdfBlob)

    const result = await resolveViewerDocument({ id: "esc_sample_v2", tipo: "escrito" }, userId)

    expect(mockGetEscritoById).toHaveBeenCalledWith("esc_sample_v2", userId)
    expect(result.id).toBe("esc_sample_v2")
    expect(result.sourceType).toBe("escrito")
    expect(result.name).toBe("Solicitud de Pase de Salida.pdf")
  })
})

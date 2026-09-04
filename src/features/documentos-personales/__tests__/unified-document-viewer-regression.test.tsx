// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import type { DocumentoPersonalItem } from "../lib/documents"
import {
  resolveViewerDocument,
  isEscritoDocument,
} from "../services/document-viewer-adapter"

interface MockLaVeinteApp {
  readNativeDocument: ReturnType<typeof vi.fn>
  listNativeDocuments: ReturnType<typeof vi.fn>
}

function getMockApp(): MockLaVeinteApp | undefined {
  return (window as unknown as { LaVeinteApp?: MockLaVeinteApp }).LaVeinteApp
}

function setMockApp(app: MockLaVeinteApp | undefined) {
  const win = window as unknown as { LaVeinteApp?: MockLaVeinteApp }
  if (app) win.LaVeinteApp = app
  else delete win.LaVeinteApp
}

const mockGetBlobResource = vi.fn()
const mockSaveBlobResource = vi.fn()
const mockEscritoToPdfFile = vi.fn()
const mockReadNativeDocumentAsFile = vi.fn()
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

vi.mock("@/features/transferir/services/transfer", () => ({
  readNativeDocumentAsFile: (...args: unknown[]) => mockReadNativeDocumentAsFile(...args),
}))

describe("Unified Document Viewer Regression Matrix (5 Document Types)", () => {
  const userId = "usr_regression_matrix"

  beforeEach(() => {
    vi.clearAllMocks()
    setMockApp(undefined)
    window.URL.createObjectURL = vi.fn((_b: unknown) => `blob:https://app.test/mock-${Math.random().toString(36).slice(2, 6)}`)
    window.URL.revokeObjectURL = vi.fn()
  })

  // -------------------------------------------------------------
  // 1. Escrito V2 con PDF guardado
  // -------------------------------------------------------------
  it("Tipo 1: Escrito V2 con PDF guardado en IndexedDB se resuelve sin invocar puente nativo ni escritoToPdfFile", async () => {
    // Configurar simulación de puente Android activo para verificar que NUNCA sea invocado
    setMockApp({
      listNativeDocuments: vi.fn(),
      readNativeDocument: vi.fn(),
    })

    const escritoV2: EscritoDraftV2 = {
      schemaVersion: 2,
      id: "esc_v2_saved",
      ownerId: userId,
      tipo: "solicitud",
      titulo: "Solicitud Vacaciones V2",
      fecha: "2026-09-01",
      asunto: "Vacaciones",
      destino: { cargo: "Jefe", nombre: "Dr. Morales" },
      ciudad: "Puebla",
      hechos: "Hechos...",
      peticion: "Petición...",
      cuerpo: "Cuerpo...",
      atencion: [],
      copias: [],
      anexos: [],
      fuentes: [],
      incluirFundamentos: true,
      status: "completed",
      generationMode: "manual",
      pdfRef: `user:${userId}:pdf:esc_v2_saved:documento`,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
    }

    const existingBlob = new Blob(["%PDF-1.4 Saved Escrito"], { type: "application/pdf" })
    mockGetBlobResource.mockResolvedValue(existingBlob)

    const resolved = await resolveViewerDocument(escritoV2, userId)

    expect(isEscritoDocument(escritoV2)).toBe(true)
    expect(mockReadNativeDocumentAsFile).not.toHaveBeenCalled()
    expect(getMockApp()?.readNativeDocument).not.toHaveBeenCalled()
    expect(mockEscritoToPdfFile).not.toHaveBeenCalled()
    expect(resolved.id).toBe("esc_v2_saved")
    expect(resolved.sourceType).toBe("escrito")
    expect(resolved.mimeType).toBe("application/pdf")
    expect(resolved.renderUrl).toContain("blob:https://app.test/mock-")
  })

  // -------------------------------------------------------------
  // 2. Escrito V2 sin PDF previo (generación al vuelo)
  // -------------------------------------------------------------
  it("Tipo 2: Escrito V2 sin PDF preexistente genera el PDF y NO invoca el puente nativo", async () => {
    setMockApp({
      listNativeDocuments: vi.fn(),
      readNativeDocument: vi.fn(),
    })

    const escritoV2NoPdf: EscritoDraftV2 = {
      schemaVersion: 2,
      id: "esc_v2_nopdf",
      ownerId: userId,
      tipo: "aclaracion",
      titulo: "Aclaración Nómina",
      fecha: "2026-09-02",
      asunto: "Aclaración concepto 054",
      destino: { cargo: "Administrador", nombre: "Lic. Juárez" },
      ciudad: "Puebla",
      hechos: "Descuento indebido",
      peticion: "Reembolso",
      cuerpo: "Detalle...",
      atencion: [],
      copias: [],
      anexos: [],
      fuentes: [],
      incluirFundamentos: false,
      status: "draft",
      generationMode: "ai_without_sources",
      createdAt: "2026-09-02T11:00:00.000Z",
      updatedAt: "2026-09-02T11:00:00.000Z",
    }

    mockGetBlobResource.mockResolvedValue(null) // No guardado previamente
    const generatedPdf = new File([new Uint8Array([10, 20, 30])], "Aclaración Nómina.pdf", {
      type: "application/pdf",
    })
    mockEscritoToPdfFile.mockResolvedValue(generatedPdf)

    const resolved = await resolveViewerDocument(escritoV2NoPdf, userId)

    expect(isEscritoDocument(escritoV2NoPdf)).toBe(true)
    expect(mockReadNativeDocumentAsFile).not.toHaveBeenCalled()
    expect(getMockApp()?.readNativeDocument).not.toHaveBeenCalled()
    expect(mockEscritoToPdfFile).toHaveBeenCalledTimes(1)
    expect(mockSaveBlobResource).toHaveBeenCalledWith(
      userId,
      "esc_v2_nopdf",
      "pdf",
      "documento",
      generatedPdf
    )
    expect(resolved.id).toBe("esc_v2_nopdf")
    expect(resolved.sourceType).toBe("escrito")
    expect(resolved.name).toBe("Aclaración Nómina.pdf")
  })

  // -------------------------------------------------------------
  // 3. Escrito V1 migrado
  // -------------------------------------------------------------
  it("Tipo 3: Escrito V1 legado se migra a V2, genera PDF y NUNCA invoca el puente nativo", async () => {
    setMockApp({
      listNativeDocuments: vi.fn(),
      readNativeDocument: vi.fn(),
    })

    const legacyDoc: DocumentoPersonalItem = {
      kind: "escrito",
      id: "esc_v1_legacy_item",
      tipo: "escrito",
      titulo: "Petición Antigua",
      fecha: "2026-01-15",
      escrito: {
        id: "esc_v1_legacy_item",
        titulo: "Petición Antigua",
        fecha: "2026-01-15",
        tipo: "solicitud",
        cuerpo: "Texto antiguo...",
        destino: "Jefe de Servicio",
      } as unknown as EscritoDraftV2,
    }

    mockGetBlobResource.mockResolvedValue(null)
    const generatedPdf = new File([new Uint8Array([50, 60])], "Petición Antigua.pdf", {
      type: "application/pdf",
    })
    mockEscritoToPdfFile.mockResolvedValue(generatedPdf)

    const resolved = await resolveViewerDocument(legacyDoc, userId)

    expect(isEscritoDocument(legacyDoc)).toBe(true)
    expect(mockReadNativeDocumentAsFile).not.toHaveBeenCalled()
    expect(getMockApp()?.readNativeDocument).not.toHaveBeenCalled()
    expect(mockEscritoToPdfFile).toHaveBeenCalledTimes(1)
    expect(resolved.id).toBe("esc_v1_legacy_item")
    expect(resolved.sourceType).toBe("escrito")
  })

  // -------------------------------------------------------------
  // 4. Tarjetón PDF importado (Web y Android)
  // -------------------------------------------------------------
  it("Tipo 4: Tarjetón PDF funciona en Web (sourceUri) y en Android Nativo (readNativeDocumentAsFile)", async () => {
    // 4A: Entorno Web con data URL o HTTP URL
    const tarjetonWeb: DocumentoPersonalItem & { sourceUri?: string } = {
      kind: "nativo",
      source: "imss",
      id: "tarj_web_001",
      numericId: 101,
      name: "Tarjeton_IMSS_2026_Q15.pdf",
      localPath: "",
      mimeType: "application/pdf",
      fileSize: 450000,
      downloadedAt: Date.now(),
      tipo: "tarjeton",
      sourceUri: "https://la20.app/files/tarjeton-q15.pdf",
    }

    const resolvedWeb = await resolveViewerDocument(tarjetonWeb, userId)
    expect(isEscritoDocument(tarjetonWeb)).toBe(false)
    expect(resolvedWeb.id).toBe("tarj_web_001")
    expect(resolvedWeb.sourceType).toBe("tarjeton")
    expect(resolvedWeb.renderUrl).toBe("https://la20.app/files/tarjeton-q15.pdf")

    // 4B: Entorno Android Nativo con puente
    setMockApp({
      readNativeDocument: vi.fn(),
      listNativeDocuments: vi.fn(),
    })

    const tarjetonAndroid: DocumentoPersonalItem = {
      kind: "nativo",
      source: "imss",
      id: "tarj_android_002",
      numericId: 102,
      name: "Tarjeton_IMSS_2026_Q16.pdf",
      localPath: "/storage/emulated/0/Download/Tarjeton_Q16.pdf",
      mimeType: "application/pdf",
      fileSize: 480000,
      downloadedAt: Date.now(),
      tipo: "tarjeton",
    }

    const nativeFile = new File([new Uint8Array([1, 2, 3])], "Tarjeton_IMSS_2026_Q16.pdf", {
      type: "application/pdf",
    })
    mockReadNativeDocumentAsFile.mockResolvedValue(nativeFile)

    const resolvedAndroid = await resolveViewerDocument(tarjetonAndroid, userId)
    expect(mockReadNativeDocumentAsFile).toHaveBeenCalledWith({
      name: "Tarjeton_IMSS_2026_Q16.pdf",
      mimeType: "application/pdf",
      localPath: "/storage/emulated/0/Download/Tarjeton_Q16.pdf",
    })
    expect(resolvedAndroid.sourceType).toBe("tarjeton")
    expect(resolvedAndroid.renderUrl).toContain("blob:https://app.test/mock-")
  })

  // -------------------------------------------------------------
  // 5. Checada PDF importada (Web y Android)
  // -------------------------------------------------------------
  it("Tipo 5: Checada PDF funciona en Web y en Android Nativo correctamente", async () => {
    // 5A: Checada en Web con data URL
    const validBase64 = btoa("%PDF-1.4 mock valid checada binary data")
    const checadaWeb: DocumentoPersonalItem & { sourceUri?: string } = {
      kind: "nativo",
      source: "imss",
      id: "checada_web_001",
      numericId: 201,
      name: "Reporte_Checadas_Agosto.pdf",
      localPath: "",
      mimeType: "application/pdf",
      fileSize: 310000,
      downloadedAt: Date.now(),
      tipo: "checadas",
      sourceUri: `data:application/pdf;base64,${validBase64}`,
    }

    const resolvedChecadaWeb = await resolveViewerDocument(checadaWeb, userId)
    expect(isEscritoDocument(checadaWeb)).toBe(false)
    expect(resolvedChecadaWeb.sourceType).toBe("checada")
    expect(resolvedChecadaWeb.renderUrl).toContain("blob:https://app.test/mock-")

    // 5B: Checada en Android Nativo
    setMockApp({
      readNativeDocument: vi.fn(),
      listNativeDocuments: vi.fn(),
    })

    const checadaAndroid: DocumentoPersonalItem = {
      kind: "nativo",
      source: "imss",
      id: "checada_android_002",
      numericId: 202,
      name: "Reporte_Checadas_Septiembre.pdf",
      localPath: "/storage/emulated/0/Download/Reporte_Septiembre.pdf",
      mimeType: "application/pdf",
      fileSize: 320000,
      downloadedAt: Date.now(),
      tipo: "checadas",
    }

    const nativeChecadaFile = new File([new Uint8Array([7, 8, 9])], "Reporte_Checadas_Septiembre.pdf", {
      type: "application/pdf",
    })
    mockReadNativeDocumentAsFile.mockResolvedValue(nativeChecadaFile)

    const resolvedChecadaAndroid = await resolveViewerDocument(checadaAndroid, userId)
    expect(mockReadNativeDocumentAsFile).toHaveBeenCalledWith({
      name: "Reporte_Checadas_Septiembre.pdf",
      mimeType: "application/pdf",
      localPath: "/storage/emulated/0/Download/Reporte_Septiembre.pdf",
    })
    expect(resolvedChecadaAndroid.sourceType).toBe("checada")
    expect(resolvedChecadaAndroid.name).toBe("Reporte_Checadas_Septiembre.pdf")
  })
})

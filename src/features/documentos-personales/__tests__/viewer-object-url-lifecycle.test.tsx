// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { DocumentosPersonales } from "../components/DocumentosPersonales"
import type { EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

const mockGetEscritosGuardados = vi.fn()
const mockGetBlobResource = vi.fn()
const mockSaveBlobResource = vi.fn()
const mockEscritoToPdfFile = vi.fn()

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "usr_lifecycle_123", email: "user@imss.gob.mx" } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Ana Morales", matricula: "554433" },
          }),
        }),
      }),
    }),
  }),
}))

vi.mock("@/shared/services/escritos-storage", () => ({
  getEscritosGuardados: (...args: unknown[]) => mockGetEscritosGuardados(...args),
  eliminarEscrito: vi.fn(),
  getEscritoById: vi.fn(),
}))

vi.mock("@/shared/services/blob-storage", () => ({
  getBlobResource: (...args: unknown[]) => mockGetBlobResource(...args),
  saveBlobResource: (...args: unknown[]) => mockSaveBlobResource(...args),
  buildBlobKey: (userId: string, docId: string, type: string, category: string) =>
    `user:${userId}:${type}:${docId}:${category}`,
}))

vi.mock("../lib/escrito-pdf", () => ({
  escritoToPdfFile: (...args: unknown[]) => mockEscritoToPdfFile(...args),
}))

// Mock PDF.js client to avoid canvas render in jsdom
vi.mock("@/features/tarjeton/lib/pdfjs-client", () => ({
  loadPdfDocument: vi.fn(async () => ({
    pdf: {
      numPages: 1,
      getPage: vi.fn(async () => ({
        getViewport: () => ({ width: 600, height: 800 }),
        render: () => ({ promise: Promise.resolve() }),
      })),
    },
  })),
}))

describe("Viewer Object URL Lifecycle & Guardrails (viewer-object-url-lifecycle)", () => {
  const userId = "usr_lifecycle_123"
  let createdUrls: string[] = []
  let revokedUrls: string[] = []

  const sampleEscrito: EscritoDraftV2 = {
    schemaVersion: 2,
    id: "esc_lifecycle_001",
    ownerId: userId,
    tipo: "solicitud",
    titulo: "Oficio Vacaciones 2026",
    fecha: "2026-09-02",
    asunto: "Periodo vacacional",
    destino: { cargo: "Director", nombre: "Dr. Morales" },
    ciudad: "CDMX",
    hechos: "Solicito vacaciones.",
    peticion: "Autorización.",
    cuerpo: "Cuerpo...",
    atencion: [],
    copias: [],
    anexos: [],
    fuentes: [],
    incluirFundamentos: false,
    status: "completed",
    generationMode: "manual",
    createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    createdUrls = []
    revokedUrls = []

    let urlCounter = 0
    window.URL.createObjectURL = vi.fn((_blob: unknown) => {
      const url = `blob:https://app.test/doc-url-${++urlCounter}`
      createdUrls.push(url)
      return url
    })
    window.URL.revokeObjectURL = vi.fn((url: string) => {
      revokedUrls.push(url)
    })
  })

  it("1. El modal no se abre hasta que el Blob esté listo y tenga tipo application/pdf", async () => {
    let resolveBlobPromise: (b: Blob) => void
    const blobPromise = new Promise<Blob>((resolve) => {
      resolveBlobPromise = resolve
    })

    mockGetEscritosGuardados.mockReturnValue([sampleEscrito])
    mockGetBlobResource.mockReturnValue(blobPromise)

    render(<DocumentosPersonales />)

    // Esperar a que cargue la lista de documentos
    await screen.findByText("Oficio Vacaciones 2026")
    const openBtn = screen.getByLabelText("Abrir documento")
    expect(openBtn).toBeDefined()

    // Abrir el documento haciendo clic en su botón
    fireEvent.click(openBtn)

    // En este momento el Blob aún está pendiente de resolución; el visor NO debe estar en el DOM
    expect(screen.queryByLabelText("Visor de documento")).toBeNull()

    // Resolvemos el Blob con tipo application/pdf
    const validPdf = new Blob(["%PDF-1.4 Content"], { type: "application/pdf" })
    resolveBlobPromise!(validPdf)

    // Una vez resuelto, el modal se monta inmediatamente
    await waitFor(() => {
      expect(screen.getByLabelText("Visor de documento")).toBeDefined()
    })

    expect(createdUrls.length).toBeGreaterThanOrEqual(1)
  })

  it("2. Cerrar el visor libera el Object URL y reabrir genera una URL nueva", async () => {
    const validPdf = new Blob(["%PDF-1.4 Content"], { type: "application/pdf" })
    mockGetEscritosGuardados.mockReturnValue([sampleEscrito])
    mockGetBlobResource.mockResolvedValue(validPdf)

    render(<DocumentosPersonales />)

    await screen.findByText("Oficio Vacaciones 2026")
    const openBtn = screen.getByLabelText("Abrir documento")

    // 1. Abrir por primera vez
    fireEvent.click(openBtn)
    await waitFor(() => {
      expect(screen.getByLabelText("Visor de documento")).toBeDefined()
    })

    const firstUrl = createdUrls[0]
    expect(firstUrl).toBeDefined()

    // 2. Cerrar el visor pulsando el botón Cerrar
    const closeBtn = screen.getByLabelText(/Cerrar/i)
    fireEvent.click(closeBtn)

    // Esperar a que el modal se cierre y transcurra el cleanup
    await waitFor(() => {
      expect(screen.queryByLabelText("Visor de documento")).toBeNull()
      expect(revokedUrls).toContain(firstUrl)
    })

    // 3. Reabrir el mismo documento
    fireEvent.click(openBtn)
    await waitFor(() => {
      expect(screen.getByLabelText("Visor de documento")).toBeDefined()
    })

    // Debe existir una segunda URL diferente
    const secondUrl = createdUrls[createdUrls.length - 1]
    expect(secondUrl).toBeDefined()
    expect(secondUrl).not.toBe(firstUrl)
  })

  it("3. Error en IndexedDB o generación no congela la UI ni genera spinners infinitos: muestra error y permite reintentar", async () => {
    mockGetEscritosGuardados.mockReturnValue([sampleEscrito])
    mockGetBlobResource.mockResolvedValue(null)
    // Simula fallo al generar PDF
    mockEscritoToPdfFile.mockRejectedValue(new Error("Fallo de renderizado jsPDF simulado"))

    render(<DocumentosPersonales />)

    await screen.findByText("Oficio Vacaciones 2026")
    const openBtn = screen.getByLabelText("Abrir documento")
    fireEvent.click(openBtn)

    // No debe abrirse el visor con pantalla negra ni spinner eterno
    await waitFor(() => {
      expect(screen.queryByLabelText("Visor de documento")).toBeNull()
      // Se debe mostrar el banner de error con opción de reintentar
      expect(screen.getByText(/Fallo de renderizado jsPDF simulado/i)).toBeDefined()
      expect(screen.getByRole("button", { name: /Reintentar/i })).toBeDefined()
    })

    // Reintentar ahora con éxito
    const validPdf = new File([new Uint8Array([1, 2])], "Oficio Vacaciones 2026.pdf", {
      type: "application/pdf",
    })
    mockEscritoToPdfFile.mockResolvedValue(validPdf)

    const retryBtn = screen.getByRole("button", { name: /Reintentar/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByLabelText("Visor de documento")).toBeDefined()
    })
  })
})

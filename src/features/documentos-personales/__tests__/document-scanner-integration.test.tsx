// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { DocumentosPersonales } from "../components/DocumentosPersonales"
import { saveScanDocument, listScanDocuments } from "@/shared/services/scan-document-storage"

const sessionState = vi.hoisted(() => ({ userId: "usr_scan_test" as string | null }))

vi.mock("../components/SendPrintModal", () => ({
  SendPrintModal: () => null,
}))

vi.mock("../components/ImportTarjetonModal", () => ({
  ImportTarjetonModal: () => null,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: sessionState.userId ? { id: sessionState.userId, email: "scan@imss.gob.mx" } : null },
      })),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { full_name: "Ana Morales", matricula: "554433" } }),
        }),
      }),
    }),
  }),
}))

const DB_NAME = "la_veinte_scan_docs_db"

function pdfBlob(content: string): Blob {
  return new Blob([new TextEncoder().encode(content)], { type: "application/pdf" })
}

beforeEach(async () => {
  localStorage.clear()
  delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
  sessionState.userId = "usr_scan_test"
  vi.clearAllMocks()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe("Documentos personales + módulo de digitalización", () => {
  it("muestra las acciones de digitalización (documento, INE y copiadora)", async () => {
    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/Digitalizar documento/i)).toBeDefined()
    })
    expect(screen.getByText(/Escanear INE/i)).toBeDefined()
    expect(screen.getByText(/Escanear para imprimir/i)).toBeDefined()
  })

  it("lista los documentos escaneados web bajo la sección Documentos", async () => {
    await saveScanDocument("usr_scan_test", {
      kind: "documento",
      name: "Contrato escaneado.pdf",
      pageCount: 2,
      blob: pdfBlob("contrato"),
    })

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/Contrato escaneado\.pdf/i)).toBeDefined()
    })
    expect(screen.getAllByText("Documentos").length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Abrir documento/i)).toBeDefined()
    expect(screen.getByLabelText(/Compartir documento/i)).toBeDefined()
    expect(screen.getByLabelText(/Enviar a imprimir o transferir/i)).toBeDefined()
  })

  it("clasifica INE escaneado como Identificaciones", async () => {
    await saveScanDocument("usr_scan_test", {
      kind: "ine",
      name: "INE 2026-09-14 10-00.pdf",
      pageCount: 1,
      blob: pdfBlob("ine"),
    })

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/INE 2026-09-14 10-00\.pdf/i)).toBeDefined()
    })
    expect(screen.getAllByText("Identificaciones").length).toBeGreaterThan(0)
  })

  it("elimina un documento escaneado con confirmación y lo purga del almacenamiento", async () => {
    const saved = await saveScanDocument("usr_scan_test", {
      kind: "documento",
      name: "Para borrar.pdf",
      pageCount: 1,
      blob: pdfBlob("borrar"),
    })

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/Para borrar\.pdf/i)).toBeDefined()
    })

    fireEvent.click(screen.getByLabelText(/Eliminar documento/i))
    await waitFor(() => {
      expect(screen.getByText(/Eliminar documento/i)).toBeDefined()
    })
    fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }))

    await waitFor(async () => {
      expect(screen.queryByText(/Para borrar\.pdf/i)).toBeNull()
    })
    expect(await listScanDocuments("usr_scan_test")).toHaveLength(0)
    expect(saved.id.startsWith("documento_")).toBe(true)
  })

  it("clasifica escaneos nativos por source explícito (DOCUMENT_SCAN / INE_SCAN)", async () => {
    window.LaVeinteApp = {
      listNativeDocuments: vi.fn().mockResolvedValue([
        {
          id: 201,
          name: "Documento escaneado 2026-09-14 09-00.pdf",
          localPath: "/data/files/documentos/doc.pdf",
          source: "DOCUMENT_SCAN",
          fileSize: 30000,
          downloadedAt: new Date("2026-09-14T09:00:00Z").getTime(),
          mimeType: "application/pdf",
        },
        {
          id: 202,
          name: "INE 2026-09-14 09-05.pdf",
          localPath: "/data/files/identificaciones/ine.pdf",
          source: "INE_SCAN",
          fileSize: 40000,
          downloadedAt: new Date("2026-09-14T09:05:00Z").getTime(),
          mimeType: "application/pdf",
        },
      ]),
      readNativeDocument: vi.fn().mockResolvedValue(null),
      deleteNativeDocumentById: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as typeof window.LaVeinteApp

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/Documento escaneado 2026-09-14 09-00\.pdf/i)).toBeDefined()
    })
    expect(screen.getByText(/INE 2026-09-14 09-05\.pdf/i)).toBeDefined()
    expect(screen.getAllByText("Identificaciones").length).toBeGreaterThan(0)
  })

  it("aislamiento A/B: un usuario no ve los escaneos de otro", async () => {
    await saveScanDocument("usr_scan_test", {
      kind: "ine",
      name: "INE privado A.pdf",
      pageCount: 1,
      blob: pdfBlob("ine-de-A"),
    })

    sessionState.userId = "usr_otro"
    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText(/Aún no tienes documentos/i)).toBeDefined()
    })
    expect(screen.queryByText(/INE privado A\.pdf/i)).toBeNull()
  })
})

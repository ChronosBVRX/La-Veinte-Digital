// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { DocumentScannerFlow } from "../components/DocumentScannerFlow"
import { listScanDocuments } from "@/shared/services/scan-document-storage"
import { tinyJpegBytes } from "./helpers/jpeg"

const USER = "user-flow-uuid"
const DB_NAME = "la_veinte_scan_docs_db"

// jsdom no decodifica imágenes ni canvas: el re-render de páginas se sustituye por
// la fuente original (el pipeline real de canvas se prueba en navegador).
vi.mock("../lib/page-renderer", () => ({
  renderPageBlob: async (source: Blob) => {
    const bytes = await source.arrayBuffer()
    return { blob: new Blob([bytes], { type: "image/jpeg" }), width: 2, height: 2 }
  },
  DEFAULT_PAGE_MAX_DIMENSION: 2400,
  DEFAULT_PAGE_JPEG_QUALITY: 0.82,
}))

function pagePayload() {
  const bytes = tinyJpegBytes()
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return {
    base64: btoa(binary),
    mimeType: "image/jpeg",
    width: 2,
    height: 2,
  }
}

function installNativeScan(result: unknown, impl?: () => Promise<unknown>) {
  const scanDocument = impl ? vi.fn().mockImplementation(impl) : vi.fn().mockResolvedValue(result)
  window.LaVeinteApp = { scanDocument } as unknown as typeof window.LaVeinteApp
  return scanDocument
}

beforeEach(async () => {
  delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
  vi.clearAllMocks()
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
})

describe("DocumentScannerFlow: motor nativo y cancelación", () => {
  it("usa ML Kit cuando está disponible y pasa a revisión", async () => {
    const scanDocument = installNativeScan({ ok: true, engine: "mlkit", pages: [pagePayload()] })
    const onClose = vi.fn()

    render(
      <DocumentScannerFlow open mode="document" userId={USER} onClose={onClose} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Revisa tus páginas/i)).toBeDefined()
    })
    expect(scanDocument).toHaveBeenCalledTimes(1)
    expect(scanDocument.mock.calls[0][0].mode).toBe("document")
  })

  it("si el usuario cancela el escáner nativo, el flujo se cierra sin páginas", async () => {
    installNativeScan({ ok: false, reason: "cancelled" })
    const onClose = vi.fn()

    render(
      <DocumentScannerFlow open mode="document" userId={USER} onClose={onClose} />
    )

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it("si ML Kit no está disponible, cae al flujo web de captura", async () => {
    installNativeScan({ ok: false, reason: "play_services_unavailable" })
    const onClose = vi.fn()

    render(
      <DocumentScannerFlow open mode="document" userId={USER} onClose={onClose} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Escanea el documento/i)).toBeDefined()
    })
    expect(screen.getByRole("button", { name: /Abrir cámara/i })).toBeDefined()
    expect(screen.getByRole("button", { name: /Foto de galería/i })).toBeDefined()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("un fallo inesperado de ML Kit también ofrece la cámara web", async () => {
    installNativeScan({ ok: false, reason: "failed" })

    render(
      <DocumentScannerFlow open mode="document" userId={USER} onClose={vi.fn()} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Escanea el documento/i)).toBeDefined()
    })
    expect(screen.getByRole("button", { name: /Abrir cámara/i })).toBeDefined()
  })
})

describe("DocumentScannerFlow: INE frente y reverso", () => {
  it("solicita frente y reverso y compone una sola hoja", async () => {
    const scanDocument = installNativeScan(null, async () => ({
      ok: true,
      engine: "mlkit",
      pages: [pagePayload()],
    }))
    const onSaved = vi.fn()

    render(
      <DocumentScannerFlow open mode="ine-front" userId={USER} onClose={vi.fn()} onSaved={onSaved} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Revisa el frente y el reverso/i)).toBeDefined()
    })
    expect(scanDocument.mock.calls[0][0].mode).toBe("ine-front")
    expect(scanDocument.mock.calls[1][0].mode).toBe("ine-back")

    fireEvent.click(screen.getByRole("button", { name: /Guardar PDF/i }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
    })
    const saved = onSaved.mock.calls[0][0]
    expect(saved.kind).toBe("ine")
    const stored = await listScanDocuments(USER)
    expect(stored).toHaveLength(1)
    expect(stored[0].kind).toBe("ine")
    expect(stored[0].pageCount).toBe(1)
  })

  it("si se cancela el reverso, conserva el frente y pide el reverso por cámara", async () => {
    let call = 0
    installNativeScan(null, async () => {
      call += 1
      if (call === 1) return { ok: true, engine: "mlkit", pages: [pagePayload()] }
      return { ok: false, reason: "cancelled" }
    })

    render(<DocumentScannerFlow open mode="ine-front" userId={USER} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Escanea el reverso del INE/i)).toBeDefined()
    })
    expect(screen.getByRole("button", { name: /Abrir cámara/i })).toBeDefined()
  })
})

describe("DocumentScannerFlow: guardar y modo copiadora", () => {
  it("guarda el PDF en Documentos personales (IndexedDB) en modo normal", async () => {
    installNativeScan({ ok: true, engine: "mlkit", pages: [pagePayload()] })
    const onSaved = vi.fn()
    const onClose = vi.fn()

    render(
      <DocumentScannerFlow open mode="document" userId={USER} onClose={onClose} onSaved={onSaved} />
    )

    await waitFor(() => {
      expect(screen.getByText(/Revisa tus páginas/i)).toBeDefined()
    })
    fireEvent.click(screen.getByRole("button", { name: /Guardar PDF/i }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1)
    })
    expect(onSaved.mock.calls[0][0].storage).toBe("indexeddb")
    expect(await listScanDocuments(USER)).toHaveLength(1)
    expect(onClose).toHaveBeenCalled()
  })

  it("en modo copiadora no guarda por defecto y entrega el PDF a imprimir", async () => {
    installNativeScan({ ok: true, engine: "mlkit", pages: [pagePayload()] })
    const onPrintRequest = vi.fn()
    const onSaved = vi.fn()

    render(
      <DocumentScannerFlow
        open
        mode="document"
        intent="print"
        userId={USER}
        onClose={vi.fn()}
        onSaved={onSaved}
        onPrintRequest={onPrintRequest}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Revisa tus páginas/i)).toBeDefined()
    })

    // El usuario debe ver claramente que NO se conservará.
    expect(screen.getByText(/no se guardará en el dispositivo/i)).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: /Enviar a imprimir/i }))

    await waitFor(() => {
      expect(onPrintRequest).toHaveBeenCalledTimes(1)
    })
    const [file] = onPrintRequest.mock.calls[0]
    expect(file).toBeInstanceOf(File)
    expect(file.name.endsWith(".pdf")).toBe(true)
    expect(onSaved).not.toHaveBeenCalled()
    expect(await listScanDocuments(USER)).toHaveLength(0)
  })

  it("permite guardar también en el modo copiadora si el usuario lo marca", async () => {
    installNativeScan({ ok: true, engine: "mlkit", pages: [pagePayload()] })
    const onPrintRequest = vi.fn()

    render(
      <DocumentScannerFlow
        open
        mode="document"
        intent="print"
        userId={USER}
        onClose={vi.fn()}
        onPrintRequest={onPrintRequest}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Revisa tus páginas/i)).toBeDefined()
    })
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /Guardar PDF/i }))

    await waitFor(async () => {
      expect(await listScanDocuments(USER)).toHaveLength(1)
    })
    expect(onPrintRequest).not.toHaveBeenCalled()
  })
})

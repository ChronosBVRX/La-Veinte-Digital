// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { DocumentViewerModal } from "../components/DocumentViewerModal"
import type { DocumentoPersonalItem } from "../lib/documents"

describe("FullscreenPortal & DocumentViewerModal", () => {
  beforeEach(() => {
    document.body.style.overflow = ""
    vi.clearAllMocks()
  })

  it("FullscreenPortal se renderiza en document.body y bloquea el scroll del fondo", () => {
    const handleClose = vi.fn()
    const { unmount } = render(
      <FullscreenPortal open={true} onClose={handleClose} ariaLabel="Modal de prueba">
        <div data-testid="portal-content">Contenido en Portal</div>
      </FullscreenPortal>
    )

    const content = screen.getByTestId("portal-content")
    expect(content).toBeDefined()
    // Debe ser hijo del portal en document.body
    expect(document.body.contains(content)).toBe(true)
    expect(document.body.style.overflow).toBe("hidden")

    // Probar tecla Escape
    fireEvent.keyDown(window, { key: "Escape" })
    expect(handleClose).toHaveBeenCalledTimes(1)

    // Al desmontar, restaura el scroll del body
    unmount()
    expect(document.body.style.overflow).toBe("")
  })

  it("DocumentViewerModal prioriza shareNativeDocument en Android para documentos nativos", async () => {
    const shareMock = vi.fn()
    window.LaVeinteApp = {
      shareNativeDocument: shareMock,
      readNativeDocument: vi.fn().mockResolvedValue({ name: "tarjeton.pdf", data: "b64", mimeType: "application/pdf" }),
    } as unknown as typeof window.LaVeinteApp

    const fakeDoc: DocumentoPersonalItem = {
      kind: "nativo",
      tipo: "tarjeton",
      id: "101",
      name: "TARJETON_TEST.pdf",
      localPath: "/data/docs/tarjeton.pdf",
      source: "TU_PERFIL",
      fileSize: 50000,
      downloadedAt: Date.now(),
      mimeType: "application/pdf",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={fakeDoc}
        userId="usr_test"
        profile={null}
        onClose={vi.fn()}
        onSendPrint={vi.fn()}
      />
    )

    const shareBtn = screen.getByLabelText(/Compartir/i)
    expect(shareBtn).toBeDefined()

    fireEvent.click(shareBtn)
    expect(shareMock).toHaveBeenCalledWith("/data/docs/tarjeton.pdf", "TARJETON_TEST.pdf")
  })

  it("DocumentViewerModal invoca onSendPrint al pulsar Imprimir", () => {
    const handleSendPrint = vi.fn()
    const fakeDoc: DocumentoPersonalItem = {
      kind: "nativo",
      tipo: "tarjeton",
      id: "101",
      name: "TARJETON_TEST.pdf",
      localPath: "/data/docs/tarjeton.pdf",
      source: "TU_PERFIL",
      fileSize: 50000,
      downloadedAt: Date.now(),
      mimeType: "application/pdf",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={fakeDoc}
        userId="usr_test"
        profile={null}
        onClose={vi.fn()}
        onSendPrint={handleSendPrint}
      />
    )

    const printBtn = screen.getByLabelText(/Imprimir/i)
    expect(printBtn).toBeDefined()

    fireEvent.click(printBtn)
    expect(handleSendPrint).toHaveBeenCalledWith(fakeDoc)
  })
})

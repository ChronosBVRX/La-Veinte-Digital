// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DocumentViewerModal } from "../components/DocumentViewerModal"
import type { UnifiedViewerDocument } from "../lib/documents"

describe("Unified Document Viewer (DocumentViewerModal)", () => {
  beforeEach(() => {
    document.body.style.overflow = ""
    vi.clearAllMocks()
  })

  it("1. Renderiza correctamente un documento canónico de tipo tarjetón y sus metadatos", () => {
    const tarjetonDoc: UnifiedViewerDocument = {
      id: "tarj_001",
      type: "tarjeton",
      name: "Tarjeton_2026_16.pdf",
      mimeType: "application/pdf",
      fileSize: 1048576, // 1 MB
      createdAt: "2026-08-30",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={tarjetonDoc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText("Tarjeton_2026_16.pdf")).toBeDefined()
    expect(screen.getByText("Tarjetones")).toBeDefined()
    expect(screen.getByLabelText(/Compartir/i)).toBeDefined()
    expect(screen.getByLabelText(/Descargar/i)).toBeDefined()
  })

  it("2. Renderiza un documento canónico de tipo checadas y genérico documento", () => {
    const checadasDoc: UnifiedViewerDocument = {
      id: "chec_001",
      type: "checadas",
      name: "Reporte_Biometrico_Agosto.pdf",
      mimeType: "application/pdf",
      fileSize: 512000,
      createdAt: Date.now(),
    }

    const { rerender } = render(
      <DocumentViewerModal
        open={true}
        doc={checadasDoc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText("Reporte_Biometrico_Agosto.pdf")).toBeDefined()
    expect(screen.getByText("Checadas")).toBeDefined()

    const genericDoc: UnifiedViewerDocument = {
      id: "gen_001",
      type: "documento",
      name: "Constancia_Laboral.pdf",
      mimeType: "application/pdf",
      fileSize: 204800,
      createdAt: "2026-08-20",
    }

    rerender(
      <DocumentViewerModal
        open={true}
        doc={genericDoc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText("Constancia_Laboral.pdf")).toBeDefined()
    expect(screen.getByText("Documentos")).toBeDefined()
  })

  it("3. Descarga: invoca onDownload cuando se especifica la prop", () => {
    const onDownloadMock = vi.fn()
    const doc: UnifiedViewerDocument = {
      id: "doc_down",
      type: "tarjeton",
      name: "Tarjeton_Descarga.pdf",
      mimeType: "application/pdf",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={doc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
        onDownload={onDownloadMock}
      />
    )

    const downloadBtn = screen.getByLabelText(/Descargar/i)
    expect(downloadBtn).toBeDefined()

    fireEvent.click(downloadBtn)
    expect(onDownloadMock).toHaveBeenCalledWith(doc)
  })

  it("4. Exportar Tarjetón: botón disponible solo para tarjetones e invoca onImportTarjeton", () => {
    const onImportTarjetonMock = vi.fn()
    const tarjetonDoc: UnifiedViewerDocument = {
      id: "tarj_imp",
      type: "tarjeton",
      name: "Tarjeton_Para_Perfil.pdf",
    }

    const { rerender } = render(
      <DocumentViewerModal
        open={true}
        doc={tarjetonDoc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
        onImportTarjeton={onImportTarjetonMock}
      />
    )

    const exportBtn = screen.getByLabelText(/Exportar al perfil/i)
    expect(exportBtn).toBeDefined()

    fireEvent.click(exportBtn)
    expect(onImportTarjetonMock).toHaveBeenCalledWith(tarjetonDoc)

    // Para tipo escrito o checadas no debe mostrarse el botón de exportar
    const escritoDoc: UnifiedViewerDocument = {
      id: "esc_001",
      type: "escrito",
      name: "Escrito.pdf",
    }

    rerender(
      <DocumentViewerModal
        open={true}
        doc={escritoDoc}
        userId="usr_123"
        profile={null}
        onClose={vi.fn()}
        onImportTarjeton={onImportTarjetonMock}
      />
    )

    expect(screen.queryByLabelText(/Exportar al perfil/i)).toBeNull()
  })

  it("5. Flujo de eliminación con confirmación modal", () => {
    const onDeleteMock = vi.fn()
    const handleClose = vi.fn()
    const doc: UnifiedViewerDocument = {
      id: "doc_del",
      type: "documento",
      name: "Documento_AEliminar.pdf",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={doc}
        userId="usr_123"
        profile={null}
        onClose={handleClose}
        onDelete={onDeleteMock}
      />
    )

    const deleteBtn = screen.getByLabelText(/Eliminar/i)
    expect(deleteBtn).toBeDefined()

    // 1. Clic en botón eliminar abre el diálogo de confirmación
    fireEvent.click(deleteBtn)
    expect(screen.getByText(/¿Eliminar este documento\?/i)).toBeDefined()
    expect(screen.getByText(/No se podrá recuperar/i)).toBeDefined()

    // 2. Clic en Cancelar descarta el diálogo sin llamar onDelete
    const cancelBtn = screen.getByRole("button", { name: /Cancelar/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByText(/¿Eliminar este documento\?/i)).toBeNull()
    expect(onDeleteMock).not.toHaveBeenCalled()

    // 3. Volver a abrir y confirmar eliminación
    fireEvent.click(deleteBtn)
    const confirmDeleteBtn = screen.getAllByRole("button", { name: /Eliminar/i }).find(
      (btn) => btn !== deleteBtn
    )
    expect(confirmDeleteBtn).toBeDefined()

    fireEvent.click(confirmDeleteBtn!)
    expect(onDeleteMock).toHaveBeenCalledWith(doc)
    expect(handleClose).toHaveBeenCalled()
  })

  it("6. Botón atrás de Android (popstate) cierra el visor modal", () => {
    const handleClose = vi.fn()
    const doc: UnifiedViewerDocument = {
      id: "doc_back",
      type: "tarjeton",
      name: "Tarjeton_Back.pdf",
    }

    render(
      <DocumentViewerModal
        open={true}
        doc={doc}
        userId="usr_123"
        profile={null}
        onClose={handleClose}
      />
    )

    // Disparar evento de navegación 'popstate' (simula botón atrás en Android WebView)
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it("7. Flujo completo de captura de Tarjetón (PDF): guardar -> listar -> abrir visor -> atrás -> regresar", async () => {
    // 1. Guardar archivo / captura simulada
    const storedDocs: UnifiedViewerDocument[] = []
    const newTarjeton: UnifiedViewerDocument = {
      id: "tarj_capturado_01",
      type: "tarjeton",
      name: "Tarjeton_IMSS_Q01_2026.pdf",
      mimeType: "application/pdf",
      fileSize: 350000,
      createdAt: Date.now(),
    }
    storedDocs.push(newTarjeton)

    // 2. Actualizar listado
    expect(storedDocs).toHaveLength(1)
    expect(storedDocs[0].name).toBe("Tarjeton_IMSS_Q01_2026.pdf")

    // 3. Abrir DocumentViewerModal
    let currentOpen = true
    const handleClose = vi.fn(() => {
      currentOpen = false
    })

    const { rerender } = render(
      <DocumentViewerModal
        open={currentOpen}
        doc={storedDocs[0]}
        userId="usr_123"
        profile={null}
        onClose={handleClose}
      />
    )

    expect(screen.getByText("Tarjeton_IMSS_Q01_2026.pdf")).toBeDefined()
    expect(screen.getByText("Tarjetones")).toBeDefined()

    // 4. Cerrar con atrás (popstate)
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(handleClose).toHaveBeenCalledTimes(1)

    // 5. Regresar al flujo anterior (modal cerrado)
    rerender(
      <DocumentViewerModal
        open={false}
        doc={null}
        userId="usr_123"
        profile={null}
        onClose={handleClose}
      />
    )
    expect(screen.queryByText("Tarjeton_IMSS_Q01_2026.pdf")).toBeNull()
  })

  it("8. Flujo completo de captura de Checada (PDF e Imagen): guardar -> listar -> abrir visor -> atrás -> regresar", async () => {
    // A) Checada en PDF
    const checadaPdf: UnifiedViewerDocument = {
      id: "chec_pdf_01",
      type: "checadas",
      name: "Reporte_Checadas_Biometrico.pdf",
      mimeType: "application/pdf",
      fileSize: 180000,
      createdAt: Date.now(),
    }

    let isViewerOpen = true
    const onClosePdf = vi.fn(() => { isViewerOpen = false })

    const { rerender } = render(
      <DocumentViewerModal
        open={isViewerOpen}
        doc={checadaPdf}
        userId="usr_123"
        profile={null}
        onClose={onClosePdf}
      />
    )
    expect(screen.getByText("Reporte_Checadas_Biometrico.pdf")).toBeDefined()
    expect(screen.getByText("Checadas")).toBeDefined()

    // Cerrar con atrás
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(onClosePdf).toHaveBeenCalledTimes(1)

    // B) Checada en Imagen (PNG / JPEG)
    const checadaImg: UnifiedViewerDocument = {
      id: "chec_img_01",
      type: "checadas",
      name: "Comprobante_Checada_Captura.png",
      mimeType: "image/png",
      fileSize: 420000,
      createdAt: Date.now(),
      sourceUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    }

    const onCloseImg = vi.fn()
    rerender(
      <DocumentViewerModal
        open={true}
        doc={checadaImg}
        userId="usr_123"
        profile={null}
        onClose={onCloseImg}
      />
    )

    expect(screen.getByText("Comprobante_Checada_Captura.png")).toBeDefined()
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(onCloseImg).toHaveBeenCalledTimes(1)
  })
})

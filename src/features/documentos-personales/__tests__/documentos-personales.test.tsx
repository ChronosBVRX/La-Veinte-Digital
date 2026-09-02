// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { DocumentosPersonales } from "../components/DocumentosPersonales"
import { guardarEscrito } from "@/features/escritos/services/escritos-storage"
import { saveBlobResource } from "@/features/escritos/services/escritos-indexeddb"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { escritoToPdfFile } from "../lib/escrito-pdf"

let lastImportTarjetonProps: Record<string, unknown> | null = null

vi.mock("../components/ImportTarjetonModal", () => ({
  ImportTarjetonModal: (props: Record<string, unknown>) => {
    lastImportTarjetonProps = props
    return props.open ? <div data-testid="import-tarjeton-modal">Modal Importación Tarjetón</div> : null
  },
}))

vi.mock("../components/SendPrintModal", () => ({
  SendPrintModal: () => null,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "usr_doc_test", email: "user@imss.gob.mx" } },
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

describe("DocumentosPersonales (Integración con Escritos y Panel Inline)", () => {
  beforeEach(() => {
    localStorage.clear()
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    lastImportTarjetonProps = null
    vi.clearAllMocks()
  })

  it("espera la resolución de sesión y lista los escritos del usuario con botón Editar", async () => {
    const doc = createEmptyEscritoDraftV2("usr_doc_test", "solicitud", {
      titulo: "Solicitud de Cambio de Turno",
      fecha: "2026-08-31",
    })
    guardarEscrito(doc, "usr_doc_test")

    render(<DocumentosPersonales />)

    // Al montar muestra el estado de carga
    expect(screen.getByText(/Cargando documentos…/i)).toBeDefined()

    // Tras resolver la sesión, muestra el documento y el enlace de edición
    await waitFor(() => {
      expect(screen.getByText(/Solicitud de Cambio de Turno/i)).toBeDefined()
    })

    const editLink = screen.getByLabelText(/Editar escrito/i)
    expect(editLink).toBeDefined()
    expect(editLink.getAttribute("href")).toBe(`/escritos?id=${doc.id}`)

    // Verifica que existan los botones de Abrir, Compartir e Imprimir
    expect(screen.getByLabelText(/Abrir documento/i)).toBeDefined()
    expect(screen.getByLabelText(/Compartir documento/i)).toBeDefined()
    expect(screen.getByLabelText(/Enviar a imprimir o transferir/i)).toBeDefined()
  })

  it("renderiza documentos nativos y maneja el panel inline de Exportar al perfil", async () => {
    const fakeDocs = [
      {
        id: 101,
        name: "TARJETON_2026_03_1Q.pdf",
        localPath: "/data/docs/tarjeton_1.pdf",
        source: "TU_PERFIL",
        fileSize: 45000,
        downloadedAt: new Date("2026-03-15T10:00:00Z").getTime(),
        mimeType: "application/pdf",
      },
      {
        id: 102,
        name: "TARJETON_2026_03_2Q.pdf",
        localPath: "/data/docs/tarjeton_2.pdf",
        source: "TU_PERFIL",
        fileSize: 46000,
        downloadedAt: new Date("2026-03-31T10:00:00Z").getTime(),
        mimeType: "application/pdf",
      },
      {
        id: 103,
        name: "REGISTRO_BIOMETRICO_2026_02.pdf",
        localPath: "/data/docs/checadas.pdf",
        source: "TU_PERFIL_BIOMETRIC",
        fileSize: 12000,
        downloadedAt: new Date("2026-02-28T10:00:00Z").getTime(),
        mimeType: "application/pdf",
      },
    ]

    window.LaVeinteApp = {
      listNativeDocuments: vi.fn().mockResolvedValue(fakeDocs),
      readNativeDocument: vi.fn().mockResolvedValue({
        name: "TARJETON_2026_03_1Q.pdf",
        mimeType: "application/pdf",
        data: "ZHVtbXk=",
      }),
      deleteNativeDocument: vi.fn().mockResolvedValue(true),
    } as unknown as typeof window.LaVeinteApp

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText("TARJETON_2026_03_1Q.pdf")).toBeDefined()
      expect(screen.getByText("TARJETON_2026_03_2Q.pdf")).toBeDefined()
      expect(screen.getByText("REGISTRO_BIOMETRICO_2026_02.pdf")).toBeDefined()
    })

    // Comprobar que en los tarjetones existen botones de 3 puntos
    const moreButtons = screen.getAllByLabelText(/Más opciones/i)
    expect(moreButtons.length).toBe(2)

    // 1. Abrir panel en el primer tarjetón
    fireEvent.click(moreButtons[0])
    expect(moreButtons[0].getAttribute("aria-expanded")).toBe("true")
    expect(moreButtons[0].getAttribute("aria-controls")).toBe("menu-panel-101")

    const panel1 = document.getElementById("menu-panel-101")
    expect(panel1).toBeDefined()
    expect(panel1?.style.position).not.toBe("absolute")
    expect(panel1?.style.width).toBe("100%")
    expect(screen.getByText(/Exportar al perfil/i)).toBeDefined()
    expect(screen.getByText(/Actualiza tu perfil laboral/i)).toBeDefined()

    // 2. Abrir panel en el segundo tarjetón: debe cerrar el primero y abrir el segundo
    fireEvent.click(moreButtons[1])
    expect(moreButtons[0].getAttribute("aria-expanded")).toBe("false")
    expect(moreButtons[1].getAttribute("aria-expanded")).toBe("true")
    expect(document.getElementById("menu-panel-101")).toBeNull()
    expect(document.getElementById("menu-panel-102")).not.toBeNull()

    // 3. Volver a pulsar los 3 puntos del segundo tarjetón: debe cerrarse
    fireEvent.click(moreButtons[1])
    expect(moreButtons[1].getAttribute("aria-expanded")).toBe("false")
    expect(document.getElementById("menu-panel-102")).toBeNull()

    // 4. Volver a abrir y pulsar la acción "Exportar al perfil": debe ejecutar la importación y abrir el modal
    fireEvent.click(moreButtons[0])
    const exportBtn = screen.getByLabelText("Exportar tarjetón al perfil")
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(lastImportTarjetonProps?.open).toBe(true)
      expect(lastImportTarjetonProps?.file).toBeDefined()
      expect(document.getElementById("menu-panel-101")).toBeNull()
    })
  })

  it("escritoToPdfFile genera PDF vectorial desde Documentos Personales hidratando firma y fotos", async () => {
    const dummyBlob = new Blob(["test_img"], { type: "image/png" })
    const sigRef = await saveBlobResource("usr_doc_test", "esc_pdf", "firma", "sig", dummyBlob)
    const photoRef = await saveBlobResource("usr_doc_test", "esc_pdf", "anexo", "photo", dummyBlob)

    const doc = createEmptyEscritoDraftV2("usr_doc_test", "queja", {
      id: "esc_pdf",
      titulo: "Queja sobre insumos",
      cuerpo: "Cuerpo de la queja formal...",
      firmaRef: sigRef,
      anexos: [
        {
          id: "anx_1",
          nombre: "Foto de insumos",
          descripcion: "Evidencia de falta de insumos",
          tipo: "image/png",
          size: 1024,
          storageRef: photoRef,
        },
      ],
    })

    const pdfFile = await escritoToPdfFile(doc, "usr_doc_test", {
      nombre: "Ana Morales",
      matricula: "554433",
      categoria: "Enfermera Especialista",
    })

    expect(pdfFile).toBeInstanceOf(File)
    expect(pdfFile.size).toBeGreaterThan(800)
  })

  it("al presionar Abrir documento abre el visor in-app y muestra el contenido completo", async () => {
    const doc = createEmptyEscritoDraftV2("usr_doc_test", "solicitud", {
      titulo: "Permiso Económico Cláusula 29",
      ciudad: "Ciudad de México",
      fecha: "2026-09-01",
      asunto: "SOLICITUD DE DÍAS ECONÓMICOS",
      cuerpo: "Por medio de la presente solicito formalmente el otorgamiento de días económicos conforme al CCT.",
    })
    guardarEscrito(doc, "usr_doc_test")

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText("Permiso Económico Cláusula 29")).toBeDefined()
    })

    const openBtn = screen.getByLabelText(/Abrir documento/i)
    openBtn.click()

    await waitFor(() => {
      expect(screen.getByLabelText(/Cerrar visor/i)).toBeDefined()
    })
  })

  it("muestra el modal de confirmación contextual y elimina un tarjetón nativo con deleteNativeDocumentById", async () => {
    let currentDocs = [
      {
        id: 201,
        name: "Tarjetón — 1ª quincena de marzo de 2026",
        localPath: "/data/docs/tarjeton_201.pdf",
        source: "TU_PERFIL",
        fileSize: 50000,
        downloadedAt: new Date("2026-03-15T10:00:00Z").getTime(),
        mimeType: "application/pdf",
      },
    ]

    const deleteByIdMock = vi.fn().mockImplementation(async (id: number) => {
      currentDocs = currentDocs.filter((d) => d.id !== id)
      return { ok: true }
    })
    window.LaVeinteApp = {
      listNativeDocuments: vi.fn().mockImplementation(async () => currentDocs),
      deleteNativeDocumentById: deleteByIdMock,
    } as unknown as typeof window.LaVeinteApp

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText("Tarjetón — 1ª quincena de marzo de 2026")).toBeDefined()
    })

    // Pulsar botón eliminar
    const deleteBtn = screen.getByLabelText("Eliminar documento")
    fireEvent.click(deleteBtn)

    // Debe abrir el modal de confirmación con mensaje de tarjetón
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
      expect(screen.getByText("Eliminar documento")).toBeDefined()
      expect(screen.getByText(/Se eliminará este archivo únicamente de este dispositivo/i)).toBeDefined()
    })

    // Pulsar Cancelar: no debe borrar
    const cancelBtn = screen.getByText("Cancelar")
    fireEvent.click(cancelBtn)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(deleteByIdMock).not.toHaveBeenCalled()

    // Volver a pulsar Eliminar en la tarjeta y confirmar en el modal
    fireEvent.click(screen.getByLabelText("Eliminar documento"))
    const confirmBtn = screen.getAllByRole("button", { name: /^Eliminar$/i })[0]
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteByIdMock).toHaveBeenCalledWith(201, "/data/docs/tarjeton_201.pdf")
      expect(screen.getByText("Documento eliminado.")).toBeDefined()
      expect(screen.queryByText("Tarjetón — 1ª quincena de marzo de 2026")).toBeNull()
    })
  })

  it("muestra el modal de confirmación y elimina un escrito reactivamente", async () => {
    const doc = createEmptyEscritoDraftV2("usr_doc_test", "solicitud", {
      titulo: "Oficio de Justificación",
      fecha: "2026-09-02",
    })
    guardarEscrito(doc, "usr_doc_test")

    render(<DocumentosPersonales />)

    await waitFor(() => {
      expect(screen.getByText("Oficio de Justificación")).toBeDefined()
    })

    fireEvent.click(screen.getByLabelText("Eliminar documento"))

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined()
      expect(screen.getByText(/Se eliminará el escrito y sus anexos guardados en este dispositivo/i)).toBeDefined()
    })

    const confirmBtn = screen.getAllByRole("button", { name: /^Eliminar$/i })[0]
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.getByText("Escrito eliminado correctamente.")).toBeDefined()
      expect(screen.queryByText("Oficio de Justificación")).toBeNull()
    })
  })
})

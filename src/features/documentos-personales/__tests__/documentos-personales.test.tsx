// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import "fake-indexeddb/auto"
import { render, screen, waitFor } from "@testing-library/react"
import { DocumentosPersonales } from "../components/DocumentosPersonales"
import { guardarEscrito } from "@/features/escritos/services/escritos-storage"
import { saveBlobResource } from "@/features/escritos/services/escritos-indexeddb"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { escritoToPdfFile } from "../lib/escrito-pdf"

vi.mock("../components/ImportTarjetonModal", () => ({
  ImportTarjetonModal: () => null,
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

describe("DocumentosPersonales (Integración con Escritos)", () => {
  beforeEach(() => {
    localStorage.clear()
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

  it("renderiza documentos nativos (tarjetón y checadas) con botones de abrir, compartir, imprimir y exportar", async () => {
    // Simular bridge nativo
    const fakeDocs = [
      {
        id: 101,
        name: "TARJETON_2026_03_1Q.pdf",
        localPath: "/data/docs/tarjeton.pdf",
        source: "TU_PERFIL",
        fileSize: 45000,
        downloadedAt: new Date("2026-03-15T10:00:00Z").getTime(),
        mimeType: "application/pdf",
      },
      {
        id: 102,
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
      expect(screen.getByText("REGISTRO_BIOMETRICO_2026_02.pdf")).toBeDefined()
    })

    // Comprobar que en el tarjetón existe el botón de 3 puntos (Más opciones)
    const moreBtn = screen.getByLabelText(/Más opciones/i)
    expect(moreBtn).toBeDefined()
    moreBtn.click()

    await waitFor(() => {
      expect(screen.getByText(/Exportar al perfil/i)).toBeDefined()
      expect(screen.getByText(/Actualiza tu perfil laboral/i)).toBeDefined()
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
})

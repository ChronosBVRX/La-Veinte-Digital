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

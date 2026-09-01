// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { DocumentosPersonales } from "../components/DocumentosPersonales"
import { guardarEscrito } from "@/features/escritos/services/escritos-storage"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

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
})
